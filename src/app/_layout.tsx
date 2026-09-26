import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeChoiceProvider, useThemeChoice } from '@/providers/theme-provider';
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
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // Keep the navigator mounted while auth loads (the splash screen covers it); returning null here
  // makes Expo Router's linking update an unmounted tree.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="group/[id]"
          options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false }}
        />
        <Stack.Screen name="user/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
