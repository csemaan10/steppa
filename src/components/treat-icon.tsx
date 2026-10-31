import Svg, { Path } from 'react-native-svg';

import { TREAT } from '@/components/game/colors';
import { TREAT_ICON } from '@/lib/world/treat-icon';

/** Chocolate chips, darker than the cookie's own deep shade. */
const CHIPS = '#7A4310';

/**
 * A treat, as the app's own cookie icon (src/lib/world/treat-icon.ts): in cookie colours, or all in
 * `color` with the chips cut out, to sit in a button or a line of text.
 */
export function TreatIcon({ size = 20, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {color ? (
        <Path d={TREAT_ICON.cookie + TREAT_ICON.chips} fill={color} fillRule="evenodd" />
      ) : (
        <>
          <Path d={TREAT_ICON.cookie} fill={TREAT.face} />
          <Path d={TREAT_ICON.chips} fill={CHIPS} />
        </>
      )}
      <Path d={TREAT_ICON.crumbs} fill={color ?? TREAT.face} />
    </Svg>
  );
}

/** The treat icon as a button's icon, in the button's own colour. */
export const treatButtonIcon = ({ size, color }: { size: number; color: string }) => (
  <TreatIcon size={size + 2} color={color} />
);
