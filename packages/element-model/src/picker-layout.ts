// How a Picker's face lays out at its size, and what its corner count says (docs/specs/012-collaboration/
// picker.md "The look"). Pure and shared by the canvas face (@liveworkspace/workbench PickerFace) and the
// headless render (svg-render-picker), so an export stands where the canvas does.

export type PickerLayout = {
  // The payline name's size in px, grown with the card up to a limit.
  nameSize: number;
  // One reel row's height, in px.
  rowH: number;
  // Half a row above and below the payline, fading out like a real reel (gone on a short card, so
  // the name keeps the room).
  neighbours: boolean;
  // The kicker and count (gone on a very short card).
  header: boolean;
  // The struck-through names already drawn (only on a card tall enough to list them).
  drawnList: boolean;
  avatarSize: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// A long written option (an icebreaker question) is set smaller than a name, so two lines of it fit.
const LONG_LABEL = 28;
// The fixed parts of the column, each with the face's 6px gap: padding, header, buttons, drawn list,
// and the all-drawn line.
export const PICKER_PAD = 16;
export const PICKER_HEADER = 24;
export const PICKER_CONTROLS = 34;
const DRAWN = 30;
const CAPTION = 22;
const MIN_ROW = 26;
const MAX_ROW = 84;

export function pickerLayout(
  width: number,
  height: number,
  // What else the column holds: the longest name on the reel, the buttons, names already drawn, and
  // the all-drawn line.
  { longest = 0, controls = true, drawn = false, caption = false } = {},
): PickerLayout {
  const header = height >= 84;
  let avail =
    height -
    PICKER_PAD -
    (header ? PICKER_HEADER : 0) -
    (controls ? PICKER_CONTROLS : 0) -
    (caption ? CAPTION : 0);
  const drawnList = drawn && header && width >= 200 && avail - DRAWN >= 2 * 36;
  if (drawnList) avail -= DRAWN;
  // Two rows of height: the payline and a half row either side of it.
  const neighbours = avail / 2 >= MIN_ROW;
  const rowH = Math.round(clamp(neighbours ? avail / 2 : avail, 20, MAX_ROW));
  const long = longest > LONG_LABEL;
  const nameSize = Math.round(
    clamp(Math.min(rowH / (long ? 2.7 : 1.7), width * (long ? 0.07 : 0.11)), 12, 40),
  );
  return {
    nameSize,
    rowH,
    neighbours,
    header,
    drawnList,
    avatarSize: clamp(Math.round(nameSize * 1.3), 16, 44),
  };
}

// The corner count: how big the pool is, or with Remove Once Drawn how much of it is left.
export function pickerCountText(input: {
  source: 'participants' | 'options';
  total: number;
  left: number;
  removeDrawn: boolean;
}): string {
  const { source, total, left, removeDrawn } = input;
  if (total === 0) return '';
  if (removeDrawn) return left === 0 ? 'All drawn' : `${left} of ${total} left`;
  if (source === 'participants') return `${total} here`;
  return total === 1 ? '1 option' : `${total} options`;
}

// The accent the reel is lit in: the element's own stroke (a theme's or the author's), else the brand sky,
// a step lighter on dark paper. Not the Default scheme's dark stroke: that slate is a border, and a Spin
// button in it reads as disabled.
export const PICKER_DEFAULT_ACCENT = { light: '#0ea5e9', dark: '#38bdf8' } as const;
export function pickerAccent(own: string | undefined, surface: 'light' | 'dark'): string {
  return own ?? PICKER_DEFAULT_ACCENT[surface];
}
