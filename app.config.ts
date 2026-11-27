import type { ConfigContext, ExpoConfig } from 'expo/config';

// google-services.json is kept out of git. EAS builds get it from the
// GOOGLE_SERVICES_JSON file variable; local builds use the copy in the project root.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
