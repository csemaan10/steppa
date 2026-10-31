import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Rect } from 'react-native-svg';

import { FlagIcon } from '@/components/flag-icon';
import { MAGIC_COLOR, TRIP_COLOR } from '@/components/game/colors';
import { InkStamp, SparkleBurst } from '@/components/game/game-fx';
import { gameMotion, popIn, riseIn } from '@/components/game/game-motion';
import type { Place } from '@/lib/pet-adventures';

const STAMP_RED = '#E5484D';
/** The board's tiles: an airport's, or a magic one's. */
const TILES = { air: { tile: '#1E2230', letter: '#FFD54A' }, magic: { tile: '#2A1846', letter: '#F5C2FF' } };
const PAPER = '#FFFBF2';
const BACKDROP = 'rgba(10, 12, 22, 0.92)';
/** The backdrop as it looks over the app, so the ticket's notches read as cut out of it. */
const NOTCH = '#151824';

const FLAP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Letters per row on the board; longer names wrap onto a second row. */
const ROW_LETTERS = 12;
const FLAP_EVERY_MS = 75;
/** The board starts spinning once the ticket has landed, and each letter settles this long after the last. */
const BOARD_AT = 520;
const SETTLE_STAGGER = 85;
const STUB = 84;

/**
 * The destination as board rows, wrapped at ROW_LETTERS between words or after a hyphen
 * ("BOWNESS-ON-" / "SOLWAY"), so a long name doesn't shrink the tiles to nothing.
 */
function boardRows(name: string): string[] {
  const rows: string[] = [];
  let row = '';
  for (const part of name.toUpperCase().split(/(?<=-)|\s+/)) {
    const next = !row ? part : row.endsWith('-') ? `${row}${part}` : `${row} ${part}`;
    if (next.length > ROW_LETTERS && row) {
      rows.push(row);
      row = part;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows.slice(0, 2);
}

type Props = {
  place: Place;
  /** Which trip this is, counting from 1. */
  number: number;
  /** The pet's name, as the passenger. */
  name: string;
  onDone: () => void;
};

/**
 * Booking a trip: a boarding pass slides up, the departures board spins its letters until it spells
 * out where your pet is off to, the flag pops on, and "BON VOYAGE" is stamped across it. Then the
 * pass flies off and the postcard follows. A tap skips ahead once it's stamped. A fantasy land gets a
 * portal pass instead, stamped "ABRACADABRA" in a shower of sparkles.
 */
export function TripTicket({ place, number, name, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const ticketWidth = Math.min(width - 32, 380);
  const magic = place.fantasy;
  const color = magic ? MAGIC_COLOR : TRIP_COLOR;
  const tiles = magic ? TILES.magic : TILES.air;
  const rows = boardRows(place.stop.name);
  const letters = rows.reduce((n, r) => n + r.length, 0);
  // Where each row's letters start in the settling order, left to right, top row first.
  const offsets = rows.map((_, r) => rows.slice(0, r).reduce((n, row) => n + row.length, 0));
  const settledAt = BOARD_AT + letters * SETTLE_STAGGER + 200;
  const stampAt = settledAt + 350;
  // Long enough to enjoy the stamp; a tap goes on sooner.
  const leaveAt = stampAt + 2400;
  // Cells sized to the longest row in the space beside the stub.
  const boardWidth = ticketWidth - STUB - 40;
  const longest = Math.max(...rows.map((r) => r.length), 6);
  const cell = Math.min(24, Math.floor((boardWidth - (longest - 1) * 3) / longest));

  const dim = useSharedValue(0);
  const rise = useSharedValue(0);
  const away = useSharedValue(0);
  const [stamped, setStamped] = useState(false);
  const leaving = useRef(false);
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });

  function finish() {
    latest.current();
  }

  function leave() {
    if (leaving.current) return;
    leaving.current = true;
    dim.set(withDelay(200, withTiming(0, { duration: 260 })));
    away.set(
      withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(finish);
      })
    );
  }

  const leaveLater = useEffectEvent(leave);
  useEffect(() => {
    dim.set(withTiming(1, { duration: 240 }));
    rise.set(withDelay(80, withTiming(1, gameMotion.glide)));
    const stamp = setTimeout(() => setStamped(true), stampAt);
    const go = setTimeout(() => leaveLater(), leaveAt);
    return () => {
      clearTimeout(stamp);
      clearTimeout(go);
    };
  }, [dim, rise, stampAt, leaveAt]);

  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));
  const ticket = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - rise.value) * height * 0.7 - away.value * height },
      { rotate: `${(1 - rise.value) * 8 - away.value * 10}deg` },
    ],
  }));

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={leave}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }, backdrop]} />
      <Pressable
        style={styles.page}
        onPress={stamped ? leave : undefined}
        accessibilityLabel={`${name} is off to ${place.stop.name}`}>
        <Animated.View style={[styles.ticket, { width: ticketWidth }, ticket]}>
          <View style={[styles.header, { backgroundColor: color }]}>
            <Text style={styles.airline}>{magic ? '✨ STEPPA MAGIC' : '✈ STEPPA AIR'}</Text>
            <Text style={styles.pass}>{magic ? 'PORTAL PASS' : 'BOARDING PASS'}</Text>
          </View>
          <View style={styles.body}>
            <View style={styles.main}>
              <View style={styles.fields}>
                <Field label="PASSENGER" value={name.toUpperCase()} />
                <Field label="FROM" value="HOME" />
              </View>
              <Text style={styles.fieldLabel}>TO</Text>
              <View style={styles.board}>
                {rows.map((row, r) => (
                  <View key={r} style={styles.boardRow}>
                    {[...row].map((ch, i) => (
                      <FlapCell
                        key={`${r}-${i}`}
                        letter={ch}
                        settleAt={BOARD_AT + (offsets[r]! + i + 1) * SETTLE_STAGGER}
                        size={cell}
                        colors={tiles}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.flagRow}>
                <Animated.View entering={popIn(settledAt)}>
                  <FlagIcon flag={place.route.flag} size={30} />
                </Animated.View>
                <Text numberOfLines={1} style={styles.routeName}>
                  {place.route.name}
                </Text>
              </View>
            </View>
            <View style={styles.perforation}>
              <View style={[styles.notch, styles.notchTop]} />
              <View style={styles.dashes} />
              <View style={[styles.notch, styles.notchBottom]} />
            </View>
            <View style={styles.stub}>
              <Field label="TRIP" value={`NO. ${number}`} />
              <Field label="SEAT" value="🐾 1A" />
              <Barcode seed={number} />
            </View>
          </View>
          {stamped ? (
            <View pointerEvents="none" style={styles.stampSpot}>
              <InkStamp
                text={magic ? 'ABRACADABRA' : 'BON VOYAGE'}
                color={magic ? MAGIC_COLOR : STAMP_RED}
                rotate={-14}
                size={magic ? 15 : 20}
              />
              {magic ? <SparkleBurst count={14} radius={90} delay={gameMotion.slam.duration} /> : null}
            </View>
          ) : null}
        </Animated.View>
        {stamped ? (
          <Animated.Text entering={riseIn(700)} style={styles.tap}>
            Tap to continue
          </Animated.Text>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.fieldValue}>
        {value}
      </Text>
    </View>
  );
}

/**
 * One tile on the departures board: it flips through letters (each change a quick fold over its
 * hinge) until its turn to settle on the real one.
 */
function FlapCell({
  letter,
  settleAt,
  size,
  colors,
}: {
  letter: string;
  settleAt: number;
  size: number;
  colors: { tile: string; letter: string };
}) {
  const [shown, setShown] = useState('');
  const fold = useSharedValue(0);

  useEffect(() => {
    const began = Date.now();
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      const settled = Date.now() - began >= settleAt;
      setShown(settled ? letter : FLAP_LETTERS[(n * 7 + letter.charCodeAt(0) * 3) % FLAP_LETTERS.length]!);
      fold.set(withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: FLAP_EVERY_MS - 10 })));
      if (settled) clearInterval(timer);
    }, FLAP_EVERY_MS);
    return () => clearInterval(timer);
  }, [letter, settleAt, fold]);

  const style = useAnimatedStyle(() => ({ transform: [{ perspective: 300 }, { rotateX: `${fold.value * -75}deg` }] }));

  return (
    <View style={[styles.cell, { width: size, height: size * 1.35, backgroundColor: colors.tile }]}>
      <Animated.Text style={[styles.cellText, { fontSize: size * 0.8, color: colors.letter }, style]}>
        {shown === ' ' ? '' : shown}
      </Animated.Text>
      <View style={styles.hinge} />
    </View>
  );
}

/** Stripes for a barcode, the same for the same trip. */
function Barcode({ seed }: { seed: number }) {
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; x < 56; i++) {
    const w = 1 + ((seed * 13 + i * 7) % 3);
    bars.push({ x, w });
    x += w + 1 + ((seed + i) % 2);
  }
  return (
    <Svg width={56} height={26}>
      {bars.map((b, i) => (
        <Rect key={i} x={b.x} y={0} width={b.w} height={26} fill="#2A2A33" />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  ticket: { borderRadius: 18, backgroundColor: PAPER, boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  airline: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  pass: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  body: { flexDirection: 'row' },
  main: { flex: 1, padding: 16, gap: 6 },
  fields: { flexDirection: 'row', gap: 18 },
  field: { gap: 1, flexShrink: 1 },
  fieldLabel: { color: '#8A8577', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  fieldValue: { color: '#22232A', fontSize: 15, fontWeight: '900' },
  board: { gap: 4, marginTop: 2 },
  boardRow: { flexDirection: 'row', gap: 3 },
  cell: {
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellText: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  hinge: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 30 },
  routeName: { color: '#5E5A50', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  perforation: { width: 14, alignItems: 'center' },
  dashes: { flex: 1, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#D9D2C2', marginVertical: 2 },
  notch: { width: 14, height: 7, backgroundColor: NOTCH },
  notchTop: { borderBottomLeftRadius: 7, borderBottomRightRadius: 7 },
  notchBottom: { borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  stub: { width: STUB, paddingVertical: 16, paddingRight: 14, gap: 10, justifyContent: 'space-between' },
  stampSpot: { position: 'absolute', right: 34, bottom: 34 },
  tap: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 13, fontWeight: '700' },
});
