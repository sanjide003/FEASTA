export const MAX_IMAGE_BYTES = 200 * 1024;
export const MAX_IMAGE_LABEL = 'Images larger than 200 KB are compressed automatically before saving.';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const OUTPUT_TYPE = 'image/webp';

export function validateImageFile(file: File | null | undefined): string {
  if (!file) return 'Choose an image file.';
  if (!ALLOWED_TYPES.has(file.type)) return 'Only JPG, PNG, WebP and GIF images are allowed.';
  return '';
}

const readDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.readAsDataURL(file);
  });

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read compressed image'));
    reader.readAsDataURL(blob);
  });

const decodeImage = (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected image could not be read.'));
    };
    image.src = url;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, OUTPUT_TYPE, quality));

export async function compressImageFile(file: File): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  if (file.size <= MAX_IMAGE_BYTES) return readDataUrl(file);
  const source = await decodeImage(file);
  let scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  let width = Math.max(1, Math.round(source.width * scale));
  let height = Math.max(1, Math.round(source.height * scale));
  let quality = 0.88;
  let blob: Blob | null = null;

  for (let pass = 0; pass < 14; pass += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(source, 0, 0, width, height);
    blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_IMAGE_BYTES) break;
    if (quality > 0.5) quality -= 0.08;
    else {
      width = Math.max(320, Math.round(width * 0.84));
      height = Math.max(320, Math.round(height * 0.84));
      quality = 0.78;
    }
  }

  if ('close' in source && typeof source.close === 'function') source.close();
  if (!blob || blob.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} could not be compressed below 200 KB. Try a smaller image.`);
  }
  return blobToDataUrl(blob);
}

export function normalizeGallerySlots(value: unknown): string[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) values = value;
  else {
    try {
      const parsed = JSON.parse(String(value || ''));
      values = Array.isArray(parsed) ? parsed : [];
    } catch {
      values = String(value || '').split(/\r?\n/);
    }
  }
  const slots = values.map((item) => String(item || '').trim());
  while (slots.length && !slots[slots.length - 1]) slots.pop();
  return slots;
}

export function assertPayloadSize(payload: unknown, label = 'settings') {
  if (new Blob([JSON.stringify(payload)]).size > 900 * 1024) {
    throw new Error(`${label} contains too many images for one Firestore document. Remove one or more images.`);
  }
}
