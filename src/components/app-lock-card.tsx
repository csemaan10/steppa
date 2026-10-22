import { useState } from 'react';
import { Card, HelperText, List, Switch, useTheme } from 'react-native-paper';

import { useAppLock } from '@/providers/app-lock-provider';
import { glassCard } from '@/theme';

export function AppLockCard() {
  const theme = useTheme();
  const { enabled, setEnabled } = useAppLock();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(on: boolean) {
    setBusy(true);
    setError(await setEnabled(on));
    setBusy(false);
  }

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <List.Item
        title="Biometric sign-in"
        description="After signing out, sign back in with your fingerprint or face"
        left={(props) => <List.Icon {...props} icon="fingerprint" />}
        right={() => <Switch value={enabled} onValueChange={toggle} disabled={busy} />}
        onPress={() => toggle(!enabled)}
        disabled={busy}
      />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </Card>
  );
}
