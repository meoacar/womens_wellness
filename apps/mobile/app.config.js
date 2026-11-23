const appJson = require('./app.json');

const isDevelopmentBuild =
    process.env.EAS_BUILD_PROFILE === 'development' ||
    process.env.APP_ENV === 'development';

module.exports = () => ({
    ...appJson,
    expo: {
        ...appJson.expo,
        ios: {
            ...appJson.expo.ios,
            infoPlist: {
                ...appJson.expo.ios?.infoPlist,
                NSAppTransportSecurity: isDevelopmentBuild
                    ? {
                          NSAllowsArbitraryLoads: false,
                          NSAllowsLocalNetworking: true,
                          NSExceptionDomains: {
                              localhost: {
                                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                                  NSIncludesSubdomains: true,
                              },
                              '127.0.0.1': {
                                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                                  NSIncludesSubdomains: true,
                              },
                          },
                      }
                    : {
                          NSAllowsArbitraryLoads: false,
                      },
            },
        },
    },
});
