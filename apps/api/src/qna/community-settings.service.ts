import { Injectable } from '@nestjs/common';
import { QuestionCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const COMMUNITY_SETTINGS_FLAG_KEY = 'community_settings';

export interface CommunitySettings {
  allowNewQuestions: boolean;
  freeMonthlyQuestionLimit: number;
  premiumMonthlyQuestionLimit: number;
  dailyQuestionLimit: number;
  titleMinLength: number;
  titleMaxLength: number;
  contentMinLength: number;
  contentMaxLength: number;
  maxTags: number;
  allowAnonymous: boolean;
  enabledCategories: QuestionCategory[];
  pointsPerQuestion: number;
  pointsPerAnswer: number;
  pointsPerBestAnswer: number;
  xpPerReputationPoint: number;
  askPageBannerTitle: string;
  askPageBannerSubtitle: string;
}

export const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = {
  allowNewQuestions: true,
  freeMonthlyQuestionLimit: 5,
  premiumMonthlyQuestionLimit: 20,
  dailyQuestionLimit: 3,
  titleMinLength: 10,
  titleMaxLength: 200,
  contentMinLength: 20,
  contentMaxLength: 3000,
  maxTags: 5,
  allowAnonymous: true,
  enabledCategories: Object.values(QuestionCategory),
  pointsPerQuestion: 5,
  pointsPerAnswer: 10,
  pointsPerBestAnswer: 25,
  xpPerReputationPoint: 1,
  askPageBannerTitle: 'Topluluğa Sorunu Paylaş',
  askPageBannerSubtitle:
    'Deneyimlerini paylaş, uzmanlardan ve topluluktan destek al. İstersen tamamen anonim sorabilirsin.',
};

@Injectable()
export class CommunitySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(raw: Partial<CommunitySettings> | null | undefined): CommunitySettings {
    const src = raw || {};
    const titleMin = Math.max(3, Math.min(100, Number(src.titleMinLength ?? DEFAULT_COMMUNITY_SETTINGS.titleMinLength)));
    const titleMax = Math.max(titleMin + 10, Math.min(300, Number(src.titleMaxLength ?? DEFAULT_COMMUNITY_SETTINGS.titleMaxLength)));
    const contentMin = Math.max(5, Math.min(500, Number(src.contentMinLength ?? DEFAULT_COMMUNITY_SETTINGS.contentMinLength)));
    const contentMax = Math.max(contentMin + 20, Math.min(10000, Number(src.contentMaxLength ?? DEFAULT_COMMUNITY_SETTINGS.contentMaxLength)));

    const validCategories = Object.values(QuestionCategory);
    const enabledCategories = Array.isArray(src.enabledCategories) && src.enabledCategories.length > 0
      ? src.enabledCategories.filter((c): c is QuestionCategory => validCategories.includes(c))
      : DEFAULT_COMMUNITY_SETTINGS.enabledCategories;

    return {
      allowNewQuestions: src.allowNewQuestions ?? DEFAULT_COMMUNITY_SETTINGS.allowNewQuestions,
      freeMonthlyQuestionLimit: Math.max(1, Math.min(500, Number(src.freeMonthlyQuestionLimit ?? DEFAULT_COMMUNITY_SETTINGS.freeMonthlyQuestionLimit))),
      premiumMonthlyQuestionLimit: Math.max(1, Math.min(1000, Number(src.premiumMonthlyQuestionLimit ?? DEFAULT_COMMUNITY_SETTINGS.premiumMonthlyQuestionLimit))),
      dailyQuestionLimit: Math.max(1, Math.min(50, Number(src.dailyQuestionLimit ?? DEFAULT_COMMUNITY_SETTINGS.dailyQuestionLimit))),
      titleMinLength: titleMin,
      titleMaxLength: titleMax,
      contentMinLength: contentMin,
      contentMaxLength: contentMax,
      maxTags: Math.max(0, Math.min(10, Number(src.maxTags ?? DEFAULT_COMMUNITY_SETTINGS.maxTags))),
      allowAnonymous: src.allowAnonymous ?? DEFAULT_COMMUNITY_SETTINGS.allowAnonymous,
      enabledCategories: enabledCategories.length > 0 ? enabledCategories : validCategories,
      pointsPerQuestion: Math.max(0, Math.min(100, Number(src.pointsPerQuestion ?? DEFAULT_COMMUNITY_SETTINGS.pointsPerQuestion))),
      pointsPerAnswer: Math.max(0, Math.min(100, Number(src.pointsPerAnswer ?? DEFAULT_COMMUNITY_SETTINGS.pointsPerAnswer))),
      pointsPerBestAnswer: Math.max(0, Math.min(200, Number(src.pointsPerBestAnswer ?? DEFAULT_COMMUNITY_SETTINGS.pointsPerBestAnswer))),
      xpPerReputationPoint: Math.max(0, Math.min(10, Number(src.xpPerReputationPoint ?? DEFAULT_COMMUNITY_SETTINGS.xpPerReputationPoint))),
      askPageBannerTitle:
        typeof src.askPageBannerTitle === 'string' && src.askPageBannerTitle.trim()
          ? src.askPageBannerTitle.trim()
          : DEFAULT_COMMUNITY_SETTINGS.askPageBannerTitle,
      askPageBannerSubtitle:
        typeof src.askPageBannerSubtitle === 'string' && src.askPageBannerSubtitle.trim()
          ? src.askPageBannerSubtitle.trim()
          : DEFAULT_COMMUNITY_SETTINGS.askPageBannerSubtitle,
    };
  }

  async getSettings(): Promise<CommunitySettings> {
    const record = await this.prisma.featureFlag.findUnique({
      where: { key: COMMUNITY_SETTINGS_FLAG_KEY },
    });
    return this.normalize((record?.valueJson as Partial<CommunitySettings>) || null);
  }

  async updateSettings(patch: Partial<CommunitySettings>): Promise<CommunitySettings> {
    const current = await this.getSettings();
    const merged = this.normalize({ ...current, ...patch });

    await this.prisma.featureFlag.upsert({
      where: { key: COMMUNITY_SETTINGS_FLAG_KEY },
      update: { valueJson: merged as any },
      create: {
        key: COMMUNITY_SETTINGS_FLAG_KEY,
        valueJson: merged as any,
      },
    });

    return merged;
  }
}
