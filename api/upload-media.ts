import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { dataUrl, filename = 'media.png' } = req.body || {};

    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing dataUrl' });
    }

    const trimmed = dataUrl.trim();
    const match = trimmed.match(/^data:([a-zA-Z0-9\/\-+]+);base64,(.+)$/);
    if (!match) {
      if (trimmed.startsWith('http')) {
        return res.status(200).json({ success: true, url: trimmed });
      }
      return res.status(400).json({ success: false, message: 'Invalid dataUrl format' });
    }

    const mime = match[1];
    const b64Data = match[2];
    const buffer = Buffer.from(b64Data, 'base64');
    const isVideo = mime.startsWith('video/');
    const ext = isVideo ? (mime.includes('mp4') ? 'mp4' : 'webm') : (mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png');
    const safeFilename = filename.includes('.') ? filename : `${filename}.${ext}`;

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mime });
    formData.append('reqtype', 'fileupload');
    formData.append('time', '72h');
    formData.append('fileToUpload', blob, safeFilename);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const litterUrl = (await uploadRes.text()).trim();
    if (litterUrl && litterUrl.startsWith('http')) {
      return res.status(200).json({ success: true, url: litterUrl });
    }

    // Fallback for images
    if (!isVideo) {
      const freeForm = new FormData();
      freeForm.append('key', '6d207e02198a847aa98d0a2a901485a5');
      freeForm.append('action', 'upload');
      freeForm.append('source', b64Data);
      freeForm.append('format', 'json');
      const freeRes = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: freeForm });
      const freeJson: any = await freeRes.json();
      if (freeJson?.image?.url) {
        return res.status(200).json({ success: true, url: freeJson.image.url });
      }
    }

    return res.status(500).json({ success: false, message: 'Upload host did not return a valid URL' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
