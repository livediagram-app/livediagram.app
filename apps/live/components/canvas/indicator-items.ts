// What an element's indicators are, and how much room they take
// (docs/specs/008-canvas/element-indicators.md). The items are built once from the element's
// state; the size is ESTIMATED from fixed glyph, gap and character widths rather than measured,
// so placement is pure and runs before anything is drawn (blueprint D76).

export type IndicatorKind = 'outline' | 'tidy' | 'link' | 'note' | 'action' | 'comment';

export type IndicatorItem = {
  kind: IndicatorKind;
  // The button's accessible name.
  label: string;
  onClick: () => void;
  // A command (a mind root's Edit Outline / Tidy Map): hidden until hovered or selected.
  command?: boolean;
  // Unresolved comments.
  count?: number;
  // The footer's word beside the glyph.
  word?: string;
  // The action's assignee, drawn as an initials disc in the footer.
  assignee?: { initials: string; color: string };
  hoverCard?: { title: string; description: string };
  dataAttr?: string;
};

// How a cluster is drawn: the corner glyphs, the footer row with or without its words, or the
// pip on the outline when neither fits.
export type IndicatorForm = 'corner' | 'footer' | 'footer-compact' | 'pip';

// Corner: 20px square buttons (a 14px glyph in 3px padding) on a backing padded 2px.
export const CORNER_BUTTON_PX = 20;
export const CORNER_BACKING_PAD_PX = 2;
// Footer: a 22px row padded 4px, items 10px apart, 12px glyphs, a 16px initials disc, the word
// 4px after its glyph.
export const FOOTER_ROW_PX = 22;
export const FOOTER_PAD_PX = 4;
export const FOOTER_GAP_PX = 10;
export const FOOTER_GLYPH_PX = 12;
export const FOOTER_DISC_PX = 16;
export const FOOTER_WORD_GAP_PX = 4;
// The average advance of the 11px digits and words, a little generous so text never clips.
const DIGIT_PX = 7;
const CHAR_PX = 6.2;

const countPx = (count: number) => String(count).length * DIGIT_PX + 2;

/** The cluster's size in canvas px for `form` (the pip is never placed, so it has none). */
export function clusterSize(
  items: readonly IndicatorItem[],
  form: Exclude<IndicatorForm, 'pip'>,
): { width: number; height: number } {
  if (items.length === 0) return { width: 0, height: 0 };
  if (form === 'corner') {
    const buttons = items.reduce(
      (sum, item) => sum + CORNER_BUTTON_PX + (item.count ? countPx(item.count) : 0),
      0,
    );
    return {
      width: buttons + 2 * CORNER_BACKING_PAD_PX,
      height: CORNER_BUTTON_PX + 2 * CORNER_BACKING_PAD_PX,
    };
  }
  const widths = items.map((item) => {
    if (item.command) return CORNER_BUTTON_PX;
    const lead = item.assignee ? FOOTER_DISC_PX : FOOTER_GLYPH_PX;
    if (item.count) return lead + FOOTER_WORD_GAP_PX + countPx(item.count);
    if (form === 'footer' && item.word) {
      return lead + FOOTER_WORD_GAP_PX + item.word.length * CHAR_PX;
    }
    return lead;
  });
  return {
    width:
      widths.reduce((a, b) => a + b, 0) + FOOTER_GAP_PX * (items.length - 1) + 2 * FOOTER_PAD_PX,
    height: FOOTER_ROW_PX,
  };
}

/** The element's items, commands first, then link, note, action, comment. */
export function buildIndicatorItems(input: {
  outline?: () => void;
  tidy?: () => void;
  link?: { onFollow: () => void; destination?: string };
  note?: () => void;
  action?: { onOpen: () => void; assigneeName: string; initials: string; color: string };
  comments?: { count: number; onOpen: () => void };
}): IndicatorItem[] {
  const items: IndicatorItem[] = [];
  if (input.outline) {
    items.push({
      kind: 'outline',
      label: 'Edit Outline',
      onClick: input.outline,
      command: true,
      hoverCard: { title: 'Edit Outline', description: 'Edit the whole map as a list.' },
    });
  }
  if (input.tidy) {
    items.push({
      kind: 'tidy',
      label: 'Tidy Map',
      onClick: input.tidy,
      command: true,
      hoverCard: { title: 'Tidy Map', description: 'Lay the whole map out neatly again.' },
    });
  }
  if (input.link) {
    items.push({
      kind: 'link',
      label: 'Follow link',
      word: 'Link',
      onClick: input.link.onFollow,
      hoverCard: {
        title: 'Follow link',
        description: input.link.destination ?? 'Open the linked destination.',
      },
    });
  }
  if (input.note) {
    items.push({ kind: 'note', label: 'Open note', word: 'Note', onClick: input.note });
  }
  if (input.action) {
    const { assigneeName, initials, color, onOpen } = input.action;
    items.push({
      kind: 'action',
      label: 'Open action',
      word: 'Action',
      onClick: onOpen,
      assignee: { initials, color },
      hoverCard: { title: 'Open action', description: `Assigned to ${assigneeName}` },
      dataAttr: 'data-action-trigger',
    });
  }
  if (input.comments && input.comments.count > 0) {
    const { count, onOpen } = input.comments;
    items.push({
      kind: 'comment',
      label: `Open ${count} comment${count === 1 ? '' : 's'}`,
      count,
      onClick: onOpen,
      dataAttr: 'data-comment-trigger',
    });
  }
  return items;
}

/** The backing behind the glyphs: the element's fill, or none when it paints nothing. */
export function indicatorBacking(fill: string | undefined): string | undefined {
  return !fill || fill === 'transparent' || fill === 'none' ? undefined : fill;
}
