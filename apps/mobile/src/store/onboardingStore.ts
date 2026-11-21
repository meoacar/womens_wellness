import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface OnboardingData {
  // Step 1: Identity & Access
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  birthDate?: Date;
  password?: string;
  heightCm?: number;
  weightKg?: number;

  // Step 2: Period Info
  lastPeriodDate?: Date;

  // Step 3: Privacy & Consents
  acceptPrivacy?: boolean;
  privacyAcceptedAt?: string;
  aiMemoryOptIn?: boolean;
  aiMemoryAcceptedAt?: string;

  // Step 4: Notification Preferences
  notificationIntensity?: 'light' | 'medium' | 'high';
  quietHoursStart?: string;
  quietHoursEnd?: string;

  // Step 5: Premium
  selectedPlan?: 'free' | 'premium';
  selectedTier?: 'MONTHLY' | 'YEARLY';

  // Meta
  currentStep?: number;
  completedSteps?: number[];
}

interface OnboardingState {
  data: OnboardingData;
  isLoading: boolean;
  updateData: (data: Partial<OnboardingData>) => Promise<void>;
  clearData: () => Promise<void>;
  loadDraft: () => Promise<void>;
  completeStep: (step: number) => void;
  setCurrentStep: (step: number) => void;
}

const STORAGE_KEY = 'onboarding_draft';

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  data: {
    notificationIntensity: 'light', // Default
    currentStep: 1,
    completedSteps: [],
  },
  isLoading: false,

  updateData: async (newData) => {
    const updatedData = { ...get().data, ...newData };
    set({ data: updatedData });

    // Save draft to secure storage
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updatedData));
    } catch (error) {
      console.error('Failed to save onboarding draft:', error);
    }
  },

  clearData: async () => {
    set({
      data: {
        notificationIntensity: 'light',
        currentStep: 1,
        completedSteps: [],
      }
    });

    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear onboarding draft:', error);
    }
  },

  loadDraft: async () => {
    set({ isLoading: true });
    try {
      const draft = await SecureStore.getItemAsync(STORAGE_KEY);
      if (draft) {
        const data = JSON.parse(draft);
        // Convert date strings back to Date objects
        if (data.birthDate) data.birthDate = new Date(data.birthDate);
        if (data.lastPeriodDate) data.lastPeriodDate = new Date(data.lastPeriodDate);

        set({ data: { ...get().data, ...data } });
      }
    } catch (error) {
      console.error('Failed to load onboarding draft:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  completeStep: (step) => {
    const completedSteps = get().data.completedSteps || [];
    if (!completedSteps.includes(step)) {
      const updatedData = {
        ...get().data,
        completedSteps: [...completedSteps, step],
      };
      set({ data: updatedData });

      // Save to storage
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updatedData)).catch(console.error);
    }
  },

  setCurrentStep: (step) => {
    const updatedData = { ...get().data, currentStep: step };
    set({ data: updatedData });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updatedData)).catch(console.error);
  },
}));
