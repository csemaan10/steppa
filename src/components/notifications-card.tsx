import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { Card, List, Switch, useTheme } from 'react-native-paper';

import { Button } from '@/components/button';
import { Collapsible } from '@/components/collapsible';
import { updateProfile, type Profile } from '@/lib/api';
import { askForPush, pushPermission, type PushPermission } from '@/lib/notifications';
import { isPetPushEnabled, setPetPushEnabled, syncPetPushSetting } from '@/lib/pet-milestones';
import { glassCard } from '@/theme';

/** Settings switches for the two notifications Steppa sends, with whether the phone lets it notify. */
export function NotificationsCard({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const [results, setResults] = useState(profile.recap_push ?? true);
  const [pet, setPet] = useState(isPetPushEnabled);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-check on focus: it may have been changed in the phone's settings meanwhile.
  useFocusEffect(
    useCallback(() => {
      pushPermission()
        .then(setPermission)
        .catch(() => setPermission(null));
    }, [])
  );

  // Turning one on is the moment to ask, if the phone hasn't decided yet.
  async function askIfUndecided() {
    if (permission !== 'undetermined') return;
    setPermission((await askForPush(profile.id)) ? 'granted' : await pushPermission());
  }

  // Saved on the profile: the server decides who to send the results to.
  async function toggleResults(on: boolean) {
    setBusy(true);
    setResults(on);
    try {
      await updateProfile(profile.id, { recap_push: on });
      if (on) await askIfUndecided();
    } catch {
      setResults(!on);
    } finally {
      setBusy(false);
    }
  }

  // Kept on this phone, which notices milestones, and copied to the account for friends' visits.
  async function togglePet(on: boolean) {
    setPet(on);
    setPetPushEnabled(on);
    syncPetPushSetting(profile.id);
    if (on) await askIfUndecided();
  }

  const blocked = (results || pet) && permission === 'denied';
  const describe = (on: boolean, what: string) =>
    !on ? 'Off' : blocked ? 'Notifications are turned off for Steppa on this phone' : what;

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <List.Item
        title="Daily results"
        description={describe(results, "When yesterday's results are in, once the day is over for everyone in the group")}
        descriptionNumberOfLines={3}
        left={(props) => <List.Icon {...props} icon="podium" />}
        right={() => <Switch value={results} onValueChange={toggleResults} disabled={busy} />}
        onPress={() => toggleResults(!results)}
        disabled={busy}
      />
      <List.Item
        title="Pet"
        description={describe(pet, "When your pet reaches a new milestone, or a friend's pet comes over to visit")}
        descriptionNumberOfLines={3}
        left={(props) => <List.Icon {...props} icon="paw" />}
        right={() => <Switch value={pet} onValueChange={togglePet} />}
        onPress={() => togglePet(!pet)}
      />
      {/* Opens under the switches when it's needed, so the card grows rather than jumps. */}
      <Collapsible expanded={blocked}>
        <Card.Actions>
          <Button onPress={() => Linking.openSettings()}>Open settings</Button>
        </Card.Actions>
      </Collapsible>
    </Card>
  );
}
