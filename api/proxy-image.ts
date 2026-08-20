import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetImageUrl = (req.query.url as string) || '';

  if (!targetImageUrl || !targetImageUrl.startsWith('http')) {
    return res.status(400).send('Missing or invalid url parameter');
  }

  try {
    const domain = new URL(targetImageUrl).origin;
    const imgRes = await fetch(targetImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${domain}/`,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!imgRes.ok) {
      const fallbackRes = await fetch(targetImageUrl);
      if (!fallbackRes.ok) {
        return res.status(fallbackRes.status).send('Image proxy fetch failed');
      }
      const arrayBuffer = await fallbackRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', fallbackRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(buffer);
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch (error: any) {
    return res.status(500).send(`Image proxy error: ${error.message}`);
  }
}
