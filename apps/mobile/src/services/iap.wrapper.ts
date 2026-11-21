/**
 * IAP Service Wrapper
 * 
 * Expo Go'da mock, development build'de gerçek IAP kullanır
 */

// Basit kontrol: react-native-iap yüklenebiliyor mu?
let iapManager: any;
let useRealIAP = false;

try {
    // Gerçek IAP'yi dene
    require('react-native-iap');
    useRealIAP = true;
    console.log('[IAP Wrapper] Using real IAP');
} catch (error) {
    console.log('[IAP Wrapper] react-native-iap not available, using mock IAP');
    console.log('[IAP Wrapper] To use real IAP, create a development build with: npx expo run:ios or npx expo run:android');
}

if (useRealIAP) {
    const realModule = require('./iap');
    iapManager = realModule.iapManager;
} else {
    const mockModule = require('./iap.mock');
    iapManager = mockModule.iapManager;
}

export { iapManager };
export { IAPErrorCode, IAPServiceError } from './iap.mock';
export type { Purchase, Product, SubscriptionTier } from './iap.mock';
