import { toPng, toBlob } from 'html-to-image';
import JSZip from 'jszip';

/**
 * Capture an HTMLElement as high-res PNG (1080x1920)
 * Uses skipFonts: true to prevent SecurityError when inspecting cross-origin Google Fonts stylesheets.
 */
export async function captureSlideAsBlob(element: HTMLElement, pixelRatio: number = 2): Promise<Blob> {
  try {
    const blob = await toBlob(element, {
      quality: 0.98,
      pixelRatio: pixelRatio,
      cacheBust: false,
      skipFonts: true,
      style: {
        transform: 'none',
        transformOrigin: 'top left'
      }
    });

    if (blob) {
      return blob;
    }
  } catch (err) {
    console.warn('captureSlideAsBlob standard attempt warning:', err);
  }

  // Robust fallback via toPng
  const dataUrl = await toPng(element, {
    quality: 0.98,
    pixelRatio: pixelRatio,
    cacheBust: false,
    skipFonts: true,
    style: {
      transform: 'none',
      transformOrigin: 'top left'
    }
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (!blob) {
    throw new Error('Failed to generate image blob');
  }
  return blob;
}

/**
 * Download a single slide as PNG
 */
export async function downloadSlideAsPng(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(element, {
    quality: 0.98,
    pixelRatio: 3,
    cacheBust: false,
    skipFonts: true,
    style: {
      transform: 'none',
      transformOrigin: 'top left'
    }
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Copy slide directly to system clipboard
 */
export async function copySlideImageToClipboard(element: HTMLElement): Promise<boolean> {
  try {
    const blob = await captureSlideAsBlob(element, 2.5);
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ]);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Download all slides as a single ZIP package
 */
export async function downloadAllSlidesZip(
  slideElements: HTMLElement[],
  recipeSlug: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(`${recipeSlug}-carousel`);

  for (let i = 0; i < slideElements.length; i++) {
    onProgress?.(Math.round(((i + 1) / slideElements.length) * 80));
    const blob = await captureSlideAsBlob(slideElements[i], 3);
    folder?.file(`slide-${i + 1}-${i === 0 ? 'hook' : i === 1 ? 'recipe' : 'cta'}.png`, blob);
  }

  onProgress?.(90);
  const content = await zip.generateAsync({ type: 'blob' });
  onProgress?.(100);

  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${recipeSlug}-slides.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Create a video slideshow (WebM/MP4) matching YouTube Shorts & mobile specifications
 * - 60 FPS buttery smooth transitions
 * - 16 Mbps high bitrate for crisp text and vivid food textures
 * - Dynamic pacing (Hook 2.5s -> Recipe 5.0s -> CTA 1.5s = 9.0s total)
 * - Seamless loop (Slide 3 transitions back into Slide 1 at the end)
 */
export async function createSlideshowVideo(
  slideElements: HTMLElement[],
  slideDurations: number | number[] = [2.5, 5.0, 1.5],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const numSlides = slideElements.length;
  // Capture all slides as Image objects first with 3.0 pixelRatio for true HD
  const images: HTMLImageElement[] = [];
  for (let i = 0; i < numSlides; i++) {
    onProgress?.(Math.round(((i + 1) / numSlides) * 35));
    const dataUrl = await toPng(slideElements[i], { pixelRatio: 3.0, cacheBust: false, skipFonts: true });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    images.push(img);
  }

  // Setup canvas matching the exact captured slide dimensions (1080x1920)
  const canvasWidth = images[0]?.naturalWidth || 1080;
  const canvasHeight = images[0]?.naturalHeight || 1920;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const fps = 60; // 60 FPS for ultra-smooth playback
  const frameDurationMs = 1000 / fps; // 16.66ms per frame
  const transitionFrames = Math.round(fps * 0.4); // 0.4s smooth swipe transition (24 frames)

  // Calculate per-slide frame allocations based on dynamic pacing
  const durationsArray = Array.isArray(slideDurations)
    ? slideDurations
    : Array(numSlides).fill(slideDurations);

  const slideFrameCounts: number[] = [];
  for (let i = 0; i < numSlides; i++) {
    const sec = durationsArray[i] ?? (i === 0 ? 2.5 : i === 1 ? 5.0 : 1.5);
    slideFrameCounts.push(Math.round(fps * sec));
  }

  // Build cumulative frame boundaries: [0, 150, 450, 540]
  const slideStartFrames: number[] = [0];
  for (let i = 0; i < numSlides; i++) {
    slideStartFrames.push(slideStartFrames[i] + slideFrameCounts[i]);
  }
  const totalFrames = slideStartFrames[numSlides];

  // Stream canvas
  const stream = canvas.captureStream(fps);
  
  const preferredTypes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  let mimeType = 'video/webm';
  for (const type of preferredTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: 16000000 // 16 Mbps ultra high quality for YouTube compression resilience
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    mediaRecorder.onerror = (err) => reject(err);

    mediaRecorder.start();

    let frame = 0;

    // Use setInterval for real-time 60fps frame pacing
    const intervalId = setInterval(() => {
      if (frame >= totalFrames) {
        clearInterval(intervalId);
        mediaRecorder.stop();
        return;
      }

      // Determine current slide
      let currentSlideIdx = 0;
      for (let i = 0; i < numSlides; i++) {
        if (frame >= slideStartFrames[i] && frame < slideStartFrames[i + 1]) {
          currentSlideIdx = i;
          break;
        }
      }

      const frameInSlide = frame - slideStartFrames[currentSlideIdx];
      const slideDurationFrames = slideFrameCounts[currentSlideIdx];
      const nextSlideIdx = (currentSlideIdx + 1) % numSlides;

      const currentImg = images[currentSlideIdx];
      const nextImg = images[nextSlideIdx];

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Check if we are in the transition zone (last N frames of current slide)
      const transitionStartFrame = slideDurationFrames - transitionFrames;
      if (frameInSlide >= transitionStartFrame) {
        // Smooth slide-in from right transition curve (easeOutCubic)
        const progress = (frameInSlide - transitionStartFrame) / transitionFrames;
        const ease = 1 - Math.pow(1 - progress, 3);
        const offsetX = ease * canvasWidth;

        // Draw current slide moving left
        ctx.drawImage(currentImg, -offsetX, 0, canvasWidth, canvasHeight);
        // Draw next slide entering from right (including Slide 3 -> Slide 1 for seamless infinite loop!)
        ctx.drawImage(nextImg, canvasWidth - offsetX, 0, canvasWidth, canvasHeight);
      } else {
        // Static frame display
        ctx.drawImage(currentImg, 0, 0, canvasWidth, canvasHeight);
      }

      frame++;
      onProgress?.(35 + Math.round((frame / totalFrames) * 60));
    }, frameDurationMs);
  });
}
