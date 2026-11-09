import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { CharacterCanvas } from '@/components/character/character-canvas';
import { openCharacterFrom } from '@/components/expand-transition';
import { usePressed } from '@/hooks/use-pressed';
import type { Profile } from '@/lib/api';
import { hashString, LABELS, normalizeLook } from '@/lib/character';
import { rememberLook, useRememberedLook } from '@/lib/look-store';
import { glassCard, useAppTheme } from '@/theme';

/** Settings card showing your podium character; tapping it opens the editor out of the card. */
export function CharacterCard({ profile }: { profile: Profile }) {
  const theme = useAppTheme();
  const cardRef = useRef<View>(null);
  const edited = useRememberedLook(profile.id);
  const look = edited ?? normalizeLook(profile.podium_character, profile.id);
  const seed = (hashString(profile.id) % 1000) / 1000;
  const pets = look.pets.length ? ` · ${look.pets.length === 1 ? LABELS[look.pets[0]!] : `${look.pets.length} pets`}` : '';
  const { pressed, onPressIn, onPressOut } = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.02 }] }));

  function open() {
    // The editor starts from this look, so it opens with the character already drawn.
    rememberLook(profile.id, look);
    openCharacterFrom(cardRef.current);
  }

  return (
    // The ref stays on the outer view, so the editor grows from the card's resting size.
    <View ref={cardRef} collapsable={false}>
      <Animated.View style={dip}>
        <Card
          mode="contained"
          style={glassCard(theme)}
          onPress={open}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityLabel="Edit podium character">
          <View style={styles.row}>
            <View style={[styles.stage, { backgroundColor: theme.colors.surfaceVariant }]}>
              <CharacterCanvas look={look} seed={seed} width={STAGE_WIDTH} />
            </View>
            <View style={styles.text}>
              <Text variant="titleMedium">Podium character</Text>
              <Text variant="bodyMedium" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant }}>
                {`${LABELS[look.idle]} · ${LABELS[look.top]}${pets}`}
              </Text>
            </View>
            <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
          </View>
        </Card>
      </Animated.View>
    </View>
  );
}

const STAGE_WIDTH = 120;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingRight: 16 },
  stage: { borderRadius: 14, overflow: 'hidden', paddingTop: 4 },
  text: { flex: 1, gap: 2 },
});
