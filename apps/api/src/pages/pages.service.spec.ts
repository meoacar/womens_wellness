import { ConflictException, NotFoundException } from '@nestjs/common';
import { PagesService } from './pages.service';

describe('PagesService', () => {
  const createPrismaMock = () => ({
    page: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
  });

  it('throws ConflictException when creating a page with an existing slug', async () => {
    const prisma = createPrismaMock();
    prisma.page.findUnique.mockResolvedValue({ id: 'page-1' });
    const service = new PagesService(prisma as any);

    await expect(
      service.create({
        slug: ' KVKK-Aydinlatma-Metni ',
        titleTr: 'KVKK',
        contentTr: 'İçerik',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.page.findUnique).toHaveBeenCalledWith({
      where: { slug: 'kvkk-aydinlatma-metni' },
      select: { id: true },
    });
    expect(prisma.page.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException on Prisma P2002 during create', async () => {
    const prisma = createPrismaMock();
    prisma.page.findUnique.mockResolvedValue(null);
    prisma.page.create.mockRejectedValue({ code: 'P2002' });
    const service = new PagesService(prisma as any);

    await expect(
      service.create({
        slug: 'yeni-sayfa',
        titleTr: 'Yeni Sayfa',
        contentTr: 'İçerik',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when updating a page to a slug owned by another page', async () => {
    const prisma = createPrismaMock();
    prisma.page.findUnique
      .mockResolvedValueOnce({ id: 'page-1', slug: 'eski-slug' }) // findById
      .mockResolvedValueOnce({ id: 'page-2' }); // ensureSlugAvailable

    const service = new PagesService(prisma as any);

    await expect(
      service.update('page-1', {
        slug: 'kvkk-aydinlatma-metni',
        titleTr: 'Güncel Başlık',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.page.update).not.toHaveBeenCalled();
  });

  it('allows updating a page with its own slug and ignores unexpected fields', async () => {
    const prisma = createPrismaMock();
    prisma.page.findUnique
      .mockResolvedValueOnce({ id: 'page-1', slug: 'kvkk-aydinlatma-metni' }) // findById
      .mockResolvedValueOnce({ id: 'page-1' }); // ensureSlugAvailable
    prisma.page.update.mockResolvedValue({ id: 'page-1', slug: 'kvkk-aydinlatma-metni' });

    const service = new PagesService(prisma as any);

    await service.update('page-1', {
      slug: ' KVKK-Aydinlatma-Metni ',
      titleTr: 'KVKK Aydınlatma ve Açık Rıza Metni',
      isActive: true,
      sortOrder: 3,
      id: 'injected-id',
    } as any);

    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      data: {
        slug: 'kvkk-aydinlatma-metni',
        titleTr: 'KVKK Aydınlatma ve Açık Rıza Metni',
        isActive: true,
        sortOrder: 3,
      },
    });
  });

  it('throws NotFoundException when updating a non-existent page', async () => {
    const prisma = createPrismaMock();
    prisma.page.findUnique.mockResolvedValue(null);
    const service = new PagesService(prisma as any);

    await expect(service.update('missing-id', { titleTr: 'Test' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
