import * as Updates from 'expo-updates';

/** How long launch waits on the splash screen for a new update before opening without it. */
const LAUNCH_WAIT_MS = 3000;

/**
 * Checks for an over-the-air update at launch and, if it downloads in time, restarts straight into
 * it, so people get fixes on this open rather than the next. A slower download still finishes in
 * the background and applies on the next launch. No-op in development.
 */
export async function applyUpdateOnLaunch(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const download = (async () => {
      const { isAvailable } = await Updates.checkForUpdateAsync();
      if (!isAvailable) return false;
      return (await Updates.fetchUpdateAsync()).isNew;
    })();
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), LAUNCH_WAIT_MS));
    if (await Promise.race([download, timeout])) await Updates.reloadAsync();
  } catch {
    // Offline or the update server is down: open the version already installed.
  }
}
