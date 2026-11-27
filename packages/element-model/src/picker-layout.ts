// How a Picker's face lays out at its size, and what its corner count says (docs/specs/012-collaboration/
// picker.md "The look"). Pure and shared by the canvas face (@liveworkspace/workbench PickerFace) and the
// headless render (svg-render-picker), so an export stands where the canvas does.

export type PickerLayout = {
  // A short card: one row, the payline beside a round Spin, no header. Nothing sits under the corner
  // menu at any height: the header row clears it on a taller card, the row's right gutter here.
  compact: boolean;
  // The payline name's size in px, grown with the card up to a limit and shrunk until the longest name
  // fits whole in the lines the payline has.
  nameSize: number;
  // How many lines the payline name may take (a written question wraps; a name stays on one).
  lines: number;
  // One reel row's height, in px.
  rowH: number;
  // How much of the rows above and below the payline shows, in px, fading out like a real reel: half a
  // row on a default card, a whole one on a big card, none when the name needs the room.
  peek: number;
  // The kicker and count, pinned to the top (gone on a compact card).
  header: boolean;
  // The struck-through names already drawn (only on a card tall enough to list them).
  drawnList: boolean;
  // The all-drawn line under the reel (only where the payline keeps a row beside it).
  caption: boolean;
  avatarSize: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// The fixed parts of the column, each with the face's 6px gap: padding, header, buttons, drawn list,
// and the all-drawn line.
export const PICKER_PAD = 16;
export const PICKER_HEADER = 24;
export const PICKER_CONTROLS = 34;
const DRAWN = 30;
const CAPTION = 22;
const MIN_ROW = 26;
const MAX_ROW = 84;
// A payline taking the whole window for a long written option may grow taller than a name's row.
const MAX_LONG_ROW = 168;
// Under this much room for the reel a card is compact: one row, no header.
const MIN_COMPACT_ROW = 30;
// A compact card's round buttons (28px and the gap), and the corner menu's gutter (the `…` is 20px
// at 4px in).
export const PICKER_ROUND_BUTTON = 34;
export const PICKER_MENU_GUTTER = 28;
// A row's own side padding: clear of the payline's notches.
const ROW_INSET = 48;
const COMPACT_ROW_INSET = 32;
// How wide a semibold character runs, as a share of its size, and the line height: generous, so a
// name the layout says fits does fit.
const CHAR_EM = 0.58;
const LEADING = 1.25;
const MIN_NAME = 11;
const MAX_NAME = 40;

const linesAt = (rowH: number, size: number) => Math.max(1, Math.floor(rowH / (size * LEADING)));
const perLine = (textW: number, size: number) => Math.max(1, Math.floor(textW / (size * CHAR_EM)));
// Whether `longest` characters fit at `size`: wrapped lines lose some width to whole words.
const fitsAt = (longest: number, textW: number, rowH: number, size: number) => {
  const lines = linesAt(rowH, size);
  return longest <= perLine(textW, size) * lines * (lines > 1 ? 0.85 : 1);
};
// The biggest size up to `cap` at which the longest name fits whole.
function fitName(longest: number, textW: number, rowH: number, cap: number): number {
  for (let size = cap; size > MIN_NAME; size--) {
    if (fitsAt(longest, textW, rowH, size)) return size;
  }
  return MIN_NAME;
}

export type PickerLayoutInput = {
  // The longest name on the reel, in characters.
  longest?: number;
  // A Spin (or Reset) button under the reel, or beside it on a compact card.
  controls?: boolean;
  // A second round button beside Spin (Reset mid-round), which only a compact card makes room for.
  reset?: boolean;
  // Names already drawn to list, and the all-drawn line.
  drawn?: boolean;
  caption?: boolean;
  // Avatars beside the names (a people picker).
  avatars?: boolean;
  // The element's corner menu (`…`) is on this card, so a compact row keeps its gutter clear.
  menu?: boolean;
};

export function pickerLayout(
  width: number,
  height: number,
  {
    longest = 0,
    controls = true,
    reset = false,
    drawn = false,
    caption = false,
    avatars = false,
    menu = false,
  }: PickerLayoutInput = {},
): PickerLayout {
  const cap = (rowH: number) => Math.round(clamp(Math.min(rowH / 1.7, width * 0.11), 12, MAX_NAME));
  const avatarRoom = (size: number) => (avatars ? clamp(Math.round(size * 1.3), 16, 44) + 8 : 0);
  const finish = (
    rowH: number,
    peek: number,
    textW: number,
    rest: Pick<PickerLayout, 'compact' | 'header' | 'drawnList' | 'caption'>,
  ): PickerLayout => {
    const nameSize = fitName(longest, textW - avatarRoom(cap(rowH)), rowH, cap(rowH));
    return {
      ...rest,
      nameSize,
      lines: linesAt(rowH, nameSize),
      rowH,
      peek,
      avatarSize: clamp(Math.round(nameSize * 1.3), 16, Math.min(44, rowH - 6)),
    };
  };

  let avail = height - PICKER_PAD - PICKER_HEADER - (controls ? PICKER_CONTROLS : 0);
  // Too short for a header, a payline and a button stacked: one row.
  if (avail < MIN_COMPACT_ROW) {
    const buttons = controls ? PICKER_ROUND_BUTTON * (reset ? 2 : 1) : 0;
    const textW =
      width - PICKER_PAD - COMPACT_ROW_INSET - buttons - (menu ? PICKER_MENU_GUTTER : 0);
    const rowH = Math.round(clamp(height - PICKER_PAD, 20, MAX_ROW));
    return finish(rowH, 0, textW, {
      compact: true,
      header: false,
      drawnList: false,
      caption: false,
    });
  }
  // The all-drawn line and the drawn list only where the payline keeps a row.
  const captionShown = caption && avail - CAPTION >= MIN_ROW;
  if (captionShown) avail -= CAPTION;
  const drawnList = drawn && width >= 200 && avail - DRAWN >= 2 * 36;
  if (drawnList) avail -= DRAWN;
  const textW = width - PICKER_PAD - ROW_INSET;
  const rest = { compact: false, header: true, drawnList, caption: captionShown };
  // Room either side: the payline in the middle, and up to a whole row showing above and below.
  if (avail / 2 >= MIN_ROW) {
    const rowH = Math.round(clamp(avail / 2, MIN_ROW, MAX_ROW));
    const size = cap(rowH);
    // A name that fits on one line keeps the reel's depth; a long written option takes the whole
    // window for the payline instead, so it reads whole.
    if (longest <= perLine(textW - avatarRoom(size), size)) {
      return finish(rowH, Math.min(rowH, Math.floor((avail - rowH) / 2)), textW, rest);
    }
    return finish(Math.round(clamp(avail, 20, MAX_LONG_ROW)), 0, textW, rest);
  }
  return finish(Math.round(clamp(avail, 20, MAX_ROW)), 0, textW, rest);
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
