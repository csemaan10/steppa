import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, HelperText, Text } from 'react-native-paper';
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterCanvas } from '@/components/character/character-canvas';
import { CharacterEditor, type SectionKey } from '@/components/character/character-editor';
import { useExpandTransition } from '@/components/expand-transition';
import { GlassBackAction } from '@/components/glass-action';
import { getProfile, updateProfile } from '@/lib/api';
import { hashString, normalizeLook, type CharacterLook } from '@/lib/character';
import { peekLook, rememberLook } from '@/lib/look-store';
import { useUserId } from '@/providers/auth-provider';
import { glass, screenBackground, transparentHeader, useAppTheme } from '@/theme';
import { motion } from '@/theme/motion';

/** Gap between the top bar and the floating preview. */
const STAGE_TOP = 4;
const STAGE_PAD = 12;
/** How small the preview gets once the options are scrolled up under it. */
const MIN_SCALE = 0.5;
/** Wait for the section above to fold away before bringing an opened one into view. */
const SETTLE_MS = 340;

/**
 * The podium character editor. The character floats in a frosted pane over the options, so every
 * change shows on it straight away (with a small pop); scrolling the options up shrinks it out of the
 * way. On Android it grows out of the Settings card, like a group does from its card.
 */
export default function CharacterScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { width } = useWindowDimensions();
  const { oy, oh } = useLocalSearchParams<{ oy?: string; oh?: string }>();
  const { backdropStyle, containerStyle, contentStyle, pointerEvents, close } = useExpandTransition(oy, oh);

  // Usually handed over by the Settings card; fetched if the screen was opened some other way.
  const [look, setLook] = useState<CharacterLook | undefined>(() => peekLook(userId));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (look) return;
    let live = true;
    getProfile(userId)
      .then((p) => {
        if (!live) return;
        const loaded = normalizeLook(p.podium_character, p.id);
        rememberLook(userId, loaded);
        setLook(loaded);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [look, userId]);
  const seed = (hashString(userId) % 1000) / 1000;

  const panelWidth = width - 32;
  const canvasWidth = panelWidth - STAGE_PAD * 2;
  const panelHeight = canvasWidth / 2 + STAGE_PAD + 4;
  const shrinkBy = panelHeight * 0.8;
  const contentTop = STAGE_TOP + panelHeight + 12;

  // The preview shrinks toward the top as the options scroll up beneath it.
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [0, shrinkBy], [1, MIN_SCALE], 'clamp') }],
  }));

  // A quick, subtle pop on the character whenever something changes.
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  function change(patch: Partial<CharacterLook>) {
    if (!look) return;
    const previous = look;
    const next = { ...look, ...patch };
    setLook(next);
    rememberLook(userId, next);
    setError(null);
    pop.set(
      withSequence(
        withTiming(1.05, { duration: 90, reduceMotion: ReduceMotion.System }),
        withSpring(1, motion.release)
      )
    );
    // Saved right away; rolled back if the server rejects it.
    updateProfile(userId, { podium_character: next }).catch((e) => {
      setLook(previous);
      rememberLook(userId, previous);
      setError(e instanceof Error ? e.message : 'Could not save');
    });
  }

  // Opening a section folds the open one away, which can leave the new one up under the preview
  // or off the top: once it has settled, scroll it back to just below the preview.
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  /** Where the editor starts in the scrolling content (below the intro line). */
  const editorY = useRef(0);
  function bringIntoView(key: SectionKey) {
    setTimeout(() => {
      const y = sectionY.current[key];
      if (y === undefined) return;
      const top = editorY.current + y;
      // Where the header should sit: just under the preview, at the size it will be once scrolled there.
      let target = top - (STAGE_TOP + panelHeight * MIN_SCALE) - 8;
      const scale = interpolate(Math.max(target, 0), [0, shrinkBy], [1, MIN_SCALE], 'clamp');
      target = Math.max(0, top - (STAGE_TOP + panelHeight * scale) - 8);
      if (scrollY.get() > target) scroller.current?.scrollTo({ y: target, animated: true });
    }, SETTLE_MS);
  }

  return (
    <View style={styles.flex} pointerEvents={pointerEvents}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, backdropStyle]}
      />
      <Animated.View style={[screenBackground(theme), containerStyle]}>
        <Animated.View style={contentStyle}>
          <Appbar.Header mode="small" style={transparentHeader}>
            <GlassBackAction onPress={close} />
            <Appbar.Content title="Podium character" />
          </Appbar.Header>

          <View style={styles.flex}>
            <Animated.ScrollView
              ref={scroller}
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.content,
                { paddingTop: contentTop, paddingBottom: insets.bottom + 24 },
              ]}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                How you appear on podiums and in trophy cabinets. Changes save as you go.
              </Text>
              {error ? (
                <HelperText type="error" visible>
                  {error}
                </HelperText>
              ) : null}
              {look ? (
                <View onLayout={(e) => (editorY.current = e.nativeEvent.layout.y)}>
                  <CharacterEditor
                    look={look}
                    userId={userId}
                    onChange={change}
                    onSectionOpen={bringIntoView}
                    onSectionLayout={(key, y) => (sectionY.current[key] = y)}
                  />
                </View>
              ) : (
                <ActivityIndicator style={styles.loading} />
              )}
            </Animated.ScrollView>

            <Animated.View
              style={[
                styles.stage,
                glass(theme, 'strong'),
                { top: STAGE_TOP, width: panelWidth, height: panelHeight },
                stageStyle,
              ]}>
              <Animated.View style={popStyle}>
                {look ? <CharacterCanvas look={look} seed={seed} width={canvasWidth} /> : null}
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  loading: { marginTop: 24 },
  stage: {
    position: 'absolute',
    left: 16,
    borderRadius: 24,
    alignItems: 'center',
    paddingTop: STAGE_PAD,
    overflow: 'hidden',
    transformOrigin: 'top',
  },
});
