import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Card, HelperText, useTheme } from 'react-native-paper';

import { Button } from '@/components/button';
import { Collapsible } from '@/components/collapsible';
import { deleteMyAccount, importStepHistory } from '@/lib/api';
import { healthSourceName, isHealthAvailable, requestHealthPermission, requestHistoryPermission } from '@/lib/health';
import { useAppLock } from '@/providers/app-lock-provider';
import { glassCard } from '@/theme';

/** Settings card for the account: import a year of steps, sign out, or delete the account. */
export function AccountCard({ userId }: { userId: string }) {
  const theme = useTheme();
  const { signOut, forget, setEnabled } = useAppLock();
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  // The last notice, kept while its line folds away.
  const [shown, setShown] = useState(notice);
  if (notice && notice !== shown) setShown(notice);

  async function importHistory() {
    setImporting(true);
    setNotice(null);
    try {
      if (!(await isHealthAvailable()) || !(await requestHealthPermission())) {
        throw new Error(`Allow Steppa to read steps in ${healthSourceName} first.`);
      }
      // Older steps need a separate grant on Android; skipped or declined, recent days still import.
      await requestHistoryPermission();
      const days = await importStepHistory(userId);
      setNotice({ text: `Imported ${days} day${days === 1 ? '' : 's'} of steps from ${healthSourceName}.`, error: false });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Import failed', error: true });
    } finally {
      setImporting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, step history, and messages. Groups you own are deleted for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount();
              // The login no longer exists: drop biometric sign-in and the local session.
              await setEnabled(false);
              await forget();
            } catch (e) {
              Alert.alert('Could not delete account', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Title title="Account" titleVariant="titleMedium" />
      <Card.Content style={styles.content}>
        <View>
          <Button mode="contained-tonal" icon="history" onPress={importHistory} loading={importing} disabled={importing}>
            {importing ? 'Importing the last year…' : 'Import step history'}
          </Button>
          {/* The result opens under the button, so the buttons below slide down rather than jump. */}
          <Collapsible expanded={!!notice} style={styles.noticeBox}>
            <HelperText type={shown?.error ? 'error' : 'info'} visible style={styles.notice}>
              {shown?.text}
            </HelperText>
          </Collapsible>
        </View>
        <Button mode="outlined" icon="logout" onPress={signOut}>
          Sign out
        </Button>
        <Button icon="account-remove-outline" textColor={theme.colors.error} onPress={confirmDeleteAccount}>
          Delete account
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 16 },
  noticeBox: { paddingTop: 6 },
  notice: { paddingHorizontal: 0 },
});
