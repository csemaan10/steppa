import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Keeps a visited tab mounted and laid out while another one shows, hidden with opacity rather than
 * `display: none`. Hiding with display makes the new architecture rebuild the tab's views when it
 * comes back, so every entrance and layout animation inside it played again on each tab switch.
 * Looping animations on hidden tabs still pause themselves (useScreenFocused).
 */
export function Pane({ visible, children }: PropsWithChildren<{ visible: boolean }>) {
  return (
    <View
      style={[StyleSheet.absoluteFill, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0, zIndex: -1 },
});
