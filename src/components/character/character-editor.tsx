import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { EntrancePreview } from '@/components/character/entrance-preview';
import { useGlide } from '@/components/button-group';
import { CollapsibleSection } from '@/components/collapsible-section';
import { PressableScale } from '@/components/pressable-scale';
import { usePressed } from '@/hooks/use-pressed';
import {
  BOTTOMS,
  ENTRANCES,
  FITS,
  EXPRESSIONS,
  EYE_COLORS,
  FACIAL_HAIR,
  GLASSES,
  GLASSES_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  IDLE_GROUPS,
  LABELS,
  OWN_FACE_IDLES,
  PANTS_COLORS,
  PATTERNS,
  PETS,
  SHOE_COLORS,
  SKINS,
  TINTED_GLASSES,
  TOP_COLORS,
  TOPS,
  WATCHES,
  WATCH_COLORS,
  togglePet,
  type CharacterLook,
} from '@/lib/character';
import { enter, layoutMove, leave } from '@/theme/motion';

type Props = {
  look: CharacterLook;
  userId: string;
  onChange: (patch: Partial<CharacterLook>) => void;
  /** A section was opened, e.g. to bring it into view once the one above has folded away. */
  onSectionOpen?: (key: SectionKey) => void;
  /** Where each section sits within the editor, for scrolling one into view. */
  onSectionLayout?: (key: SectionKey, y: number) => void;
};
export type SectionKey = 'move' | 'entrance' | 'body' | 'face' | 'clothes' | 'watch' | 'pets';

/** The podium character's options, in folding sections. `onChange` applies (and saves) each pick. */
export function CharacterEditor({ look, userId, onChange: change, onSectionOpen, onSectionLayout }: Props) {
  const theme = useTheme();
  // One section open at a time keeps the list short; all start closed.
  const [open, setOpen] = useState<SectionKey | null>(null);
  const toggle = (key: SectionKey) => {
    const opening = open !== key;
    setOpen(opening ? key : null);
    if (opening) onSectionOpen?.(key);
  };
  const at = (key: SectionKey) => (e: LayoutChangeEvent) => onSectionLayout?.(key, e.nativeEvent.layout.y);

  const chipRow = <K extends keyof CharacterLook>(title: string, key: K, values: readonly string[]) => (
    <Row title={title}>
      {values.map((v) => (
        <DipChip
          key={v}
          compact
          selected={look[key] === v}
          showSelectedCheck={false}
          mode={look[key] === v ? 'flat' : 'outlined'}
          onPress={() => change({ [key]: v } as Partial<CharacterLook>)}>
          {LABELS[v as keyof typeof LABELS]}
        </DipChip>
      ))}
    </Row>
  );

  const swatchRow = <K extends keyof CharacterLook>(title: string, key: K, values: readonly string[]) => (
    <SwatchRow
      title={title}
      values={values}
      value={look[key] as string | null}
      onPick={(c) => change({ [key]: c } as Partial<CharacterLook>)}
    />
  );

  /** Swatches with a first chip for no colour of its own (null), e.g. sleeves that match the top. */
  const optionalSwatchRow = (
    title: string,
    key: 'sleeveColor' | 'glassesColor',
    values: readonly string[],
    noneLabel: string
  ) => (
    <SwatchRow
      title={title}
      values={values}
      value={look[key]}
      onPick={(c) => change({ [key]: c })}
      none={
        <DipChip
          compact
          selected={look[key] === null}
          showSelectedCheck={false}
          mode={look[key] === null ? 'flat' : 'outlined'}
          onPress={() => change({ [key]: null })}>
          {noneLabel}
        </DipChip>
      }
    />
  );

  const pets = look.pets.map((p) => LABELS[p]);
  const ownFace = OWN_FACE_IDLES.includes(look.idle);

  return (
    <View style={styles.content}>
        <CollapsibleSection title="Move" summary={LABELS[look.idle]} expanded={open === 'move'} onToggle={() => toggle('move')}
          onLayout={at('move')}>
          {IDLE_GROUPS.map((g) => (
            <View key={g.title}>{chipRow(g.title, 'idle', g.idles)}</View>
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Podium entrance"
          summary={LABELS[look.entrance]}
          expanded={open === 'entrance'}
          onToggle={() => toggle('entrance')}
          onLayout={at('entrance')}>
          {chipRow('How you get up on the podium', 'entrance', ENTRANCES)}
          <EntrancePreview key={look.entrance} look={look} userId={userId} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Body & hair"
          summary={LABELS[look.hair]}
          accessory={<View style={[styles.dot, { backgroundColor: look.skin }]} />}
          expanded={open === 'body'}
          onToggle={() => toggle('body')}
          onLayout={at('body')}>
          {swatchRow('Skin', 'skin', SKINS)}
          {chipRow('Hair', 'hair', HAIR_STYLES)}
          {/* Also colours a beard or moustache. */}
          {look.hair !== 'bald' || look.facialHair !== 'none' ? swatchRow('Hair colour', 'hairColor', HAIR_COLORS) : null}
        </CollapsibleSection>

        <CollapsibleSection
          title="Face"
          summary={ownFace ? 'Set by move' : LABELS[look.expression]}
          accessory={<View style={[styles.dot, { backgroundColor: look.eyeColor }]} />}
          expanded={open === 'face'}
          onToggle={() => toggle('face')}
          onLayout={at('face')}>
          {ownFace ? (
            <Reveal>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {LABELS[look.idle]} has its own face, so expressions are hidden. Pick another move to choose one.
              </Text>
            </Reveal>
          ) : (
            chipRow('Expression', 'expression', EXPRESSIONS)
          )}
          {swatchRow('Eye colour', 'eyeColor', EYE_COLORS)}
          {chipRow('Glasses', 'glasses', GLASSES)}
          {look.glasses !== 'none'
            ? optionalSwatchRow(
                TINTED_GLASSES.includes(look.glasses) ? 'Lens colour' : 'Frame colour',
                'glassesColor',
                GLASSES_COLORS,
                'Classic'
              )
            : null}
          {chipRow('Facial hair', 'facialHair', FACIAL_HAIR)}
          <Reveal style={styles.wrap}>
            <DipChip
              compact
              icon={look.freckles ? 'check' : undefined}
              selected={look.freckles}
              showSelectedCheck={false}
              mode={look.freckles ? 'flat' : 'outlined'}
              onPress={() => change({ freckles: !look.freckles })}>
              Freckles
            </DipChip>
          </Reveal>
        </CollapsibleSection>

        <CollapsibleSection
          title="Clothes"
          summary={`${look.topFit === 'baggy' ? 'Baggy ' : ''}${LABELS[look.top]} · ${look.bottomFit === 'baggy' && look.bottom !== 'skirt' ? 'Baggy ' : ''}${LABELS[look.bottom]}`}
          expanded={open === 'clothes'}
          onToggle={() => toggle('clothes')}
          onLayout={at('clothes')}>
          {chipRow('Top', 'top', TOPS)}
          {chipRow('Top fit', 'topFit', FITS)}
          {swatchRow('Top colour', 'topColor', TOP_COLORS)}
          {look.top !== 'tank' ? optionalSwatchRow('Sleeves', 'sleeveColor', TOP_COLORS, 'Match top') : null}
          {chipRow('Pattern', 'pattern', PATTERNS)}
          {chipRow('Bottoms', 'bottom', BOTTOMS)}
          {look.bottom !== 'skirt' ? chipRow('Bottoms fit', 'bottomFit', FITS) : null}
          {swatchRow('Bottoms colour', 'pantsColor', PANTS_COLORS)}
          {swatchRow('Shoes', 'shoeColor', SHOE_COLORS)}
        </CollapsibleSection>

        <CollapsibleSection
          title="Watch"
          summary={LABELS[look.watch]}
          expanded={open === 'watch'}
          onToggle={() => toggle('watch')}
          onLayout={at('watch')}>
          {chipRow('Watch', 'watch', WATCHES)}
          {look.watch !== 'none' && look.watch !== 'ring' ? swatchRow('Strap colour', 'watchColor', WATCH_COLORS) : null}
        </CollapsibleSection>

        <CollapsibleSection
          title="Pets"
          summary={pets.length ? pets.join(', ') : 'None'}
          expanded={open === 'pets'}
          onToggle={() => toggle('pets')}
          onLayout={at('pets')}>
          <View style={styles.wrap}>
            {PETS.map((pet) => {
              const selected = look.pets.includes(pet);
              return (
                <DipChip
                  key={pet}
                  compact
                  selected={selected}
                  showSelectedCheck={false}
                  mode={selected ? 'flat' : 'outlined'}
                  onPress={() => change({ pets: togglePet(look.pets, pet) })}>
                  {LABELS[pet]}
                </DipChip>
              );
            })}
          </View>
        </CollapsibleSection>
    </View>
  );
}

/**
 * A row of a section that can come and go with another pick (a frame colour once there are glasses):
 * it rises in or fades out, and the rows below slide to make room. Inside the section's fold, so the
 * keyboard and the page never move it; when the whole section opens or shuts, the fold skips these.
 */
function Reveal({ style, children }: { style?: ComponentProps<typeof Animated.View>['style']; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={enter(0, reduceMotion)} exiting={leave(reduceMotion)} layout={layoutMove} style={style}>
      {children}
    </Animated.View>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Reveal style={styles.group}>
      <Text variant="labelLarge">{title}</Text>
      <View style={styles.wrap}>{children}</View>
    </Reveal>
  );
}

/** Paper's chip with the app's press: it dips on touch-down, before the pick lands. */
function DipChip({ onPressIn, onPressOut, ...props }: ComponentProps<typeof Chip>) {
  const press = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(press.pressed.value, [0, 1], [1, 0.97]) }] }));
  return (
    <Animated.View style={dip}>
      <Chip
        {...props}
        onPressIn={(e) => {
          press.onPressIn();
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          press.onPressOut();
          onPressOut?.(e);
        }}
      />
    </Animated.View>
  );
}

/**
 * Colour swatches with one ring that glides to the chosen colour. `none` is a first chip for no
 * colour of its own; while it's picked the ring fades away.
 */
function SwatchRow({
  title,
  values,
  value,
  onPick,
  none,
}: {
  title: string;
  values: readonly string[];
  value: string | null;
  onPick: (color: string) => void;
  none?: ReactNode;
}) {
  const theme = useTheme();
  const ring = useGlide(value === null ? -1 : values.indexOf(value));
  return (
    <Row title={title}>
      {none}
      {values.map((c, i) => (
        <PressableScale
          key={c}
          pressedScale={0.92}
          onPress={() => onPick(c)}
          onLayout={ring.place(i)}
          accessibilityLabel={`${title} ${c}`}
          accessibilityState={{ selected: value === c }}
          style={[styles.swatch, { backgroundColor: c, borderColor: theme.colors.outlineVariant }]}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[styles.swatch, styles.ring, { borderColor: theme.colors.onSurface }, ring.style]}
      />
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  group: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
  // The chosen colour's ring, laid over its swatch.
  ring: { position: 'absolute', top: 0, left: 0, borderWidth: 3 },
  dot: { width: 16, height: 16, borderRadius: 8 },
});
