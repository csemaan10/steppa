import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { FlagIcon } from '@/components/flag-icon';
import { TRIP_COLOR } from '@/components/game/colors';
import { ProgressBar } from '@/components/journey-parts';
import { PlaceIcon } from '@/components/place-icon';
import { PreviewCard } from '@/components/preview-card';
import { hashString } from '@/lib/character';
import type { Page, PageStamp } from '@/lib/passport';
import { useAppTheme, withAlpha } from '@/theme';

const STAMP = 70;

const stampDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();

/**
 * One place on a page: a rubber stamp, a little crooked, in the trips' ink, with the place's picture
 * and the day the pet first went there, or an empty dashed circle if it hasn't yet.
 */
function Stamp({ stamp }: { stamp: PageStamp }) {
  const theme = useAppTheme();
  const { place, day } = stamp;
  const ink = TRIP_COLOR;
  const tilt = (hashString(place.key) % 25) - 12;
  return (
    <View style={styles.cell} accessible accessibilityLabel={day ? `${place.stop.name}, stamped ${stampDate(day)}` : `${place.stop.name}, not yet`}>
      {day ? (
        <View style={[styles.stamp, { borderColor: ink, transform: [{ rotate: `${tilt}deg` }] }]}>
          <View style={[styles.inner, { borderColor: withAlpha(ink, 0.6) }]}>
            <PlaceIcon emoji={place.stop.emoji} size={30} color={ink} />
            <Text style={[styles.date, { color: ink }]}>{stampDate(day)}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.stamp, styles.empty, { borderColor: theme.colors.outlineVariant }]} />
      )}
      <Text
        variant="labelSmall"
        numberOfLines={2}
        style={[styles.name, { color: day ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
        {place.stop.name}
      </Text>
    </View>
  );
}

/** A country's page, folded to how full it is and its keepsake; open it to see every stamp. */
export function PassportPage({
  page,
  name,
  expanded,
  onToggle,
}: {
  page: Page;
  /** The pet's name. */
  name: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { country, stamps, filled, keepsake } = page;
  const full = filled === stamps.length;
  const thing = keepsake ? `a ${keepsake.choice.label.toLowerCase()}` : 'a keepsake';
  return (
    <PreviewCard
      title={country.name}
      icon={<FlagIcon flag={country.flag} size={26} />}
      note={`${filled} of ${stamps.length}`}
      summary={full ? `Full: ${name} brought home ${thing}` : `Fill the page for ${thing}`}
      below={<ProgressBar fraction={filled / stamps.length} />}
      expanded={expanded}
      onToggle={onToggle}>
      <View style={styles.grid}>
        {stamps.map((stamp) => (
          <Stamp key={stamp.place.key} stamp={stamp} />
        ))}
      </View>
    </PreviewCard>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  cell: { width: '33.33%', alignItems: 'center', gap: 6 },
  stamp: {
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    borderWidth: 2.5,
    padding: 3,
    opacity: 0.9,
  },
  inner: { flex: 1, borderRadius: STAMP / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { borderStyle: 'dashed', borderWidth: 1.5, opacity: 1 },
  date: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  name: { textAlign: 'center', paddingHorizontal: 4 },
});
