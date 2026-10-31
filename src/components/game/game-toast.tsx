import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Portal, Text } from 'react-native-paper';
import Animated, { FadeOutDown } from 'react-native-reanimated';

import { popIn } from '@/components/game/game-motion';

const SHOWN_MS = 2400;

type Toast = { id: number; text: string; icon: ReactNode };

/**
 * A little pill that pops up near the bottom ("+3 treats for walking!", "Not enough treats yet"),
 * in place of a system alert. Render `toast` anywhere: it floats over the whole screen.
 */
export function useGameToast(bottom: number): {
  /** Pops up `text` with an emoji or an icon (the treat icon, say) before it. */
  show: (text: string, icon?: ReactNode) => void;
  toast: ReactNode;
} {
  const [current, setCurrent] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function show(text: string, icon: ReactNode = '✨') {
    clearTimeout(timer.current);
    setCurrent((t) => ({ id: (t?.id ?? 0) + 1, text, icon }));
    timer.current = setTimeout(() => setCurrent(null), SHOWN_MS);
  }

  const toast = current ? (
    <Portal>
      <View pointerEvents="none" style={[styles.spot, { bottom }]}>
        <Animated.View
          key={current.id}
          entering={popIn()}
          exiting={FadeOutDown.duration(180)}
          accessibilityLiveRegion="polite"
          style={styles.pill}>
          {typeof current.icon === 'string' ? <Text style={styles.emoji}>{current.icon}</Text> : current.icon}
          <Text style={styles.text}>{current.text}</Text>
        </Animated.View>
      </View>
    </Portal>
  ) : null;

  return { show, toast };
}

const styles = StyleSheet.create({
  spot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#1E2230',
    borderBottomWidth: 3,
    borderBottomColor: '#0B0D14',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
  },
  emoji: { fontSize: 18, lineHeight: 22 },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
