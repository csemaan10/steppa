// The treat icon: a round cookie with a bite out of it and chocolate chips, on a 48 × 48 grid, in the
// same flat style as the trick icons (src/lib/world/trick-icons.ts). src/components/treat-icon.tsx
// draws it in cookie colours, or in one colour with the chips cut out.

import { circle, ellipse, n } from '@/lib/scene-art';

const CX = 24;
const CY = 25;
const R = 19;
/** Where the bite starts and ends round the edge (degrees, clockwise from three o'clock). */
const BITE_FROM = -64;
const BITE_TO = -16;

const at = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
};

/** The cookie: all the way round from the end of the bite to its start, then two scallops back in. */
function cookie(): string {
  const [x0, y0] = at(R, BITE_TO);
  const [x1, y1] = at(R, BITE_FROM);
  const [qx, qy] = at(R - 6.5, (BITE_FROM + BITE_TO) / 2);
  return (
    `M${n(x0)} ${n(y0)}A${R} ${R} 0 1 1 ${n(x1)} ${n(y1)}` +
    `A6 6 0 0 0 ${n(qx)} ${n(qy)}A6 6 0 0 0 ${n(x0)} ${n(y0)}Z`
  );
}

export const TREAT_ICON = {
  cookie: cookie(),
  chips:
    ellipse(15, 17.5, 3.2, 2.6) +
    ellipse(12.5, 30, 2.7, 2.2) +
    ellipse(22, 36.5, 3.2, 2.6) +
    ellipse(31.5, 30, 2.8, 2.3) +
    ellipse(21.5, 24.5, 2.3, 1.9) +
    ellipse(31, 39.5, 2.2, 1.8),
  crumbs: circle(43.5, 8.5, 1.7) + circle(39, 4.2, 1.2),
};
