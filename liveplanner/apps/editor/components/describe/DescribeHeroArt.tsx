// Describe a Plan's and Describe a Form's hero art (docs/specs/026-plan/describe-a-plan.md, docs/specs/030-forms/
// describe-a-form.md), the Describe with AI family's drawing (@liveworkspace/ui/dialog-hero-art/describe-rule: the
// person's words in a speech bubble, the accent's sparkle on its corner, a dashed arrow) with an ending of their own:
// a board of three columns of cards (a plan), or a sheet of questions with one answer picked (a form).
import {
  DESCRIBE_INK as INK,
  DESCRIBE_PLATE as PLATE,
  describeHeroArt,
} from '@liveworkspace/ui/dialog-hero-art/describe-rule';

// A plan: a board rising off the foot, three columns, their cards under each heading.
const BOARD = (
  <>
    <rect x="56" y="5" width="38" height="32" rx="5" {...PLATE} />
    <path d="M60.5 10.5h6M72 10.5h6M83.5 10.5h6" {...INK} strokeWidth="1.8" />
    {[
      [60, 14.5],
      [60, 22.5],
      [71.5, 14.5],
      [83, 14.5],
      [83, 22.5],
    ].map(([x, y]) => (
      <rect key={`${x}.${y}`} x={x} y={y} width="7.5" height="6" rx="1.6" fill="var(--hero-wash)" />
    ))}
  </>
);

// A form: a sheet rising off the foot, its heading, two choices, the second picked.
const SHEET = (
  <>
    <rect x="59" y="4" width="32" height="33" rx="5" {...PLATE} />
    <path d="M64.5 10.5h13" {...INK} />
    <circle cx="66.5" cy="18" r="2.1" {...INK} strokeWidth="1.4" />
    <path d="M71.5 18h13" {...INK} stroke="var(--hero-line)" />
    <circle cx="66.5" cy="25.5" r="2.6" fill="var(--hero-mark)" />
    <path d="M71.5 25.5h10" {...INK} stroke="var(--hero-line)" />
  </>
);

export const describePlanHeroArt = describeHeroArt('describe-plan', BOARD);
export const describeFormHeroArt = describeHeroArt('describe-form', SHEET);
