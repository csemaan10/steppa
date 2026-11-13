// Background tasks must be defined before Expo Router loads. When the OS wakes the app to run a
// task, no screen is rendered, so anything imported only from src/app/_layout.tsx never runs.
import '@/lib/background-sync';
// Android draws its widgets from a task that runs without the app open; it must exist at startup.
import '@/widgets/register';
import 'expo-router/entry';
