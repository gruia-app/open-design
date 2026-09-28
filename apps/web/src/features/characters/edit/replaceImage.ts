// Rasterize a user-picked frame image to PNG before it enters the edit
// history. The canonical frame src ends in `.png`, so the stored bytes must
// really be PNG — a picked JPEG/WebP would otherwise be saved under a `.png`
// name and consumers keyed on extension would fail to open it. Only the
// raster types the export path supports are accepted; anything else is
// refused before decode, and undecodable files fail here rather than inside
// the engine.

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** `accept=` list for the file picker — mirrors ACCEPTED_TYPES. */
export const REPLACE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('not an image'));
      img.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Returns the PNG blob, or null when the type is not accepted or the image
 *  cannot be decoded/encoded. Never throws — the caller maps null to the
 *  inline replace error. */
export async function replaceFileToPng(file: Blob): Promise<Blob | null> {
  if (!ACCEPTED_TYPES.has(file.type)) return null;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = await decodeImage(file);
    try {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image.source, 0, 0);
    } finally {
      image.close();
    }
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}
