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
 * Create a video slideshow (WebM/MP4) matching the exact phone bezel preview
 */
export async function createSlideshowVideo(
  slideElements: HTMLElement[],
  slideDurationSec: number = 3.5,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  // Capture all slides as Image objects first with high pixelRatio for true HD
  const images: HTMLImageElement[] = [];
  for (let i = 0; i < slideElements.length; i++) {
    onProgress?.(Math.round(((i + 1) / slideElements.length) * 40));
    const dataUrl = await toPng(slideElements[i], { pixelRatio: 2.5, cacheBust: false, skipFonts: true });
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
  const ctx = canvas.getContext('2d')!;

  const fps = 30;
  const totalFramesPerSlide = fps * slideDurationSec;
  const transitionFrames = Math.round(fps * 0.35); // 0.35s smooth mobile swipe transition
  const totalSlides = images.length;
  const totalFrames = totalFramesPerSlide * totalSlides;

  // Stream canvas
  const stream = canvas.captureStream(fps);
  
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4';
  }

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: 8000000 // 8 Mbps high quality
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

    const renderFrame = () => {
      if (frame >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const currentSlideIdx = Math.floor(frame / totalFramesPerSlide);
      const frameInSlide = frame % totalFramesPerSlide;
      const nextSlideIdx = (currentSlideIdx + 1) % totalSlides;

      const currentImg = images[currentSlideIdx];
      const nextImg = images[nextSlideIdx];

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Check if we are in the transition zone (last N frames of current slide)
      const transitionStartFrame = totalFramesPerSlide - transitionFrames;
      if (frameInSlide >= transitionStartFrame && currentSlideIdx < totalSlides - 1) {
        // Smooth slide-in from right transition curve (easeOutCubic)
        const progress = (frameInSlide - transitionStartFrame) / transitionFrames;
        const ease = 1 - Math.pow(1 - progress, 3);
        const offsetX = ease * canvasWidth;

        // Draw current slide moving left
        ctx.drawImage(currentImg, -offsetX, 0, canvasWidth, canvasHeight);
        // Draw next slide entering from right
        ctx.drawImage(nextImg, canvasWidth - offsetX, 0, canvasWidth, canvasHeight);
      } else {
        // Static frame display
        ctx.drawImage(currentImg, 0, 0, canvasWidth, canvasHeight);
      }

      frame++;
      onProgress?.(40 + Math.round((frame / totalFrames) * 55));
      requestAnimationFrame(renderFrame);
    };

    renderFrame();
  });
}
