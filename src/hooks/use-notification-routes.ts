import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

/**
 * Opens what a tapped notification is about (its `data.url`, e.g. a day's recap). A tap that
 * launched the app waits until `ready`: past any launch update restart, signed in and unlocked.
 */
export function useNotificationRoutes(ready: boolean) {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!ready || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = response.notification.request.content.data?.url;
    // Handled once: cleared, a later unlock doesn't open it again.
    Notifications.clearLastNotificationResponse();
    if (typeof url === 'string') router.push(url as Href);
  }, [ready, response]);
}
