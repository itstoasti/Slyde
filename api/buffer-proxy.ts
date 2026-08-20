import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, token, profileIds = [], channels = [], caption, shortCaption, longCaption, title, mediaUrl, mediaUrls = [], videoUrl, scheduledAt, scheduleMode = 'queue', youtubeAsDraft = true, postAsDraft = false } = req.body || {};
    const cleanToken = (token || '').trim();

    if (!cleanToken) {
      return res.status(400).json({ success: false, message: 'Missing Buffer Access Token' });
    }

    if (action === 'get_profiles') {
      // 1. Modern Buffer GraphQL API (Official)
      try {
        const accountQuery = `query GetAccount {
          account {
            id
            name
            organizations {
              id
              name
              channelCount
            }
          }
        }`;

        const accountRes = await fetch('https://api.buffer.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanToken}`
          },
          body: JSON.stringify({ query: accountQuery })
        });

        const accountData = await accountRes.json();
        const orgs = accountData.data?.account?.organizations || [];

        if (orgs.length > 0) {
          const allChannels: any[] = [];
          for (const org of orgs) {
            const chQuery = `query GetChannels($input: ChannelsInput!) {
              channels(input: $input) {
                id
                name
                displayName
                service
                avatar
              }
            }`;

            const chRes = await fetch('https://api.buffer.com', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanToken}`
              },
              body: JSON.stringify({
                query: chQuery,
                variables: { input: { organizationId: org.id } }
              })
            });

            const chData = await chRes.json();
            const list = chData.data?.channels || [];
            for (const ch of list) {
              allChannels.push({
                id: ch.id,
                formatted_username: ch.displayName || ch.name,
                service: ch.service,
                avatar: ch.avatar
              });
            }
          }

          return res.status(200).json({ success: true, profiles: allChannels });
        }

        if (accountData.errors && accountData.errors.length > 0) {
          return res.status(200).json({ success: false, message: accountData.errors[0].message });
        }
      } catch (e: any) {
        console.warn('Buffer GraphQL error', e);
      }

      // 2. Legacy REST Fallback
      try {
        const restRes = await fetch('https://api.bufferapp.com/1/profiles.json', {
          headers: { 'Authorization': `Bearer ${cleanToken}` }
        });
        const restData = await restRes.json();
        if (Array.isArray(restData)) {
          const channels = restData.map((p: any) => ({
            id: p.id,
            formatted_username: p.formatted_username || p.service_username || p.service,
            service: p.service,
            avatar: p.avatar
          }));
          return res.status(200).json({ success: true, profiles: channels });
        }
      } catch (e) {}

      return res.status(200).json({
        success: false,
        message: 'Invalid Buffer token. Please verify your token in your Buffer developer dashboard.'
      });
    }

    if (action === 'create_post') {
      // 1. Pre-resolve public media assets ONCE in parallel before the channel loop
      const resolvePublicImageUrl = async (rawUrl?: string, index: number = 0): Promise<string | null> => {
        if (!rawUrl || typeof rawUrl !== 'string') return null;
        const trimmed = rawUrl.trim();
        if (!trimmed) return null;

        // If base64 data URI, upload to temporary public image host with wsrv wrapper
        if (trimmed.startsWith('data:image/')) {
          try {
            const match = trimmed.match(/^data:image\/(\w+);base64,(.+)$/);
            const ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'png';
            const b64Data = match ? match[2] : trimmed;
            const buffer = Buffer.from(b64Data, 'base64');
            const formData = new FormData();
            const blob = new Blob([buffer], { type: `image/${ext}` });
            formData.append('reqtype', 'fileupload');
            formData.append('time', '72h');
            formData.append('fileToUpload', blob, `slide-${index + 1}.${ext}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const litterUrl = (await res.text()).trim();
            if (litterUrl && litterUrl.startsWith('http')) {
              return litterUrl;
            }
          } catch (e) {}

          // Secondary fallback to FreeImage
          try {
            const match = trimmed.match(/^data:image\/\w+;base64,(.+)$/);
            const b64Data = match ? match[1] : trimmed;
            const formData = new FormData();
            formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
            formData.append('action', 'upload');
            formData.append('source', b64Data);
            formData.append('format', 'json');
            const upRes = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: formData });
            const upJson: any = await upRes.json();
            if (upJson?.image?.url) {
              return upJson.image.url;
            }
          } catch (e) {}

          return null;
        }

        // If standard http/https web URL
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return trimmed;
        }
        return null;
      };

      const resolvePublicVideoUrl = async (rawUrl?: string): Promise<string | null> => {
        if (!rawUrl || typeof rawUrl !== 'string') return null;
        const trimmed = rawUrl.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('data:video/')) {
          try {
            const match = trimmed.match(/^data:video\/(\w+);base64,(.+)$/);
            const ext = match ? (match[1] === 'mp4' ? 'mp4' : 'webm') : 'mp4';
            const b64Data = match ? match[2] : trimmed;
            const buffer = Buffer.from(b64Data, 'base64');
            const formData = new FormData();
            const blob = new Blob([buffer], { type: `video/${ext}` });
            formData.append('reqtype', 'fileupload');
            formData.append('time', '72h');
            formData.append('fileToUpload', blob, `recipe-video.${ext}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const litterUrl = (await res.text()).trim();
            if (litterUrl && litterUrl.startsWith('http')) {
              return litterUrl;
            }
          } catch (e) {}
          return null;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return trimmed;
        }
        return null;
      };

      let resolvedVideoUrl: string | null = null;
      if (videoUrl) {
        resolvedVideoUrl = await resolvePublicVideoUrl(videoUrl);
      }

      let commonAssets: any[] | undefined = undefined;
      if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
        const resolvedList = await Promise.all(mediaUrls.map((u, idx) => resolvePublicImageUrl(u, idx)));
        const valid = resolvedList.filter(Boolean).map(url => ({ image: { url } }));
        if (valid.length > 0) {
          commonAssets = valid;
        }
      } else if (mediaUrl) {
        const single = await resolvePublicImageUrl(mediaUrl, 0);
        if (single) {
          commonAssets = [{ image: { url: single } }];
        }
      }

      // 2. Post via modern GraphQL mutation for each selected channel
      let successCount = 0;
      let lastError = '';
      const channelResults: Array<{ name: string; service: string; success: boolean; error?: string }> = [];

      for (const channelId of profileIds) {
        try {
          let shareMode = 'addToQueue';
          let dueAt = undefined;

          if (scheduledAt) {
            const d = new Date(scheduledAt);
            if (!isNaN(d.getTime())) {
              shareMode = 'customScheduled';
              dueAt = d.toISOString();
            }
          } else if (scheduleMode === 'now') {
            shareMode = 'shareNow';
          }

          const mutation = `mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess {
                post {
                  id
                  status
                }
              }
              ... on MutationError {
                message
              }
            }
          }`;

          // Adapt caption length based on social platform limits
          const channelMeta = channels.find((c: any) => c.id === channelId);
          const svc = (channelMeta?.service || '').toLowerCase();
          const channelName = channelMeta?.formatted_username || svc || channelId;
          const isYouTube = svc.includes('youtube');
          const isShortConstrained = svc.includes('twitter') || svc.includes('x') || svc.includes('pinterest') || svc.includes('threads') || svc.includes('bluesky');

          let postText = caption || '';
          if (isShortConstrained && shortCaption) {
            postText = shortCaption;
            const maxLen = (svc.includes('twitter') || svc.includes('x')) ? 280 : (svc.includes('bluesky') ? 300 : 500);
            if (postText.length > maxLen) {
              postText = postText.substring(0, maxLen - 3) + '...';
            }
          } else if (isYouTube) {
            postText = caption || title || '';
          } else if (!isShortConstrained && longCaption && (!caption || caption.length < longCaption.length)) {
            postText = longCaption;
          }

          const input: any = {
            channelId,
            text: postText,
            mode: shareMode,
            needsApproval: false,
            saveToDraft: Boolean(postAsDraft)
          };

          // Attach platform-specific metadata ONLY for the matching service
          if (svc.includes('instagram')) {
            input.metadata = {
              instagram: {
                type: 'post',
                shouldShareToFeed: true
              }
            };
          } else if (svc.includes('tiktok')) {
            input.metadata = {
              tiktok: {
                title: title || (postText ? postText.split('\n')[0].substring(0, 90) : 'Recipe')
              }
            };
          } else if (isYouTube) {
            input.metadata = {
              youtube: {
                title: title || (postText ? postText.split('\n')[0].substring(0, 60) : 'Recipe'),
                categoryId: '26',
                privacy: youtubeAsDraft ? 'private' : 'public',
                madeForKids: false
              }
            };
          }

          // Configure mode, schedulingType, and dueAt based on user selection
          if (shareMode === 'shareNow' && !postAsDraft) {
            input.mode = 'shareNow';
            input.schedulingType = 'automatic';
            delete input.dueAt;
          } else if (shareMode === 'customScheduled' && dueAt && !postAsDraft) {
            input.dueAt = dueAt;
            input.mode = 'customScheduled';
            input.schedulingType = 'automatic';
          } else {
            input.mode = 'addToQueue';
            input.schedulingType = 'automatic';
            delete input.dueAt;
          }

          // Attach assets: Video for YouTube, Images for Instagram/Threads/TikTok
          if (isYouTube) {
            const ytVideo = videoUrl || resolvedVideoUrl;
            if (ytVideo) {
              input.assets = [{ video: { url: ytVideo } }];
            } else {
              delete input.assets;
            }
          } else if (commonAssets && commonAssets.length > 0) {
            input.assets = commonAssets;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          let postRes = await fetch('https://api.buffer.com', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanToken}`
            },
            body: JSON.stringify({ query: mutation, variables: { input } }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          let postData = await postRes.json();
          let postPayload = postData.data?.createPost;

          // If failed due to schedule time collision or past date error, retry cleanly as addToQueue without dueAt
          const errorMsg = (postData.errors?.[0]?.message || postPayload?.message || '').toLowerCase();
          if (!postPayload?.post?.id && (errorMsg.includes('scheduled time') || errorMsg.includes('must be in the future') || errorMsg.includes('in the past') || errorMsg.includes('too soon'))) {
            delete input.dueAt;
            input.mode = 'addToQueue';
            input.schedulingType = 'automatic';
            postRes = await fetch('https://api.buffer.com', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanToken}`
              },
              body: JSON.stringify({ query: mutation, variables: { input } })
            });
            postData = await postRes.json();
            postPayload = postData.data?.createPost;
          }

          // If failed due to image read error and platform allows text-only (e.g. Threads/X), retry without invalid asset
          if (
            !postPayload?.post?.id &&
            !svc.includes('tiktok') &&
            !svc.includes('instagram') &&
            !isYouTube &&
            (postData.errors?.[0]?.message?.toLowerCase().includes('image') ||
             postPayload?.message?.toLowerCase().includes('image')) &&
            input.assets
          ) {
            delete input.assets;
            postRes = await fetch('https://api.buffer.com', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanToken}`
              },
              body: JSON.stringify({ query: mutation, variables: { input } })
            });
            postData = await postRes.json();
            postPayload = postData.data?.createPost;
          }

          if (postPayload?.post?.id || postPayload?.post?.status) {
            successCount++;
            channelResults.push({ name: channelName, service: svc, success: true });
          } else {
            const err = postPayload?.message || postData.errors?.[0]?.message || 'Unknown channel error';
            lastError = `${svc || channelId}: ${err}`;
            channelResults.push({ name: channelName, service: svc, success: false, error: err });
          }
        } catch (e: any) {
          const err = e.message || 'Request failed';
          lastError = `${channelId}: ${err}`;
          channelResults.push({ name: channelId, service: 'unknown', success: false, error: err });
        }
      }

      const allSucceeded = successCount === profileIds.length;
      const failedChannels = channelResults.filter(r => !r.success);

      let finalMessage = '';
      if (allSucceeded) {
        finalMessage = scheduledAt 
          ? `Successfully scheduled for ${new Date(scheduledAt).toLocaleString()} across all ${successCount} channel(s)!`
          : (scheduleMode === 'now' ? `Published now across all ${successCount} channel(s)!` : `Added to Buffer queue across all ${successCount} channel(s)!`);
      } else if (successCount > 0) {
        const failedSummary = failedChannels.map(r => `${r.service || r.name}: ${r.error}`).join(' · ');
        finalMessage = `Posted to ${successCount}/${profileIds.length} channels. Issues: ${failedSummary}`;
      } else {
        const failedSummary = failedChannels.map(r => `${r.service || r.name}: ${r.error}`).join(' · ');
        finalMessage = failedSummary || lastError || 'Failed to schedule post on Buffer.';
      }

      return res.status(200).json({
        success: successCount > 0,
        successCount,
        totalChannels: profileIds.length,
        results: channelResults,
        message: finalMessage
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown action' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
