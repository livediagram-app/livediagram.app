// The pixel character's outfit below the waist, from the front and in profile (./avatar-sprite-outfit holds each
// look). Re-exported from ./avatar-sprite-outfit.
import { APRON, APRON_DARK, COAT, COAT_DARK, type OutfitTones } from './avatar-sprite-palette';
import type { Clothing } from './avatar-sprite-outfit';
import { span } from './avatar-sprite-outfit-torso';

// --- Below the waist -------------------------------------------------------------

// Front / back: the dress's long flared skirt, the skirt's short pleated one, the lab coat's tails, the apron's
// long front. Drawn over the legs. `back` closes the lab coat and hides the apron (which is all at the front).
export function OutfitLowerFront({
  clothing,
  t,
  inset,
  back,
}: {
  clothing: Clothing;
  t: OutfitTones;
  inset: number;
  back: boolean;
}) {
  const { L, R, W } = span(inset);
  switch (clothing) {
    case 'dress':
      // Flares from the waist to past the knees, with a darker hem.
      return (
        <g>
          <rect x={L} y={14} width={W} height={2} fill={t.base} />
          <rect x={3} y={16} width={10} height={1} fill={t.base} />
          <rect x={2} y={17} width={12} height={2} fill={t.base} />
          <rect x={11} y={16} width={2} height={2} fill={t.dark} />
          <rect x={2} y={18} width={12} height={1} fill={t.deep} />
        </g>
      );
    case 'skirt':
      // A waistband, then a short A-line with two pleats, ending above the knee.
      return (
        <g>
          <rect x={L} y={14} width={W} height={1} fill={t.deep} />
          <rect x={4} y={15} width={8} height={1} fill={t.base} />
          <rect x={3} y={16} width={10} height={1} fill={t.base} />
          <rect x={10} y={15} width={2} height={2} fill={t.dark} />
          <rect x={6} y={15} width={1} height={2} fill={t.dark} />
        </g>
      );
    case 'labcoat':
      // Long tails past the hips: open at the front, closed with a vent at the back.
      return back ? (
        <g>
          <rect x={L} y={15} width={W} height={3} fill={COAT} />
          <rect x={R - 1} y={15} width={2} height={3} fill={COAT_DARK} />
          <rect x={7} y={15} width={1} height={3} fill={COAT_DARK} />
        </g>
      ) : (
        <g>
          <rect x={L} y={15} width={3} height={3} fill={COAT} />
          <rect x={R - 2} y={15} width={3} height={3} fill={COAT_DARK} />
        </g>
      );
    case 'apron':
      return back ? null : (
        <g>
          <rect x={5} y={15} width={6} height={3} fill={APRON} />
          <rect x={10} y={15} width={1} height={3} fill={APRON_DARK} />
        </g>
      );
    default:
      return null;
  }
}

// Profile (facing LEFT): the same pieces seen from the side.
export function OutfitLowerProfile({ clothing, t }: { clothing: Clothing; t: OutfitTones }) {
  switch (clothing) {
    case 'dress':
      return (
        <g>
          <rect x={5} y={14} width={7} height={2} fill={t.base} />
          <rect x={4} y={16} width={9} height={2} fill={t.base} />
          <rect x={11} y={14} width={2} height={4} fill={t.dark} />
          <rect x={3} y={18} width={10} height={1} fill={t.deep} />
        </g>
      );
    case 'skirt':
      return (
        <g>
          <rect x={5} y={14} width={7} height={1} fill={t.deep} />
          <rect x={4} y={15} width={9} height={2} fill={t.base} />
          <rect x={11} y={15} width={2} height={2} fill={t.dark} />
        </g>
      );
    case 'labcoat':
      return (
        <g>
          <rect x={5} y={15} width={7} height={3} fill={COAT} />
          <rect x={10} y={15} width={2} height={3} fill={COAT_DARK} />
        </g>
      );
    case 'apron':
      return <rect x={4} y={15} width={2} height={3} fill={APRON} />;
    default:
      return null;
  }
}
