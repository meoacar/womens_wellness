const isDevelopmentBuild =
    process.env.EAS_BUILD_PROFILE === 'development' ||
    process.env.APP_ENV === 'development';

module.exports = {
    expo: {
        name: "Kadın Atlası",
        slug: "kadinatlasi",
        owner: "meoacar",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "automatic",
        scheme: "wellness",
        splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        assetBundlePatterns: [
            "**/*"
        ],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.kadinatlasi.wellness",
            config: {
                usesNonExemptEncryption: false
            },
            infoPlist: {
                UIBackgroundModes: [
                    "remote-notification"
                ],
                NSAppTransportSecurity: isDevelopmentBuild
                    ? {
                          NSAllowsArbitraryLoads: false,
                          NSAllowsLocalNetworking: true,
                          NSExceptionDomains: {
                              localhost: {
                                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                                  NSIncludesSubdomains: true
                              },
                              "127.0.0.1": {
                                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                                  NSIncludesSubdomains: true
                              }
                          }
                      }
                    : {
                          NSAllowsArbitraryLoads: false
                      }
            },
            associatedDomains: [
                "applinks:kadinatlasi.com"
            ]
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            package: "com.kadinatlasi.wellness",
            versionCode: 1,
            permissions: [
                "android.permission.RECEIVE_BOOT_COMPLETED",
                "android.permission.SCHEDULE_EXACT_ALARM",
                "android.permission.VIBRATE",
                "com.android.vending.BILLING"
            ],
            intentFilters: [
                {
                    action: "VIEW",
                    autoVerify: true,
                    data: [
                        {
                            scheme: "https",
                            host: "kadinatlasi.com",
                            pathPrefix: "/"
                        }
                    ],
                    category: [
                        "BROWSABLE",
                        "DEFAULT"
                    ]
                }
            ]
        },
        web: {
            favicon: "./assets/favicon.png",
            bundler: "metro"
        },
        plugins: [
            "expo-router",
            "expo-secure-store",
            [
                "expo-notifications",
                {
                    icon: "./assets/notification-icon.png",
                    color: "#ffffff",
                    sounds: [
                        "./assets/notification_sound.wav"
                    ],
                    mode: "production"
                }
            ]
        ],
        experiments: {
            typedRoutes: true
        },
        extra: {
            router: {
                origin: false
            },
            ...(process.env.EAS_BUILD
                ? {
                      eas: {
                          projectId: "6facc7f8-f777-4a91-8b10-c8f04b0a3310"
                      }
                  }
                : {})
        }
    }
};
