import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';
import { UsersController } from './users.controller';

describe('UsersController.uploadProfilePicture', () => {
  let tempDir: string;
  const originalUploadsDir = process.env.UPLOADS_DIR;
  const originalApiBaseUrl = process.env.API_BASE_URL;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wellness-upload-test-'));
    process.env.UPLOADS_DIR = tempDir;
    process.env.API_BASE_URL = 'https://api.kadinatlasi.com';
  });

  afterEach(() => {
    process.env.UPLOADS_DIR = originalUploadsDir;
    process.env.API_BASE_URL = originalApiBaseUrl;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('ignores client filename/mimetype, re-encodes real PNG, and stores under UPLOADS_DIR/profiles', async () => {
    const validPng = await sharp({
      create: { width: 16, height: 16, channels: 4, background: { r: 233, g: 30, b: 99, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const usersService = {
      saveUploadedProfilePicture: jest
        .fn()
        .mockResolvedValue({ profilePictureUrl: 'ok' }),
    } as any;

    const controller = new UsersController(usersService);
    const req = {
      file: jest.fn().mockResolvedValue({
        mimetype: 'image/jpeg',
        filename: '../../evil.html',
        file: Readable.from([validPng]),
      }),
    };

    const res = await controller.uploadProfilePicture({ id: 'user-1' }, req);

    expect(res.profilePictureUrl).toMatch(
      /^https:\/\/api\.kadinatlasi\.com\/uploads\/profiles\/[a-f0-9]{32}\.png$/,
    );
    const savedFilename = res.profilePictureUrl.split('/').pop()!;
    expect(usersService.saveUploadedProfilePicture).toHaveBeenCalledWith('user-1', {
      relativePath: `profiles/${savedFilename}`,
      mimeType: 'image/png',
      sizeBytes: expect.any(Number),
      profilePictureUrl: res.profilePictureUrl,
    });

    const savedPath = path.join(tempDir, 'profiles', savedFilename);
    expect(fs.existsSync(savedPath)).toBe(true);

    const savedMeta = await sharp(fs.readFileSync(savedPath)).metadata();
    expect(savedMeta.format).toBe('png');
  });

  it('rejects non-image payload claiming image/png and writes nothing to disk', async () => {
    const usersService = { saveUploadedProfilePicture: jest.fn() } as any;
    const controller = new UsersController(usersService);

    const req = {
      file: jest.fn().mockResolvedValue({
        mimetype: 'image/png',
        filename: 'avatar.png',
        file: Readable.from([Buffer.from('<html><script>alert(1)</script></html>')]),
      }),
    };

    await expect(controller.uploadProfilePicture({ id: 'user-1' }, req)).rejects.toThrow(
      BadRequestException,
    );
    expect(usersService.saveUploadedProfilePicture).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tempDir, 'profiles'))).toBe(false);
  });

  it('removes written file if saveUploadedProfilePicture fails', async () => {
    const validJpeg = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 100, b: 150 } },
    })
      .jpeg()
      .toBuffer();

    const usersService = {
      saveUploadedProfilePicture: jest.fn().mockRejectedValue(new Error('DB write error')),
    } as any;
    const controller = new UsersController(usersService);

    const req = {
      file: jest.fn().mockResolvedValue({
        mimetype: 'image/jpeg',
        filename: 'photo.jpg',
        file: Readable.from([validJpeg]),
      }),
    };

    await expect(controller.uploadProfilePicture({ id: 'user-1' }, req)).rejects.toThrow(
      BadRequestException,
    );

    const profilesDir = path.join(tempDir, 'profiles');
    expect(fs.readdirSync(profilesDir)).toEqual([]);
  });
});
