# Steppa

Step-count app for Android and iOS (Expo + React Native Paper / Material 3). Reads steps from
Health Connect (Android) or Apple Health (iOS), syncs them to Supabase, and lets friends compete in groups.

## Setup

1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
4. Build a development build (health APIs don't work in Expo Go):
   - Android: `npm run android` (or `npx eas-cli@latest build --profile development --platform android`)
   - iOS: `npm run ios` on a Mac (or EAS Build)
5. `npm start` and open the dev build.

## Structure

- `src/app` – routes (Expo Router): sign-in, tabs (Today, Groups, Profile), `group/[id]`, `user/[id]`
- `src/lib/health.*.ts` – platform-specific step readers
- `src/lib/api.ts` – Supabase queries and step sync
- `src/theme` – Material 3 light/dark color schemes
