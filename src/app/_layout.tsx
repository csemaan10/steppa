import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { AppLockProvider, useAppLock } from '@/providers/app-lock-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeChoiceProvider, useThemeChoice } from '@/providers/theme-provider';
import { applyUpdateOnLaunch } from '@/lib/updates';
import { buildTheme, toNavigationTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeChoiceProvider>
      <ThemedApp />
    </ThemeChoiceProvider>
  );
}

function ThemedApp() {
  const scheme = useColorScheme();
  const { themeName } = useThemeChoice();
  const theme = buildTheme(themeName, scheme === 'dark');

  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={toNavigationTheme(theme)}>
        <AuthProvider>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          <AppLockProvider>
            <RootNavigator />
          </AppLockProvider>
        </AuthProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

function RootNavigator() {
  const { session } = useAuth();
  const { locked } = useAppLock();
  const signedIn = !!session && !locked;

  // The splash stays up while a new update is checked for, so a restart into it is never seen.
  useEffect(() => {
    applyUpdateOnLaunch().finally(() => SplashScreen.hideAsync());
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        {/* iOS: a normal push, so it gets the native slide-in and edge swipe-back.
            Android: a transparent modal that animates itself out of the tapped card (expand-transition). */}
        <Stack.Screen
          name="group/[id]"
          options={
            Platform.OS === 'ios'
              ? { gestureEnabled: true }
              : { presentation: 'transparentModal', animation: 'none', gestureEnabled: false }
          }
        />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="group-settings/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="recap" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'none' }} />
      </Stack.Protected>
    </Stack>
  );
}
