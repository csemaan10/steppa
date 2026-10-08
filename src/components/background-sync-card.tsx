import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Card, List, Switch, useTheme } from 'react-native-paper';

import { isBackgroundSyncEnabled, setBackgroundSyncEnabled } from '@/lib/background-sync';
import { backgroundAccess, healthSourceName, openHealthSettings, requestBackgroundAccess } from '@/lib/health';
import { surfaceCard } from '@/theme';

type Access = 'granted' | 'denied' | 'unavailable' | null;

/** Settings switch for syncing steps while Steppa is closed, with whether it can actually run. */
export function BackgroundSyncCard() {
  const theme = useTheme();
  const [enabled, setEnabled] = useState(isBackgroundSyncEnabled);
  const [access, setAccess] = useState<Access>(null);
  const [busy, setBusy] = useState(false);

  // Re-check on focus: the user may have changed the permission in Health Connect meanwhile.
  useFocusEffect(
    useCallback(() => {
      backgroundAccess().then(setAccess).catch(() => setAccess('unavailable'));
    }, [])
  );

  async function toggle(on: boolean) {
    setBusy(true);
    setEnabled(on);
    try {
      await setBackgroundSyncEnabled(on);
      // Turning it on is the moment to ask again for the Health Connect permission it needs.
      if (on && access === 'denied') setAccess((await requestBackgroundAccess()) ? 'granted' : 'denied');
    } finally {
      setBusy(false);
    }
  }

  const needsPermission = enabled && access === 'denied';
  const description = !enabled
    ? 'Off: steps sync only while Steppa is open'
    : access === 'unavailable'
      ? "This phone can't sync in the background; steps sync while Steppa is open"
      : needsPermission
        ? `Needs background access in ${healthSourceName}`
        : 'Keeps your steps up to date for your groups, even when Steppa is closed';

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <List.Item
        title="Background sync"
        description={description}
        descriptionNumberOfLines={3}
        left={(props) => <List.Icon {...props} icon="sync" />}
        right={() => <Switch value={enabled} onValueChange={toggle} disabled={busy} />}
        onPress={() => toggle(!enabled)}
        disabled={busy}
      />
      {needsPermission && Platform.OS === 'android' ? (
        <Card.Actions>
          <Button onPress={openHealthSettings}>Open {healthSourceName}</Button>
        </Card.Actions>
      ) : null}
    </Card>
  );
}
