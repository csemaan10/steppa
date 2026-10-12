import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Chip, HelperText, Text, useTheme } from 'react-native-paper';

import { CharacterCanvas } from '@/components/character/character-canvas';
import { EntrancePreview } from '@/components/character/entrance-preview';
import { CollapsibleSection } from '@/components/collapsible-section';
import { updateProfile, type Profile } from '@/lib/api';
import {
  BOTTOMS,
  ENTRANCES,
  FITS,
  EXPRESSIONS,
  EYE_COLORS,
  FACIAL_HAIR,
  GLASSES,
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
  TOP_COLORS,
  TOPS,
  WATCHES,
  WATCH_COLORS,
  hashString,
  normalizeLook,
  togglePet,
  type CharacterLook,
} from '@/lib/character';
import { surfaceCard } from '@/theme';

type Props = { profile: Profile };
type SectionKey = 'move' | 'entrance' | 'body' | 'face' | 'clothes' | 'watch' | 'pets';

/** Settings card for designing your podium character. Each change saves immediately. */
export function CharacterEditorCard({ profile }: Props) {
  const theme = useTheme();
  const [look, setLook] = useState<CharacterLook>(() => normalizeLook(profile.podium_character, profile.id));
  const [error, setError] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  // One section open at a time keeps the card short; all start closed.
  const [open, setOpen] = useState<SectionKey | null>(null);
  const seed = (hashString(profile.id) % 1000) / 1000;
  const toggle = (key: SectionKey) => setOpen((current) => (current === key ? null : key));

  // Save each change right away; roll back if the server rejects it.
  function change(patch: Partial<CharacterLook>) {
    const previous = look;
    const next = { ...look, ...patch };
    setLook(next);
    setError(null);
    updateProfile(profile.id, { podium_character: next }).catch((e) => {
      setLook(previous);
      setError(e instanceof Error ? e.message : 'Could not save');
    });
  }

  const chipRow = <K extends keyof CharacterLook>(title: string, key: K, values: readonly string[]) => (
    <View style={styles.group}>
      <Text variant="labelLarge">{title}</Text>
      <View style={styles.wrap}>
        {values.map((v) => (
          <Chip
            key={v}
            compact
            selected={look[key] === v}
            showSelectedCheck={false}
            mode={look[key] === v ? 'flat' : 'outlined'}
            onPress={() => change({ [key]: v } as Partial<CharacterLook>)}>
            {LABELS[v as keyof typeof LABELS]}
          </Chip>
        ))}
      </View>
    </View>
  );

  const swatchRow = <K extends keyof CharacterLook>(title: string, key: K, values: readonly string[]) => (
    <View style={styles.group}>
      <Text variant="labelLarge">{title}</Text>
      <View style={styles.wrap}>
        {values.map((c) => {
          const selected = look[key] === c;
          return (
            <Pressable
              key={c}
              onPress={() => change({ [key]: c } as Partial<CharacterLook>)}
              accessibilityLabel={`${title} ${c}`}
              accessibilityState={{ selected }}
              style={[
                styles.swatch,
                { backgroundColor: c, borderColor: selected ? theme.colors.onSurface : theme.colors.outlineVariant },
                selected && styles.swatchSelected,
              ]}
            />
          );
        })}
      </View>
    </View>
  );

  const pets = look.pets.map((p) => LABELS[p]);
  const ownFace = OWN_FACE_IDLES.includes(look.idle);

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <Card.Title title="Podium character" subtitle="How you appear on podiums and in trophy cabinets" titleVariant="titleMedium" />
      <Card.Content style={styles.content}>
        <View
          style={[styles.stage, { backgroundColor: theme.colors.surfaceVariant }]}
          onLayout={(e) => setStageWidth(e.nativeEvent.layout.width)}>
          {stageWidth > 0 ? <CharacterCanvas look={look} seed={seed} width={stageWidth} /> : null}
        </View>

        <CollapsibleSection title="Move" summary={LABELS[look.idle]} expanded={open === 'move'} onToggle={() => toggle('move')}>
          {IDLE_GROUPS.map((g) => (
            <View key={g.title}>{chipRow(g.title, 'idle', g.idles)}</View>
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Podium entrance"
          summary={LABELS[look.entrance]}
          expanded={open === 'entrance'}
          onToggle={() => toggle('entrance')}>
          {chipRow('How you get up on the podium', 'entrance', ENTRANCES)}
          <EntrancePreview key={look.entrance} look={look} userId={profile.id} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Body & hair"
          summary={LABELS[look.hair]}
          accessory={<View style={[styles.dot, { backgroundColor: look.skin }]} />}
          expanded={open === 'body'}
          onToggle={() => toggle('body')}>
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
          onToggle={() => toggle('face')}>
          {ownFace ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {LABELS[look.idle]} has its own face, so expressions are hidden. Pick another move to choose one.
            </Text>
          ) : (
            chipRow('Expression', 'expression', EXPRESSIONS)
          )}
          {swatchRow('Eye colour', 'eyeColor', EYE_COLORS)}
          {chipRow('Glasses', 'glasses', GLASSES)}
          {chipRow('Facial hair', 'facialHair', FACIAL_HAIR)}
          <View style={styles.wrap}>
            <Chip
              compact
              icon={look.freckles ? 'check' : undefined}
              selected={look.freckles}
              showSelectedCheck={false}
              mode={look.freckles ? 'flat' : 'outlined'}
              onPress={() => change({ freckles: !look.freckles })}>
              Freckles
            </Chip>
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Clothes"
          summary={`${look.topFit === 'baggy' ? 'Baggy ' : ''}${LABELS[look.top]} · ${look.bottomFit === 'baggy' && look.bottom !== 'skirt' ? 'Baggy ' : ''}${LABELS[look.bottom]}`}
          expanded={open === 'clothes'}
          onToggle={() => toggle('clothes')}>
          {chipRow('Top', 'top', TOPS)}
          {chipRow('Top fit', 'topFit', FITS)}
          {swatchRow('Top colour', 'topColor', TOP_COLORS)}
          {look.top !== 'tank' ? (
            <View style={styles.group}>
              <Text variant="labelLarge">Sleeves</Text>
              <View style={styles.wrap}>
                <Chip
                  compact
                  selected={look.sleeveColor === null}
                  showSelectedCheck={false}
                  mode={look.sleeveColor === null ? 'flat' : 'outlined'}
                  onPress={() => change({ sleeveColor: null })}>
                  Match top
                </Chip>
                {TOP_COLORS.map((c) => {
                  const selected = look.sleeveColor === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => change({ sleeveColor: c })}
                      accessibilityLabel={`Sleeves ${c}`}
                      accessibilityState={{ selected }}
                      style={[
                        styles.swatch,
                        { backgroundColor: c, borderColor: selected ? theme.colors.onSurface : theme.colors.outlineVariant },
                        selected && styles.swatchSelected,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
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
          onToggle={() => toggle('watch')}>
          {chipRow('Watch', 'watch', WATCHES)}
          {look.watch !== 'none' && look.watch !== 'ring' ? swatchRow('Strap colour', 'watchColor', WATCH_COLORS) : null}
        </CollapsibleSection>

        <CollapsibleSection
          title="Pets"
          summary={pets.length ? pets.join(', ') : 'None'}
          expanded={open === 'pets'}
          onToggle={() => toggle('pets')}>
          <View style={styles.wrap}>
            {PETS.map((pet) => {
              const selected = look.pets.includes(pet);
              return (
                <Chip
                  key={pet}
                  compact
                  selected={selected}
                  showSelectedCheck={false}
                  mode={selected ? 'flat' : 'outlined'}
                  onPress={() => change({ pets: togglePet(look.pets, pet) })}>
                  {LABELS[pet]}
                </Chip>
              );
            })}
          </View>
        </CollapsibleSection>

        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 16 },
  stage: { borderRadius: 16, overflow: 'hidden', paddingTop: 8, marginBottom: 6 },
  group: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
  swatchSelected: { borderWidth: 3 },
  dot: { width: 16, height: 16, borderRadius: 8 },
});
