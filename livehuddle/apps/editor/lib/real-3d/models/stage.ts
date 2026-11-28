// Real 3D's Stage (docs/specs/008-canvas/3d-view.md "A stage stands up"; docs/specs/009-elements/venue-pieces.md "The
// stronger Stage"): a raised platform, not a tray. Its whole box is a deck of honey boards at the deck's height on solid
// dark wooden sides, a nosing along its front lip, the front edge's stained skirt with its footlights and the name
// plate ("Stage", or the stage's own name) in the middle, and two steps up at its front left. A character on it stands
// on the deck (scene-pieces.ts `padTops`), and so does what is placed on it. In the drawing's tones (office.ts). Pure.
import { STAGE_FLOOR, STAGE_TONES } from '@livehuddle/document';
import { SPACE_STAGE_LIFT } from '@/lib/space-3d/space-3d-pieces';
import { faceText } from '../text-mesh';
import { parseColour } from '../mesh-builder';
import { mix, RISE, WALL_RISE, type ModelTable } from './kit';

const hex = (s: string) => parseInt(s.replace('#', ''), 16);

/** The deck's height as built: the stage's lift, as high as its walls once stood (they rise less than pieces). */
export const STAGE_DECK = (SPACE_STAGE_LIFT * WALL_RISE) / RISE;
/** The steps up at the front: how wide, how deep each tread, and how far in from the left end. */
export const STAGE_STEP = { width: 34, tread: 7, inset: 14 } as const;
/** A stage narrower than this has no steps (they would run into its name plate). */
export const STAGE_STEPS_FROM = 150;
/** The footlights: one about every this far along the front edge, clear of the plate. */
const LAMP_EVERY = 40;
const PLANK = 12;
const PLANKS_MAX = 40;

/** The name plate's width along the front edge: 40% of the stage, between 64 and 160, as the drawing has it. */
export function stagePlateWidth(width: number): number {
  return Math.min(width - 16, Math.max(64, Math.min(160, width * 0.4)));
}

/** The deck's colour: the stage's own fill when it is a colour, else the drawing's honey boards. */
export function stageDeckColour(fill: unknown): number {
  if (typeof fill === 'string' && /^#[0-9a-f]{3,8}$/i.test(fill.trim())) return parseColour(fill);
  return hex(STAGE_FLOOR);
}

export const STAGE_MODELS: ModelTable = {
  stage: (m, { f, label, fill }) => {
    const { x0, y0, x1, y1 } = f.foot;
    const W = x1 - x0;
    const H = STAGE_DECK;
    const deck = stageDeckColour(fill);
    const skirt = hex(STAGE_TONES.skirt);
    const nosing = hex(STAGE_TONES.nosing);
    const side = mix(skirt, 0x000000, 0.18);
    const LIP = 2.4;
    // The carcass: solid sides of dark wood from the floor up under the boards.
    m.b(x0, y0, 0, x1, y1 - 1.2, H - 1.6, side, { top: mix(deck, 0x000000, 0.45), sharp: true });
    // The deck's boards, across its width, a hair apart so their seams read, alternate boards a shade apart.
    const depth = y1 - LIP - y0;
    const rows = Math.min(PLANKS_MAX, Math.max(1, Math.round(depth / PLANK)));
    for (let i = 0; i < rows; i++) {
      const ya = y0 + (depth * i) / rows;
      const yb = y0 + (depth * (i + 1)) / rows;
      const tone = mix(deck, i % 2 ? 0x000000 : 0xffffff, i % 3 === 0 ? 0.06 : 0.03);
      m.b(x0 + 0.3, ya + 0.25, H - 1.6, x1 - 0.3, yb - 0.25, H, tone, { bare: true, sharp: true });
    }
    // The nosing along the front lip, standing a touch proud of the skirt.
    m.b(x0 - 0.6, y1 - LIP, H - 2.6, x1 + 0.6, y1 + 0.7, H + 0.3, nosing);
    // The front edge's stained skirt, and a darker toe board along the floor.
    m.b(x0, y1 - 1.2, 1.6, x1, y1 + 0.2, H - 2.6, skirt, { sharp: true });
    m.b(x0, y1 - 1.2, 0, x1, y1 + 0.5, 1.6, mix(skirt, 0x000000, 0.35), {
      bare: true,
      sharp: true,
    });
    // The name plate in the middle of the skirt: a brass rim round a pale plate, the stage's name on it.
    const P = stagePlateWidth(W);
    const pz0 = 2.6;
    const pz1 = H - 4;
    if (P > 20) {
      m.b(-P / 2 - 0.8, y1 + 0.2, pz0 - 0.8, P / 2 + 0.8, y1 + 0.8, pz1 + 0.8, 0xb08d57, {
        bare: true,
      });
      m.b(-P / 2, y1 + 0.8, pz0, P / 2, y1 + 1.2, pz1, mix(deck, 0xffffff, 0.55), { bare: true });
      faceText(m, label?.trim() || 'Stage', {
        at: [0, y1 + 1.45, (pz0 + pz1) / 2],
        right: [1, 0, 0],
        up: [0, 0, 1],
        normal: [0, 1, 0],
        height: Math.min(8, (pz1 - pz0) * 0.62),
        maxWidth: P - 8,
        colour: 0x2a1a10,
      });
    }
    // The footlights along the skirt under the lip, clear of the plate, as the drawing's row.
    const lamps = Math.max(0, Math.floor((W - 16) / LAMP_EVERY));
    const step = lamps > 0 ? (W - 16) / lamps : 0;
    const lamp = hex(STAGE_TONES.lamp);
    const glow = hex(STAGE_TONES.lampGlow);
    for (let i = 0; i < lamps; i++) {
      const x = x0 + 8 + step * (i + 0.5);
      if (x > -P / 2 - 8 && x < P / 2 + 8) continue;
      m.b(x - 3.2, y1 + 0.2, H - 6.4, x + 3.2, y1 + 2.4, H - 3, mix(skirt, 0x000000, 0.4), {
        bare: true,
      });
      m.sphere(x, y1 + 2.2, H - 4.7, 2.1, 0.9, 1.3, glow, { segments: 10, rings: 4, from: 0.5 });
      m.b(x - 2.6, y1 + 2.3, H - 3.4, x + 2.6, y1 + 2.6, H - 3, lamp, { bare: true, sharp: true });
    }
    // Two steps up at the front left, on a stage wide enough to keep them clear of the plate.
    for (const s of stageSteps(W)) {
      const sx0 = x0 + s.x0;
      m.b(sx0, y1 + s.y0, 0, sx0 + STAGE_STEP.width, y1 + s.y1, s.z, side, {
        top: mix(deck, 0x000000, 0.08),
      });
      m.b(
        sx0 - 0.4,
        y1 + s.y1 - 1.6,
        s.z - 1.4,
        sx0 + STAGE_STEP.width + 0.4,
        y1 + s.y1 + 0.4,
        s.z + 0.3,
        nosing,
        {
          bare: true,
        },
      );
    }
  },
};

/**
 * The steps at the front of a stage `width` wide, in its frame from its left end and its front edge: each tread's
 * span across (x0 from the left end), out in front (y0 to y1 past the front edge) and its top (z, as built). None on
 * a narrow stage.
 */
export function stageSteps(width: number): { x0: number; y0: number; y1: number; z: number }[] {
  if (width < STAGE_STEPS_FROM) return [];
  const { tread, inset } = STAGE_STEP;
  return [
    { x0: inset, y0: 0, y1: tread, z: (STAGE_DECK * 2) / 3 },
    { x0: inset, y0: tread, y1: tread * 2, z: STAGE_DECK / 3 },
  ];
}
