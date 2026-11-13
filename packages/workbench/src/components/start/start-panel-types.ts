// The shapes the shared start panel (StartPanel.tsx) takes: what it reads off an editor's palette, cards and
// categories, the editor's config for createStartPanel, and the props of the panel it returns.
import type { ComponentType, ReactNode } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { lucideGlyph } from '@liveworkspace/ui';

type Glyph = ReturnType<typeof lucideGlyph>;

// The colours the panel reads off the editor's palette.
export type StartPanelPaletteBase = {
  surface: string;
  border: string;
  column: string;
  card: string;
  text: string;
  muted: string;
  focus: string;
};

// What the panel reads off a card (the editor's own card type carries more, for its grid).
export type StartPanelCardBase = { id: string; name: string };

export type StartPanelCategory<C extends string> = {
  id: C;
  name: string;
  line: string;
  icon: Glyph;
  // Drawn below the rail's hairline, with the ways in that bring a whole way of working.
  below?: boolean;
};

// A result group, headed by its category's rail name, or `name` for a group the rail doesn't show.
export type StartPanelResult<C extends string, K> = {
  category: C;
  name?: string;
  cards: readonly K[];
};

// An entry at the rail's foot, below Connect File, that opens a dialog (a planner's Import).
export type StartPanelFootAction = {
  id: string;
  name: string;
  icon: ReactNode;
  onPick: () => void;
};

export type StartPanelConfig<
  P extends StartPanelPaletteBase,
  K extends StartPanelCardBase,
  H,
  G,
  M,
> = {
  // Whose Explorer hero backdrop the header wears (start-diagramming.md "The header band").
  app: App;
  // The editor's help link, drawn as its icon in the header's corner.
  HelpLink: ComponentType<{ article: H; variant: 'icon' }>;
  // The editor's card grid, and its accent at a strength.
  CardGrid: ComponentType<{
    cards: readonly K[];
    palette: P;
    cascade: boolean;
    onChoose: (cardId: string) => void;
  }>;
  tint: (palette: P, strength: number) => string;
  // The chosen rail row's label, where the editor darkens the accent to read at AA on its tint; else the accent.
  chosenInk?: (palette: P) => string;
  // The other modes' matches under the panel's own (Found in other modes), where the editor has modes.
  OtherModes?: ComponentType<{
    groups: readonly G[];
    palette: P;
    divided: boolean;
    cascade: boolean;
    onChoose: (mode: M, cardId: string) => void;
  }>;
  // False where the panel is never a sheet to drag: no grab handle, no × and the header's corner holds the help link
  // alone.
  sheet: boolean;
  // Hide the footer strip while what it holds draws nothing.
  hideEmptyFooter?: boolean;
};

export type StartPanelProps<C extends string, P, K, H, G, M> = {
  titleId: string;
  title: string;
  line: string;
  // The search box's label and placeholder.
  searchLabel: string;
  // What a search that finds nothing found no match among ("boards, sheets or layouts").
  noMatchNoun: string;
  helpArticle: H;
  palette: P;
  // Only the categories holding cards.
  categories: readonly StartPanelCategory<C>[];
  initialCategory: C;
  cardsIn: (category: C) => readonly K[];
  // What the rail's count says for a category, where it is not every card it holds (the Community's tiles join a
  // category's cards but not its count, so their arrival changes nothing on the rail).
  countIn?: ((category: C) => number) | undefined;
  // Every match, grouped by category, in rail order.
  search: (query: string) => readonly StartPanelResult<C, K>[];
  onChoose: (cardId: string) => void;
  // A quiet strip under the choices, in the panel's colours: the Sync to Server switch
  // (save-locations.md "On the start screen").
  footer?: ((palette: P) => ReactNode) | undefined;
  // Found in other modes: the other modes' matches for a search, and choosing one, which switches the tab to that
  // mode. Absent where the tab's mode may not change: the search keeps to its own mode.
  elsewhere?: ((query: string) => readonly G[]) | undefined;
  onChooseElsewhere?: ((mode: M, cardId: string) => void) | undefined;
  // Absent where the panel cannot be closed: no × in its header.
  onClose?: (() => void) | undefined;
  // Leading the rail, over a hairline: the mode switch.
  lead?: ReactNode;
  // Connect File (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the rail's last entry,
  // at its very bottom, and what the content area shows once it is chosen. Absent where connecting cannot work.
  connect?: ((palette: P) => ReactNode) | undefined;
  // Entries below Connect File in the same foot group, each opening a dialog; alone under the hairline where Connect
  // File is not offered.
  footActions?: readonly StartPanelFootAction[];
  // Entries above Connect File in the same foot group (liveplanner's Describe a Plan), each opening a dialog.
  footLead?: readonly StartPanelFootAction[];
};
