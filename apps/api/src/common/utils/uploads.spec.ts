import * as path from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';
import {
  detectImageFormatByMagicBytes,
  generateSafeUploadFilename,
  MAX_UPLOAD_IMAGE_BYTES,
  readStreamWithLimit,
  resolveUploadsDir,
  sanitizeAndReencodeProfileImage,
} from './uploads';

describe('uploads security utilities', () => {
  describe('resolveUploadsDir', () => {
    it('uses UPLOADS_DIR when configured', () => {
      expect(resolveUploadsDir({ UPLOADS_DIR: '/app/apps/api/uploads' } as any)).toBe(
        path.resolve('/app/apps/api/uploads'),
      );
    });

    it('defaults to <cwd>/uploads when UPLOADS_DIR is not set', () => {
      expect(resolveUploadsDir({} as any)).toBe(path.join(process.cwd(), 'uploads'));
    });
  });

  describe('detectImageFormatByMagicBytes', () => {
    it('rejects HTML, SVG, text, and short buffers', () => {
      expect(detectImageFormatByMagicBytes(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
      expect(detectImageFormatByMagicBytes(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
      expect(detectImageFormatByMagicBytes(Buffer.from('short'))).toBeNull();
    });

    it('detects JPEG, PNG, GIF, and WebP signatures', async () => {
      const png = await sharp({
        create: { width: 8, height: 8, channels: 4, background: { r: 255, g: 0, b: 128, alpha: 1 } },
      })
        .png()
        .toBuffer();
      const jpeg = await sharp(png).removeAlpha().jpeg().toBuffer();
      const webp = await sharp(png).webp().toBuffer();
      const gif = await sharp(png).gif().toBuffer();

      expect(detectImageFormatByMagicBytes(png)).toBe('png');
      expect(detectImageFormatByMagicBytes(jpeg)).toBe('jpeg');
      expect(detectImageFormatByMagicBytes(webp)).toBe('webp');
      expect(detectImageFormatByMagicBytes(gif)).toBe('gif');
    });
  });

  describe('generateSafeUploadFilename', () => {
    it('produces random hex filenames with server-controlled extension', () => {
      const jpgName = generateSafeUploadFilename('jpg');
      const pngName = generateSafeUploadFilename('png');

      expect(jpgName).toMatch(/^[a-f0-9]{32}\.jpg$/);
      expect(pngName).toMatch(/^[a-f0-9]{32}\.png$/);
    });
  });

  describe('readStreamWithLimit', () => {
    it('reads stream within limit', async () => {
      const stream = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
      const buf = await readStreamWithLimit(stream, 100);
      expect(buf.toString()).toBe('hello world');
    });

    it('rejects stream exceeding maxBytes or marked truncated', async () => {
      const oversized = Readable.from([Buffer.alloc(60), Buffer.alloc(60)]);
      await expect(readStreamWithLimit(oversized, 100)).rejects.toThrow('exceeds maximum allowed size');

      const truncatedStream = Readable.from([Buffer.from('ok')]) as Readable & { truncated?: boolean };
      truncatedStream.truncated = true;
      await expect(readStreamWithLimit(truncatedStream, 100)).rejects.toThrow('exceeds maximum allowed size');
    });
  });

  describe('sanitizeAndReencodeProfileImage', () => {
    it('re-encodes JPEG and strips EXIF + appended polyglot payload', async () => {
      const baseJpeg = await sharp({
        create: { width: 32, height: 32, channels: 3, background: { r: 240, g: 120, b: 180 } },
      })
        .withExif({ IFD0: { ImageDescription: '<script>alert("xss")</script>' } })
        .jpeg()
        .toBuffer();

      const polyglot = Buffer.concat([baseJpeg, Buffer.from('<script>evil()</script>')]);
      const result = await sanitizeAndReencodeProfileImage(polyglot);

      expect(result.extension).toBe('jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(detectImageFormatByMagicBytes(result.buffer)).toBe('jpeg');
      expect(result.buffer.includes(Buffer.from('<script>evil()</script>'))).toBe(false);
      expect(result.buffer.includes(Buffer.from('alert("xss")'))).toBe(false);

      const outMeta = await sharp(result.buffer).metadata();
      expect(outMeta.format).toBe('jpeg');
      expect(outMeta.exif).toBeUndefined();
    });

    it('re-encodes PNG and strips trailing polyglot data', async () => {
      const basePng = await sharp({
        create: { width: 16, height: 16, channels: 4, background: { r: 20, g: 30, b: 40, alpha: 0.5 } },
      })
        .png()
        .toBuffer();

      const polyglot = Buffer.concat([basePng, Buffer.from('<?php system($_GET["c"]); ?>')]);
      const result = await sanitizeAndReencodeProfileImage(polyglot);

      expect(result.extension).toBe('png');
      expect(result.mimeType).toBe('image/png');
      expect(detectImageFormatByMagicBytes(result.buffer)).toBe('png');
      expect(result.buffer.includes(Buffer.from('system($_GET'))).toBe(false);
    });

    it('re-encodes valid WebP to safe image', async () => {
      const webp = await sharp({
        create: { width: 20, height: 20, channels: 3, background: { r: 100, g: 200, b: 150 } },
      })
        .webp()
        .toBuffer();

      const result = await sanitizeAndReencodeProfileImage(webp);
      expect(['jpg', 'png']).toContain(result.extension);
      expect(result.width).toBe(20);
      expect(result.height).toBe(20);
    });

    it('rejects HTML/SVG payloads and corrupted files with image magic bytes', async () => {
      await expect(
        sanitizeAndReencodeProfileImage(Buffer.from('<html><body>xss</body></html>')),
      ).rejects.toThrow();

      await expect(
        sanitizeAndReencodeProfileImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
      ).rejects.toThrow();

      const fakePng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('not-actually-a-png-stream'),
      ]);
      await expect(sanitizeAndReencodeProfileImage(fakePng)).rejects.toThrow();
    });

    it('rejects buffers exceeding MAX_UPLOAD_IMAGE_BYTES', async () => {
      const tooBig = Buffer.alloc(MAX_UPLOAD_IMAGE_BYTES + 1);
      await expect(sanitizeAndReencodeProfileImage(tooBig)).rejects.toThrow('exceeds maximum allowed size');
    });
  });
});
