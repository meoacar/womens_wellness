/**
 * Subscription Type Definitions
 */

export type SubscriptionStatus =
    | 'FREE'
    | 'TRIAL'
    | 'ACTIVE'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'GRACE_PERIOD';

export type SubscriptionTier = 'MONTHLY' | 'YEARLY';

export type PaymentProvider = 'APPLE' | 'GOOGLE';

export type TransactionStatus =
    | 'PENDING'
    | 'COMPLETED'
    | 'FAILED'
    | 'REFUNDED'
    | 'CANCELLED';

export type TransactionType =
    | 'INITIAL_PURCHASE'
    | 'RENEWAL'
    | 'UPGRADE'
    | 'DOWNGRADE'
    | 'REFUND';

export interface SubscriptionFeatures {
    advancedAI: boolean;
    priorityResponse: boolean;
    insights: boolean;
    advancedAnalytics: boolean;
    customization: boolean;
}

export interface Subscription {
    status: SubscriptionStatus;
    tier?: SubscriptionTier;
    startDate?: string;
    endDate?: string;
    trialEndDate?: string;
    cancelledAt?: string;
    isInGracePeriod: boolean;
    gracePeriodEndDate?: string;
    aiMessagesUsed: number;
    aiMessagesLimit: number;
    quotaResetDate: string;
    hasHadTrial: boolean;
    features: SubscriptionFeatures;
}

export interface Product {
    productId: string;
    title: string;
    description: string;
    price: string;
    currency: string;
    localizedPrice: string;
    tier: SubscriptionTier;
    trialPeriod?: string;
}

export interface Transaction {
    id: string;
    transactionId: string;
    productId: string;
    amount: number;
    currency: string;
    status: TransactionStatus;
    type: TransactionType;
    createdAt: string;
}

export interface Quota {
    used: number;
    limit: number;
    remaining: number;
    resetDate: string;
    percentage: number;
}

export interface UsageStats {
    totalMessages: number;
    premiumFeaturesUsed: Array<{
        feature: string;
        count: number;
    }>;
    timeSaved: number; // in minutes
    insightsGenerated: number;
    memberSince: string;
    currentStreak: number;
    longestStreak?: number;
    totalDataEntries?: number;
    completedBadges?: number;
}

export interface PremiumPlanConfig {
    tier: SubscriptionTier;
    isActive: boolean;
    title: string;
    subtitle: string;
    price: number;
    currency: string;
    currencySymbol: string;
    iosProductId: string;
    androidProductId: string;
    trialDays: number;
    badgeText?: string;
    savingsText?: string;
    features: string[];
}

export interface PremiumBenefitItem {
    id: string;
    icon: string;
    color: string;
    title: string;
    description: string;
    isActive: boolean;
}

export interface PremiumComparisonRow {
    id: string;
    icon: string;
    color: string;
    title: string;
    freeValue: string | boolean;
    premiumValue: string | boolean;
    isActive: boolean;
}

export interface PremiumFaqItem {
    id: string;
    question: string;
    answer: string;
    isActive: boolean;
}

export interface PremiumPaywallConfig {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    heroHighlights: string[];
    trialEnabled: boolean;
    trialTitle: string;
    trialDescription: string;
    ctaButtonText: string;
    ctaTrialButtonText: string;
    ctaFooterNote: string;
    defaultSelectedTier: SubscriptionTier;
    premiumAiMessageLimit: number;
    freeAiMessageLimit: number;
    plans: {
        MONTHLY: PremiumPlanConfig;
        YEARLY: PremiumPlanConfig;
    };
    benefits: PremiumBenefitItem[];
    comparisonRows: PremiumComparisonRow[];
    faqs: PremiumFaqItem[];
    updatedAt?: string;
}

export interface PurchaseRequest {
    receipt: string;
    provider: PaymentProvider;
    productId: string;
    transactionId: string;
    purchaseToken?: string;
}

export interface RestoreRequest {
    receipts: string[];
    provider: PaymentProvider;
}

/**
 * Feature gate constants
 */
export const FEATURES = {
    // Free features
    BASIC_CHAT: 'basic_chat',
    CYCLE_TRACKING: 'cycle_tracking',
    WATER_TRACKING: 'water_tracking',
    BASIC_REMINDERS: 'basic_reminders',

    // Premium features
    ADVANCED_AI: 'advanced_ai',
    PRIORITY_RESPONSE: 'priority_response',
    INSIGHTS: 'insights',
    ADVANCED_ANALYTICS: 'advanced_analytics',
    CUSTOMIZATION: 'customization',
    UNLIMITED_MESSAGES: 'unlimited_messages',
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];

/**
 * Helper function to check if a feature is premium
 */
export function isPremiumFeature(feature: Feature): boolean {
    const premiumFeatures: Feature[] = [
        FEATURES.ADVANCED_AI,
        FEATURES.PRIORITY_RESPONSE,
        FEATURES.INSIGHTS,
        FEATURES.ADVANCED_ANALYTICS,
        FEATURES.CUSTOMIZATION,
        FEATURES.UNLIMITED_MESSAGES,
    ];

    return premiumFeatures.includes(feature);
}

/**
 * Helper function to check if user can access a feature
 */
export function canAccessFeature(
    feature: Feature,
    subscription: Subscription
): boolean {
    if (!isPremiumFeature(feature)) {
        return true; // Free feature
    }

    return subscription.status === 'ACTIVE' || subscription.status === 'TRIAL';
}

/**
 * Helper function to get feature display name
 */
export function getFeatureDisplayName(feature: Feature): string {
    const displayNames: Record<Feature, string> = {
        [FEATURES.BASIC_CHAT]: 'Temel Sohbet',
        [FEATURES.CYCLE_TRACKING]: 'Adet Takibi',
        [FEATURES.WATER_TRACKING]: 'Su Takibi',
        [FEATURES.BASIC_REMINDERS]: 'Temel Hatırlatıcılar',
        [FEATURES.ADVANCED_AI]: 'Gelişmiş AI',
        [FEATURES.PRIORITY_RESPONSE]: 'Öncelikli Yanıt',
        [FEATURES.INSIGHTS]: 'Kişisel İçgörüler',
        [FEATURES.ADVANCED_ANALYTICS]: 'Gelişmiş Analizler',
        [FEATURES.CUSTOMIZATION]: 'Özelleştirme',
        [FEATURES.UNLIMITED_MESSAGES]: 'Sınırsız Mesaj',
    };

    return displayNames[feature] || feature;
}

/**
 * Helper function to get subscription status display name
 */
export function getSubscriptionStatusDisplayName(status: SubscriptionStatus): string {
    const displayNames: Record<SubscriptionStatus, string> = {
        FREE: 'Ücretsiz',
        TRIAL: 'Deneme',
        ACTIVE: 'Aktif',
        EXPIRED: 'Süresi Dolmuş',
        CANCELLED: 'İptal Edilmiş',
        GRACE_PERIOD: 'Ek Süre',
    };

    return displayNames[status];
}

/**
 * Helper function to get tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
    return tier === 'MONTHLY' ? 'Aylık' : 'Yıllık';
}

/**
 * Helper function to check if subscription is active
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
    return subscription.status === 'ACTIVE' || subscription.status === 'TRIAL';
}

/**
 * Helper function to check if user has premium access
 */
export function hasPremiumAccess(subscription: Subscription): boolean {
    return isSubscriptionActive(subscription) || subscription.isInGracePeriod;
}

/**
 * Helper function to get quota warning level
 */
export function getQuotaWarningLevel(quota: Quota): 'none' | 'low' | 'critical' {
    if (quota.percentage >= 80) {
        return 'critical';
    } else if (quota.percentage >= 60) {
        return 'low';
    }
    return 'none';
}

/**
 * Helper function to format quota display
 */
export function formatQuotaDisplay(quota: Quota): string {
    return `${quota.used} / ${quota.limit}`;
}

/**
 * Helper function to calculate savings for yearly plan
 */
export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): {
    amount: number;
    percentage: number;
} {
    const yearlyEquivalent = monthlyPrice * 12;
    const savings = yearlyEquivalent - yearlyPrice;
    const percentage = Math.round((savings / yearlyEquivalent) * 100);

    return {
        amount: savings,
        percentage,
    };
}
