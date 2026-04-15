// Downscale + re-encode an image on the client so Vercel's 4.5MB serverless
// body limit doesn't reject Samsung Motion Photos, HEIC from iPhones, or
// just oversized original camera shots.
//
// Reading the file into an <img> and drawing it to a canvas also strips
// the embedded video portion of a Samsung Motion Photo (the canvas only
// sees the still frame), which is the specific bug this function fixes.

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<Blob> {
  // Small files skip the roundtrip entirely.
  if (file.size < 1_500_000 && file.type === "image/jpeg") {
    return file;
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Can't compress — fall back to the original and hope it's under limit.
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) return file;
  return blob;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap handles most formats including HEIC on recent browsers
  // and handles EXIF rotation automatically when imageOrientation is set.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback: decode via an <img> element. Works for old browsers that
    // don't implement createImageBitmap with the orientation option.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image decode failed"));
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function fitWithin(w: number, h: number, maxEdge: number) {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
