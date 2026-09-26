import { BlurView } from 'expo-blur';
import type { ReactNode, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

const RADIUS = 28;

type Props = {
  /** The screen's BlurTargetView (Android only blurs what's inside it). */
  blurTarget: RefObject<View | null>;
  children: ReactNode;
};

/** Frosted-glass card that blurs the screen background behind it. */
export function GlassCard({ blurTarget, children }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.glass,
        { borderColor: theme.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)' },
      ]}>
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={50}
        tint="default"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)' },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: RADIUS, borderWidth: 1, overflow: 'hidden' },
});
