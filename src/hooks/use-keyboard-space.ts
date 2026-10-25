import { Platform } from 'react-native';
import { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

const ANDROID = Platform.OS === 'android';

/**
 * Room for the keyboard under a scrolling screen: padding that follows the keyboard up and down.
 * Android draws edge to edge, so the keyboard covers the screen instead of shrinking it; padded, the
 * scroll view shrinks and Android scrolls the focused field back above the keyboard. iOS does that
 * through the scroll view's `automaticallyAdjustKeyboardInsets` instead, so it gets no padding.
 */
export function useKeyboardSpace() {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({
    paddingBottom: ANDROID ? keyboard.height.value : 0,
  }));
}
