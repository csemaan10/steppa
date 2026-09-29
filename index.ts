// Background tasks must be defined before Expo Router loads. When the OS wakes the app to run a
// task, no screen is rendered, so anything imported only from src/app/_layout.tsx never runs.
import '@/lib/background-sync';
import 'expo-router/entry';
