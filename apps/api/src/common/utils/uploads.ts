import * as crypto from 'crypto';
import * as path from 'path';
import type sharpType from 'sharp';
import * as sharpNamespace from 'sharp';

const sharp: typeof sharpType =
  (sharpNamespace as any).default ?? (sharpNamespace as any);

export const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_UPLOAD_IMAGE_DIMENSION = 8192;
export const MAX_UPLOAD_IMAGE_PIXELS = 36_000_000;
export const PROFILE_IMAGE_MAX_DIMENSION = 512;

export type DetectedImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'heif' | 'avif';
export type SafeOutputExtension = 'jpg' | 'png';

export interface ReencodedImageResult {
  buffer: Buffer;
  extension: SafeOutputExtension;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

/**
 * Resolves the persistent uploads root directory consistently across static serving
 * and file upload handlers.
 */
export function resolveUploadsDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.UPLOADS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), 'uploads');
}

/**
 * Inspects file header magic bytes instead of trusting client-supplied MIME types or extensions.
 */
export function detectImageFormatByMagicBytes(
  buffer: Buffer,
): DetectedImageFormat | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // GIF: GIF87a or GIF89a
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'gif';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  // ISO BMFF (HEIC / HEIF / AVIF): ....ftyp(heic|heix|hevc|hevx|mif1|msf1|avif|avis)
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['avif', 'avis'].includes(brand)) {
      return 'avif';
    }
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return 'heif';
    }
  }

  return null;
}

/**
 * Generates an opaque, cryptographically random filename with a server-controlled extension.
 */
export function generateSafeUploadFilename(extension: SafeOutputExtension): string {
  return `${crypto.randomBytes(16).toString('hex')}.${extension}`;
}

/**
 * Buffers a multipart file stream in memory while enforcing a hard byte ceiling.
 */
export async function readStreamWithLimit(
  stream: AsyncIterable<Buffer | string> & { truncated?: boolean },
  maxBytes: number = MAX_UPLOAD_IMAGE_BYTES,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new Error(`Uploaded file exceeds maximum allowed size of ${maxBytes} bytes`);
    }
    chunks.push(buf);
  }

  if (stream.truncated) {
    throw new Error(`Uploaded file exceeds maximum allowed size of ${maxBytes} bytes`);
  }

  return Buffer.concat(chunks);
}

/**
 * Decodes untrusted image bytes and re-encodes them into a clean JPEG/PNG image,
 * stripping EXIF/comments/polyglot payloads and rejecting malformed or non-image content.
 */
export async function sanitizeAndReencodeProfileImage(
  inputBuffer: Buffer,
): Promise<ReencodedImageResult> {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('Uploaded file is empty');
  }

  if (inputBuffer.length > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error(`Uploaded file exceeds maximum allowed size of ${MAX_UPLOAD_IMAGE_BYTES} bytes`);
  }

  const detectedFormat = detectImageFormatByMagicBytes(inputBuffer);
  if (!detectedFormat) {
    throw new Error('Invalid image file signature');
  }

  const metadata = await sharp(inputBuffer, {
    limitInputPixels: MAX_UPLOAD_IMAGE_PIXELS,
    failOn: 'none',
  }).metadata();

  if (
    !metadata.format ||
    !['jpeg', 'png', 'webp', 'gif', 'heif', 'avif'].includes(metadata.format)
  ) {
    throw new Error('Decoded image format is not supported');
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 1 ||
    metadata.height < 1 ||
    metadata.width > MAX_UPLOAD_IMAGE_DIMENSION ||
    metadata.height > MAX_UPLOAD_IMAGE_DIMENSION
  ) {
    throw new Error('Image dimensions are invalid or exceed allowed limits');
  }

  // Fully decode pixels and re-encode without metadata/EXIF/polyglot data
  const pipeline = sharp(inputBuffer, {
    limitInputPixels: MAX_UPLOAD_IMAGE_PIXELS,
    failOn: 'none',
  })
    .rotate()
    .resize({
      width: PROFILE_IMAGE_MAX_DIMENSION,
      height: PROFILE_IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const preserveAlpha = metadata.format === 'png' || Boolean(metadata.hasAlpha);

  if (preserveAlpha) {
    const { data, info } = await pipeline
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      extension: 'png',
      mimeType: 'image/png',
      width: info.width,
      height: info.height,
    };
  }

  const { data, info } = await pipeline
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    extension: 'jpg',
    mimeType: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}
