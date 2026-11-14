import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { popIn } from '@/components/game/game-motion';
import { UserAvatar } from '@/components/user-avatar';
import { isStop, latLng, type Route } from '@/lib/journeys';
import { GEOGRAPHY, type LatLng } from '@/lib/map-geography';
import { useAppTheme, withAlpha } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DRAW_MS = 1600;
const MARKER = 30;
const DOT_R = 4.5;
const LABEL_W = 170;
const KM_PER_DEGREE_LAT = 111.2;
const SCALE_STEPS_KM = [5, 10, 20, 25, 50, 100, 200, 250, 500];

/** Parchment land and soft blue water, like an illustrated travel map. */
const MAP_COLORS = {
  light: {
    land: '#F3EFE4',
    water: '#BCD8EA',
    shore: '#9EC2DA',
    border: '#A0968A',
    relief: '#D5C6AE',
    reliefEdge: '#B8A68A',
    forest: '#BFD3AC',
    grid: 'rgba(90, 80, 60, 0.08)',
    waterText: '#55839F',
    regionText: '#9C917F',
    road: 'rgba(255, 255, 255, 0.85)',
  },
  dark: {
    land: '#24282A',
    water: '#1A3445',
    shore: '#285069',
    border: '#6E6A61',
    relief: '#3F3B33',
    reliefEdge: '#57503F',
    forest: '#2C3D2E',
    grid: 'rgba(255, 255, 255, 0.05)',
    waterText: '#7FA9C4',
    regionText: '#8A8478',
    road: 'rgba(255, 255, 255, 0.1)',
  },
};

export type Traveller = { name: string; color: string; icon: string | null };

type Props = {
  route: Route;
  /** Distance walked; the trail fills in from the start up to here. */
  km: number;
  height: number;
  /** Shown at the current position. Without one the map is a preview: no marker, just the line. */
  traveller?: Traveller;
  /** Full-size map: true proportions, place names, a scale bar and the next stop named. */
  detailed?: boolean;
  /** Before the trail starts drawing in, e.g. to stagger a list of maps. */
  delay?: number;
};

type Geometry = {
  xs: number[];
  ys: number[];
  /** Distance along the route at each path point. */
  kms: number[];
  /** On-screen length from the start to each path point. */
  lens: number[];
  length: number;
  d: string;
  toXY: (lat: number, lng: number) => [number, number];
  /** Latitude at a screen y, for the grid. */
  latAt: (y: number) => number;
  lngAt: (x: number) => number;
  pxPerKm: number;
};

/** Equirectangular, squeezed by cos(latitude) so routes keep their shape away from the equator. */
function project(route: Route): { px: number[]; py: number[]; k: number } {
  const points = route.path.map(latLng);
  const lat0 = ((points.reduce((sum, [lat]) => sum + lat, 0) / points.length) * Math.PI) / 180;
  const k = Math.cos(lat0);
  return { px: points.map(([, lng]) => lng * k), py: points.map(([lat]) => -lat), k };
}

/** A map height that suits the route's shape at this width: tall routes get taller maps. */
export function mapHeightFor(route: Route, width: number, min: number, max: number): number {
  const { px, py } = project(route);
  const aspect = (Math.max(...py) - Math.min(...py)) / Math.max(Math.max(...px) - Math.min(...px), 1e-6);
  return Math.round(Math.min(max, Math.max(min, width * aspect + 80)));
}

/**
 * Fits the route into the box; the geography around it fills whatever space is left.
 * `stretch` lets one axis scale up to that many times more than the other, so a wide, flat
 * route still fills a short map. 1 keeps true proportions.
 */
function layoutRoute(route: Route, width: number, height: number, pad: number, stretch: number): Geometry {
  const { px, py, k } = project(route);
  const minX = Math.min(...px);
  const minY = Math.min(...py);
  const spanX = Math.max(Math.max(...px) - minX, 1e-6);
  const spanY = Math.max(Math.max(...py) - minY, 1e-6);
  const fitX = (width - 2 * pad) / spanX;
  const fitY = (height - 2 * pad) / spanY;
  const uniform = Math.min(fitX, fitY);
  const scaleX = Math.min(fitX, uniform * stretch);
  const scaleY = Math.min(fitY, uniform * stretch);
  const ox = (width - spanX * scaleX) / 2;
  const oy = (height - spanY * scaleY) / 2;
  const toXY = (lat: number, lng: number): [number, number] => [
    ox + (lng * k - minX) * scaleX,
    oy + (-lat - minY) * scaleY,
  ];
  const xs = px.map((x) => ox + (x - minX) * scaleX);
  const ys = py.map((y) => oy + (y - minY) * scaleY);

  const lens = [0];
  for (let i = 1; i < xs.length; i++) {
    lens.push(lens[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!));
  }

  // Stops carry real distances; shape points between two stops split that leg by on-screen length.
  const stopKms = route.path.map((p) => (isStop(p) ? p.km : null));
  const kms = stopKms.map((km) => km ?? 0);
  let prev = 0;
  for (let i = 1; i < kms.length; i++) {
    const km = stopKms[i];
    if (km === null || km === undefined) continue;
    const kmA = kms[prev]!;
    const span = lens[i]! - lens[prev]!;
    for (let j = prev + 1; j < i; j++) {
      kms[j] = kmA + ((km - kmA) * (lens[j]! - lens[prev]!)) / (span || 1);
    }
    prev = i;
  }

  return {
    xs,
    ys,
    kms,
    lens,
    length: lens[lens.length - 1]!,
    d: pathOf(xs.map((x, i) => [x, ys[i]!])),
    toXY,
    latAt: (y) => -((y - oy) / scaleY + minY),
    lngAt: (x) => ((x - ox) / scaleX + minX) / k,
    pxPerKm: scaleY / KM_PER_DEGREE_LAT,
  };
}

function pathOf(points: [number, number][], closed = false): string {
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return closed ? `${d} Z` : d;
}

/** Linear lookup of `values` at distance `km` along the route. */
function along(kms: number[], values: number[], km: number): number {
  'worklet';
  if (km <= kms[0]!) return values[0]!;
  for (let i = 1; i < kms.length; i++) {
    if (km <= kms[i]!) {
      const span = kms[i]! - kms[i - 1]!;
      const t = span > 0 ? (km - kms[i - 1]!) / span : 1;
      return values[i - 1]! + (values[i]! - values[i - 1]!) * t;
    }
  }
  return values[values.length - 1]!;
}

/** A stylised map: land and water, the route as a trail, the walked part drawn in, and you on it. */
export function RouteMap({ route, km, height, traveller, detailed, delay = 250 }: Props) {
  const theme = useAppTheme();
  const colors = theme.dark ? MAP_COLORS.dark : MAP_COLORS.light;
  const [width, setWidth] = useState(0);
  const geo = useMemo(
    () => (width > 0 ? layoutRoute(route, width, height, detailed ? 40 : 26, detailed ? 1 : 1.6) : null),
    [route, width, height, detailed]
  );

  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[styles.map, { height, backgroundColor: colors.land }]}>
      {geo ? (
        <MapCanvas
          geo={geo}
          route={route}
          km={km}
          width={width}
          height={height}
          traveller={traveller}
          detailed={detailed}
          delay={delay}
        />
      ) : null}
    </View>
  );
}

type CanvasProps = Omit<Props, 'height'> & { geo: Geometry; width: number; height: number; delay: number };

function MapCanvas({ geo, route, km, width, height, traveller, detailed, delay }: CanvasProps) {
  const theme = useAppTheme();
  const colors = theme.dark ? MAP_COLORS.dark : MAP_COLORS.light;
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);
  // Worklets only get plain arrays, never the geometry object (it holds JS functions).
  const { kms, lens, xs, ys, length } = geo;

  // Draws in on mount, and glides forward when new steps come in.
  useEffect(() => {
    progress.set(withDelay(delay, withTiming(km, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) })));
  }, [km, delay, progress]);

  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse]);

  const walkedProps = useAnimatedProps(() => ({
    strokeDashoffset: length - along(kms, lens, progress.value),
  }));
  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset: length - along(kms, lens, progress.value),
  }));
  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: along(kms, xs, progress.value) - MARKER / 2 },
      { translateY: along(kms, ys, progress.value) - MARKER / 2 },
    ],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.2 }],
  }));

  const stops = route.path.flatMap((p, i) => (isStop(p) ? [{ stop: p, x: xs[i]!, y: ys[i]! }] : []));
  const start = stops[0]!;
  const finish = stops[stops.length - 1]!;
  const next = traveller && detailed ? stops.find((s) => s.stop.km > km) : undefined;
  const done = km >= route.totalKm;
  const dash = `${length} ${length}`;
  const popKm = Math.max(route.totalKm * 0.04, 0.5);
  // Where the stop names, compass and scale bar go, so the map's own names keep clear of them.
  const shown = [start, finish, ...(next && next !== finish ? [next] : [])];
  const reserved: Box[] = [
    ...shown.map(({ stop, x, y }) => labelBox(x, y, width, next?.stop === stop ? `Next: ${stop.name}` : stop.name)),
    ...(detailed ? [{ x0: 6, y0: 6, x1: 42, y1: 50 }, { x0: 10, y0: height - 36, x1: 100, y1: height - 6 }] : []),
  ];

  return (
    <>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Scenery geo={geo} routeKey={route.key} width={width} height={height} detailed={detailed} reserved={reserved} />

        {/* The road, with a dotted trail along it. */}
        <Path d={geo.d} stroke={colors.road} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path
          d={geo.d}
          stroke={withAlpha(theme.colors.onSurfaceVariant, 0.55)}
          strokeWidth={2.5}
          strokeDasharray="0.1 7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Walked so far: a soft glow under a solid line. */}
        <AnimatedPath
          d={geo.d}
          stroke={withAlpha(theme.colors.primary, 0.28)}
          strokeWidth={13}
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          animatedProps={glowProps}
        />
        <AnimatedPath
          d={geo.d}
          stroke={theme.colors.primary}
          strokeWidth={5}
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          animatedProps={walkedProps}
        />

        {/* Previews (several per screen) keep their dots static; animating them isn't worth the cost. */}
        {stops.slice(0, -1).map(({ stop, x, y }) =>
          traveller ? (
            <StopDot
              key={stop.name}
              x={x}
              y={y}
              km={stop.km}
              popKm={popKm}
              progress={progress}
              fill={theme.colors.primary}
              ring={theme.colors.surface}
              idle={theme.colors.outline}
            />
          ) : (
            <Circle
              key={stop.name}
              cx={x}
              cy={y}
              r={DOT_R}
              fill={theme.colors.primary}
              stroke={theme.colors.surface}
              strokeWidth={2}
            />
          )
        )}
      </Svg>

      {/* Finish line. */}
      <View
        style={[
          styles.finish,
          {
            left: finish.x - 12,
            top: finish.y - 12,
            backgroundColor: done ? theme.colors.primary : theme.colors.surface,
            borderColor: done ? theme.colors.surface : theme.colors.outline,
          },
        ]}>
        <MaterialCommunityIcons
          name="flag-checkered"
          size={13}
          color={done ? theme.colors.onPrimary : theme.colors.onSurface}
        />
      </View>

      <Label x={start.x} y={start.y} width={width} text={start.stop.name} />
      <Label x={finish.x} y={finish.y} width={width} text={finish.stop.name} />
      {next && next !== finish ? <Label x={next.x} y={next.y} width={width} text={next.stop.name} emphasis /> : null}

      {detailed ? (
        <View style={[styles.compass, { backgroundColor: withAlpha(theme.colors.surface, 0.8) }]}>
          <MaterialCommunityIcons name="navigation-variant" size={14} color={theme.colors.onSurfaceVariant} />
          <Text variant="labelSmall" style={[styles.compassN, { color: theme.colors.onSurfaceVariant }]}>
            N
          </Text>
        </View>
      ) : null}

      {traveller ? (
        <Animated.View style={[styles.marker, markerStyle]} pointerEvents="none">
          <Animated.View style={[styles.pulse, { backgroundColor: theme.colors.primary }, pulseStyle]} />
          <Animated.View
            // Pops in once as the line starts drawing, then holds still rather than wobbling.
            entering={popIn(delay)}
            style={[styles.avatarRing, { borderColor: theme.colors.surface }]}>
            <UserAvatar name={traveller.name} color={traveller.color} icon={traveller.icon} size={MARKER - 4} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </>
  );
}

/** A rectangle on the map, for keeping names from landing on each other. */
type Box = { x0: number; y0: number; x1: number; y1: number };

const overlaps = (a: Box, b: Box, gap: number) =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

/** Roughly where a stop's name pill sits: centred over its dot, above it if there's room (see Label). */
function labelBox(x: number, y: number, width: number, text: string): Box {
  const w = text.length * 6.2 + 14;
  const left = Math.min(Math.max(x - w / 2, 4), width - w - 4);
  const top = y - 38 >= 2 ? y - 38 : y + 16;
  return { x0: left, y0: top, x1: left + w, y1: top + 18 };
}

type SceneryProps = {
  geo: Geometry;
  routeKey: string;
  width: number;
  height: number;
  detailed?: boolean;
  /** Taken by stop names and controls; the map's own names stay out of these. */
  reserved: Box[];
};

/** Everything under the route: grid, water, islands, rivers, borders, hills, woods, names, scale. */
function Scenery({ geo, routeKey, width, height, detailed, reserved }: SceneryProps) {
  const theme = useAppTheme();
  const colors = theme.dark ? MAP_COLORS.dark : MAP_COLORS.light;
  const geography = GEOGRAPHY[routeKey];

  const art = useMemo(() => {
    const xy = (points: readonly LatLng[]) => points.map(([lat, lng]) => geo.toXY(lat, lng));

    // A faint lat/long grid, coarser when the map covers more ground.
    const top = geo.latAt(0);
    const bottom = geo.latAt(height);
    const left = geo.lngAt(0);
    const right = geo.lngAt(width);
    const span = top - bottom;
    const step = span > 6 ? 2 : span > 2 ? 1 : 0.5;
    const grid: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let lat = Math.ceil(bottom / step) * step; lat < top; lat += step) {
      const [, y] = geo.toXY(lat, left);
      grid.push({ x1: 0, y1: y, x2: width, y2: y });
    }
    for (let lng = Math.ceil(left / step) * step; lng < right; lng += step) {
      const [x] = geo.toXY(bottom, lng);
      grid.push({ x1: x, y1: 0, x2: x, y2: height });
    }

    const size = detailed ? 7 : 5;
    const hills = (geography?.mountains ?? [])
      .map(([lat, lng]) => {
        const [x, y] = geo.toXY(lat, lng);
        const peak = (cx: number, cy: number, s: number) =>
          `M${(cx - s).toFixed(1)} ${(cy + s * 0.6).toFixed(1)} L${cx.toFixed(1)} ${(cy - s * 0.7).toFixed(1)} L${(cx + s).toFixed(1)} ${(cy + s * 0.6).toFixed(1)} Z`;
        return `${peak(x, y, size)} ${peak(x + size * 0.95, y + size * 0.25, size * 0.7)}`;
      })
      .join(' ');
    const woods = (geography?.forests ?? []).flatMap(([lat, lng]) => {
      const [x, y] = geo.toXY(lat, lng);
      const r = size * 0.5;
      return [
        { cx: x - r, cy: y, r },
        { cx: x + r, cy: y, r },
        { cx: x, cy: y - r * 0.9, r },
      ];
    });

    // Names that fit inside the map without touching another name, a stop's name or the controls;
    // compact maps only name the big water. Big names claim their space first, minor ones after.
    const fontSize = detailed ? 11 : 9;
    const placed: Box[] = [...reserved];
    const labels = (geography?.labels ?? [])
      .filter((l) => detailed || (l.kind === 'water' && !l.minor))
      .sort((a, b) => Number(!!a.minor) - Number(!!b.minor))
      .flatMap((l) => {
        const [x, y] = geo.toXY(l.at[0], l.at[1]);
        const size = l.kind === 'water' ? fontSize : fontSize - 1.5;
        const w = l.kind === 'water' ? l.text.length * size * 0.55 : l.text.length * (size * 0.68 + 2);
        const box = { x0: x - w / 2, y0: y - size, x1: x + w / 2, y1: y + 2 };
        if (box.x0 < 4 || box.x1 > width - 4 || box.y0 < 2 || box.y1 > height - 2) return [];
        if (placed.some((p) => overlaps(p, box, 6))) return [];
        placed.push(box);
        return [{ ...l, x, y }];
      });

    // Scale bar: the longest round distance that fits in about 80 px.
    const scaleKm = SCALE_STEPS_KM.filter((kmStep) => kmStep * geo.pxPerKm <= 80).pop() ?? SCALE_STEPS_KM[0]!;

    return {
      water: (geography?.water ?? []).map((poly) => pathOf(xy(poly), true)),
      islands: (geography?.islands ?? []).map((poly) => pathOf(xy(poly), true)),
      rivers: (geography?.rivers ?? []).map((line) => pathOf(xy(line))),
      borders: (geography?.borders ?? []).map((line) => pathOf(xy(line))),
      grid,
      hills,
      woods,
      labels,
      scale: { km: scaleKm, px: scaleKm * geo.pxPerKm },
    };
  }, [geo, geography, width, height, detailed, reserved]);

  const labelSize = detailed ? 11 : 9;

  return (
    <>
      {art.grid.map((g, i) => (
        <Line key={i} {...g} stroke={colors.grid} strokeWidth={1} />
      ))}

      {/* Coastlines: a soft wash first, then the water with a crisp shore. */}
      {art.water.map((d, i) => (
        <Path key={`wash-${i}`} d={d} fill="none" stroke={withAlpha(colors.water, 0.45)} strokeWidth={detailed ? 7 : 5} strokeLinejoin="round" />
      ))}
      {art.water.map((d, i) => (
        <Path key={`water-${i}`} d={d} fill={colors.water} stroke={colors.shore} strokeWidth={1} strokeLinejoin="round" />
      ))}
      {art.islands.map((d, i) => (
        <Path key={`island-${i}`} d={d} fill={colors.land} stroke={colors.shore} strokeWidth={1} />
      ))}
      {art.rivers.map((d, i) => (
        <Path
          key={`river-${i}`}
          d={d}
          fill="none"
          stroke={colors.shore}
          strokeWidth={detailed ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {art.borders.map((d, i) => (
        <Path key={`border-${i}`} d={d} fill="none" stroke={colors.border} strokeWidth={1.2} strokeDasharray="5 3" />
      ))}
      {art.hills ? <Path d={art.hills} fill={colors.relief} stroke={colors.reliefEdge} strokeWidth={0.8} /> : null}
      {art.woods.map((c, i) => (
        <Circle key={`wood-${i}`} {...c} fill={colors.forest} />
      ))}

      {art.labels.map((l) =>
        l.kind === 'water' ? (
          <SvgText
            key={l.text}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            fontSize={labelSize}
            fontStyle="italic"
            fill={colors.waterText}>
            {l.text}
          </SvgText>
        ) : (
          <SvgText
            key={l.text}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            fontSize={labelSize - 1.5}
            fontWeight="600"
            letterSpacing={2}
            fill={colors.regionText}>
            {l.text}
          </SvgText>
        )
      )}

      {detailed ? (
        <>
          <Path
            d={`M14 ${height - 18} V${height - 12} H${(14 + art.scale.px).toFixed(1)} V${height - 18}`}
            fill="none"
            stroke={colors.regionText}
            strokeWidth={1.5}
          />
          <SvgText x={14} y={height - 22} fontSize={9} fill={colors.regionText}>
            {`${art.scale.km} km`}
          </SvgText>
        </>
      ) : null}
    </>
  );
}

type StopDotProps = {
  x: number;
  y: number;
  km: number;
  /** Distance over which the dot pops after the line reaches it. */
  popKm: number;
  progress: SharedValue<number>;
  fill: string;
  ring: string;
  idle: string;
};

/** Hollow until the walked line reaches it, then fills with a little pop. */
function StopDot({ x, y, km, popKm, progress, fill, ring, idle }: StopDotProps) {
  const reachedProps = useAnimatedProps(() => {
    if (progress.value < km) return { r: 0 };
    const t = (progress.value - km) / popKm;
    return { r: t < 1 ? DOT_R + 3 * Math.sin(Math.PI * t) : DOT_R };
  });

  return (
    <>
      <Circle cx={x} cy={y} r={DOT_R} fill={ring} stroke={idle} strokeWidth={1.5} />
      <AnimatedCircle cx={x} cy={y} fill={fill} stroke={ring} strokeWidth={2} animatedProps={reachedProps} />
    </>
  );
}

/** Stop name in a small pill above its dot (below if there's no room), kept inside the map. */
function Label({ x, y, width, text, emphasis }: { x: number; y: number; width: number; text: string; emphasis?: boolean }) {
  const theme = useAppTheme();
  const left = Math.min(Math.max(x - LABEL_W / 2, 4), width - LABEL_W - 4);
  const align = left <= 4 ? 'flex-start' : left >= width - LABEL_W - 4 ? 'flex-end' : 'center';
  // Clear of the dot or finish badge (±12), above if there's room.
  const top = y - 38 >= 2 ? y - 38 : y + 16;

  return (
    <View pointerEvents="none" style={[styles.label, { left, top, alignItems: align }]}>
      <Text
        variant="labelSmall"
        numberOfLines={1}
        style={[
          styles.labelText,
          emphasis
            ? { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary, fontWeight: '700' }
            : { backgroundColor: withAlpha(theme.colors.surface, 0.9), color: theme.colors.onSurface },
        ]}>
        {emphasis ? `Next: ${text}` : text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 20, overflow: 'hidden' },
  finish: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { position: 'absolute', width: LABEL_W },
  labelText: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  // Top-left is open on all four routes.
  compass: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassN: { lineHeight: 12 },
  marker: { position: 'absolute', left: 0, top: 0, width: MARKER, height: MARKER },
  pulse: { position: 'absolute', width: MARKER, height: MARKER, borderRadius: MARKER / 2 },
  avatarRing: { borderRadius: MARKER / 2, borderWidth: 2, overflow: 'hidden' },
});
