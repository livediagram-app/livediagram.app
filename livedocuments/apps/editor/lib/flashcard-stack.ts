// The stack (docs/specs/007-editor/flashcards.md "The stack", pages-mode.md "Stacked infographics"): a tab of
// flashcards (by default), or any other tab but an article's stacked from Contents Options, shows one page at a time,
// the page in front, with the pages still to come fanned out behind it. The canvas's world
// layers (the sheets, the writing, the elements) are given the view narrowed to that card
// (flashcardStage); the chrome keeps the whole row. Pure.
import { tabStacksPages, type LaidOutPage, type PageRect } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';

// At most this many cards show behind the card in front: enough depth to read as "many".
export const FLASHCARD_STACK_MAX = 6;
// The presenter's note cards (PresenterNoteCards) stack straight: each card behind this much lower (px) and this much
// narrower each side.
export const FLASHCARD_STACK_STEP_Y = 10;
export const FLASHCARD_STACK_INSET_X = 14;
// The cards behind recede rather than compete (flashcards.md "The cards behind"): the nearest at this opacity, each
// further back this much fainter, never below the floor.
const STACK_NEAR_OPACITY = 0.5;
const STACK_FADE_STEP = 0.06;
const STACK_FAINTEST = 0.2;

export type CardStack = {
  // The card in front's place (0 first) and how many cards the stack holds.
  index: number;
  count: number;
  // How many cards come after it.
  behind: number;
};

/** The card in front and where it stands, its `pages` the one card: kept by identity while the
 *  row and the card are (usePagesMode memoises it). Null off a stack. */
export type CardStage = { pages: LaidOutPage[]; stack: CardStack };

export function cardStageOf(pages: LaidOutPage[], cardId: string | null): CardStage | null {
  if (!cardId) return null;
  const index = pages.findIndex((p) => p.id === cardId);
  if (index < 0) return null;
  const count = pages.length;
  return { pages: [pages[index]!], stack: { index, count, behind: count - index - 1 } };
}

/** The view the world layers draw in a stack: the card in front alone (the whole row kept for the
 *  writing's layout), and where it stands. Any other view as it is. */
export function flashcardStage(view: PagesModeView): PagesModeView {
  const { cardStage, ...rest } = view;
  // A page slide presenting shows its own page alone already.
  if (!cardStage || view.letterbox) return view;
  return {
    ...rest,
    pages: cardStage.pages,
    rowPages: view.rowPages ?? view.pages,
    cardStack: cardStage.stack,
  };
}

// Cards each side of the card in front whose writing stays mounted (flashcards.md "Long stacks stay quick"): the
// card a flip leaves (forward) or arrives at (back) is pictured from its writing, so one each side is enough.
export const FLASHCARD_MOUNT_SPAN = 1;

/** The writing to mount on a stack: the cards within FLASHCARD_MOUNT_SPAN of the card in front, and `keep` (the
 *  article being written, a card asked to take focus). Null off a stack: every article's writing mounts. */
export function cardFlowsToMount(
  row: readonly LaidOutPage[],
  stack: CardStack | undefined,
  keep: readonly (string | null | undefined)[],
): ReadonlySet<string> | null {
  if (!stack) return null;
  const out = new Set<string>();
  const from = Math.max(0, stack.index - FLASHCARD_MOUNT_SPAN);
  const to = Math.min(row.length - 1, stack.index + FLASHCARD_MOUNT_SPAN);
  for (let i = from; i <= to; i++) {
    const flow = row[i]?.flow;
    if (flow) out.add(flow);
  }
  for (const flow of keep) if (flow) out.add(flow);
  return out;
}

// The fan behind the card in front (flashcards.md "The cards behind"), nearest first: each card's turn about its
// centre (degrees, + clockwise) and its nudge off the card (canvas px). Alternating sides, turning further the deeper
// it sits, so corners show all round the card. Set by depth, never at random, so it looks the same every time.
export const FLASHCARD_FAN: readonly { turn: number; dx: number; dy: number }[] = [
  { turn: -2, dx: -8, dy: 5 },
  { turn: 2.5, dx: 9, dy: 7 },
  { turn: -3.5, dx: -12, dy: 3 },
  { turn: 4, dx: 13, dy: 10 },
  { turn: -4.5, dx: -5, dy: 12 },
  { turn: 5, dx: 6, dy: 2 },
];

export type StackSheet = { rect: PageRect; turn: number; opacity: number };

/** The sheets drawn behind the card in front, nearest first: each the card's size, turned and nudged by its place
 *  in FLASHCARD_FAN, fainter the further back, at most FLASHCARD_STACK_MAX. */
export function stackSheets(rect: PageRect, behind: number): StackSheet[] {
  const n = Math.max(0, Math.min(FLASHCARD_STACK_MAX, FLASHCARD_FAN.length, behind));
  return Array.from({ length: n }, (_, i) => {
    const fan = FLASHCARD_FAN[i]!;
    return {
      rect: { x: rect.x + fan.dx, y: rect.y + fan.dy, width: rect.width, height: rect.height },
      turn: fan.turn,
      opacity: Math.max(STACK_FAINTEST, STACK_NEAR_OPACITY - STACK_FADE_STEP * i),
    };
  });
}

/** Whether a tab's pages stand as a stack (pages-mode.md "Stacked or side by side"): the tab's own arrangement, else
 *  its kind's (flashcards stack; infographic pages and slides stand in a row; an article never stacks). */
export function stacksPages(
  pages: readonly Pick<LaidOutPage, 'kind'>[],
  arrangement?: unknown,
): boolean {
  return tabStacksPages(pages, arrangement);
}

/** The pages the world shows: the page in front alone on a stack (not while a page slide presents, which shows its
 *  own page already), else every page. The clip the elements are cut to (PageClip) follows it, so a page behind
 *  shows none of its elements. */
export function shownPagesOf(
  view: Pick<PagesModeView, 'pages' | 'cardStage' | 'letterbox'>,
): LaidOutPage[] {
  return view.cardStage && !view.letterbox ? view.cardStage.pages : view.pages;
}

/** The card in front: the one asked for while it is a card of the row, else the first card. Null
 *  off a stack. When the card asked for has gone (an undo of the split that made it, a peer's
 *  delete), the card before its place (`at`, where it last stood) comes to the front, as a delete
 *  lands on the page before; an undone split no longer threw the stack back to its first card. */
export function cardInFrontOf(
  pages: readonly Pick<LaidOutPage, 'id' | 'kind'>[],
  wanted: string | null,
  at = 0,
  // The tab's own arrangement (Tab.pageArrangement), absent for its kind's.
  arrangement?: unknown,
): string | null {
  if (!stacksPages(pages, arrangement)) return null;
  if (wanted && pages.some((p) => p.id === wanted)) return wanted;
  if (!wanted) return pages[0]!.id;
  return pages[Math.min(Math.max(0, at - 1), pages.length - 1)]!.id;
}
