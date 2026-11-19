// The Tab Style dialog's profile (liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): what a product
// hands the one shared dialog to say what its dialog shows. Its parts are the product's own pieces, the same on every
// surface; its surface settings are a base and optional changes per surface (the kind of tab or page the editor says
// it is styling). Types and the pure resolve only: the components read a resolved surface.
import type { ComponentType, ReactNode } from 'react';
import type { Finish } from '@liveworkspace/element-model/finish';
import type { TextSize } from '@liveworkspace/model-core/basics';
import type { FONTS } from '@liveworkspace/model-core/fonts';
import type { createTabStyleTour } from '../../tour/TabStyleTour';
import type { TabStyleTourApi } from '../../tour/tab-style-tour-steps';
import type { TabLookFields, TabLookSettings } from '../../../lib/tab-looks';
import type { Season } from '../../../lib/seasonal-looks';

/** A Fine-tune panel. */
export type TabStylePanel = 'theme' | 'finish' | 'font' | 'canvas';
/** What the dialog shows: the home (`looks`) or one of its panels. */
export type TabStyleView = 'looks' | TabStylePanel;
/** A control a panel can leave out. */
export type TabStyleControl = 'defaultTextSize' | 'animationSpeed' | 'patternScale' | 'patternColor';
/** The help article each view links to (every product's help catalogue holds these four). */
export type TabStyleHelpArticle =
  | 'changingTheme'
  | 'choosingAFinish'
  | 'choosingFonts'
  | 'changingTheBackground';

/** The kind of tab or page the dialog styles, as the editor says it (the spec's "Surfaces" table). */
export type TabStyleSurfaceName =
  | 'canvas'
  | 'whiteboard'
  | 'board'
  | 'sheet'
  | 'form'
  | 'dashboard'
  | 'article'
  | 'slide'
  | 'infographic'
  | 'flashcard'
  | 'space';

/** A look as the dialog shows it: its four settings, its card's name and line, and a seasonal look's season. */
export type TabStyleLook = TabLookFields & { label: string; description: string; season?: Season };

/** A typeface the Text panel offers (the shared catalogue's shape). */
export type TabStyleFont = (typeof FONTS)[number];

/** The header line for each view and each panel's name. */
export type TabStyleCopy = {
  viewLines: Record<TabStyleView, string>;
  panelTitles: Record<TabStylePanel, string>;
};

/** What a product's Canvas panel is handed: the tab's canvas settings, their setters, and the controls to leave out. */
export type TabStyleCanvasPanelProps<Pattern extends string> = {
  backgroundPattern: Pattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  backgroundPatternScale: number;
  backgroundAnimationSpeed: number;
  onSetBackgroundPattern: (pattern: Pattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  onSetBackgroundAnimationSpeed: (speed: number) => void;
  hidden: ReadonlySet<TabStyleControl>;
};

/** Which panel a preview is drawn for. */
export type TabStylePreviewKind = 'finish' | 'text';

/** What a product's preview draws from: the tab's look, and the names the panel shows for a screen reader's label. */
export type TabStylePreviewProps = {
  finish: Finish;
  // The tab's own background, undefined for the canvas's default on this surface.
  canvasBackground: string | undefined;
  themeId: string;
  font: string | null;
  // The size new text takes (the Text panel); omitted, labels keep their size.
  textSize?: TextSize;
  finishLabel: string;
  fontLabel: string;
};

/** The product's Text Size control, as the Text panel drives it. */
export type TabStyleTextSizeProps = {
  current: TextSize;
  onSet: (size: TextSize) => void;
  onPreview: (size: TextSize) => void;
  onPreviewEnd: () => void;
};

/** The product's Colours panel (its bound ThemeBrowser). */
export type TabStyleThemeBrowserProps = {
  themeId: string;
  onSelect: (id: string) => void;
  onCommit: (id: string) => void;
  className?: string;
};

/** A product's look catalogue and its renderers. */
export type TabStyleLooks<Look extends TabStyleLook> = {
  // The year-round looks, in carousel order.
  all: readonly Look[];
  // The seasonal looks for a date, the season on now (or next) first.
  seasonalFor: (now: Date) => readonly Look[];
  // Whether the tab's settings are the look's, and the look they match.
  matches: (settings: TabLookSettings, look: Look) => boolean;
  activeId: (settings: TabLookSettings) => string | undefined;
  // A card's preview: the exporter's markup and the paper under it.
  preview: (look: Look) => { markup: string; paper: string | undefined };
  // The Mashup card's random look, within a finish and never the one before.
  rollMashup: (options?: { finish?: Finish; previous?: Look }) => Look;
};

/** The parts the frame draws around the views. */
export type TabStyleFrameParts = {
  view: TabStyleView;
  // The header's line for the view that is up.
  subtitle: string;
  // The help link for the view that is up.
  help: ReactNode;
  // Show Me's targets: the home, the Finish panel and the tab's finish.
  tourApi: TabStyleTourApi;
  onClose: () => void;
  children: ReactNode;
};

/** The shared modal, or a frame of the product's own. */
export type TabStyleFrame =
  | {
      kind: 'modal';
      // The editor's Show Me, bound once (components/tour/TabStyleTour.tsx).
      tour: ReturnType<typeof createTabStyleTour>;
      // What the popover hangs below first, when it is on screen (livedocuments' page Style).
      opener?: () => Element | null;
    }
  | { kind: 'custom'; render: (parts: TabStyleFrameParts) => ReactNode };

/** What a surface shows. */
export type TabStyleSurface<Look extends TabStyleLook, Pattern extends string> = {
  // The Fine-tune panels, in order.
  panels: readonly TabStylePanel[];
  hiddenControls: readonly TabStyleControl[];
  // Which looks show; every one when unset.
  lookFilter?: (look: Look) => boolean;
  renderCanvasPanel: (props: TabStyleCanvasPanelProps<Pattern>) => ReactNode;
  renderPreview: (kind: TabStylePreviewKind, props: TabStylePreviewProps) => ReactNode;
  copy: TabStyleCopy;
};

/** A surface's changes to the base: any setting, and only the copy lines it words differently. */
export type TabStyleSurfaceChanges<Look extends TabStyleLook, Pattern extends string> = Partial<
  Omit<TabStyleSurface<Look, Pattern>, 'copy'>
> & {
  copy?: {
    viewLines?: Partial<TabStyleCopy['viewLines']>;
    panelTitles?: Partial<TabStyleCopy['panelTitles']>;
  };
};

export type TabStyleProfile<Look extends TabStyleLook, Pattern extends string> = {
  looks: TabStyleLooks<Look>;
  themeSummary: (themeId: string) => { label: string; swatch: ReactNode };
  ThemeBrowser: ComponentType<TabStyleThemeBrowserProps>;
  finishLabels: Record<Finish, string>;
  FinishSwatch: ComponentType<{ finish: Finish; size?: number }>;
  patternLabel: (pattern: Pattern) => string;
  // The typefaces the Text panel offers; every face in the catalogue when unset.
  fonts?: readonly TabStyleFont[];
  TextSizeControl: ComponentType<TabStyleTextSizeProps>;
  // The viewer's appearance, so the look cards redraw in their half when it changes.
  useAppearance: () => unknown;
  renderHelp: (article: TabStyleHelpArticle) => ReactNode;
  frame: TabStyleFrame;
  // Whether Apply to All Tabs names locked tabs (on unless the product has no tab locks).
  tabLocks?: boolean;
  base: TabStyleSurface<Look, Pattern>;
  surfaces?: Partial<Record<TabStyleSurfaceName, TabStyleSurfaceChanges<Look, Pattern>>>;
};

/** Every Fine-tune panel, in the home's order. */
export const TAB_STYLE_PANELS: readonly TabStylePanel[] = ['theme', 'finish', 'font', 'canvas'];

/** The shared copy: a product changes only the lines it words differently. */
export const TAB_STYLE_COPY: TabStyleCopy = {
  viewLines: {
    looks: 'Pick a look for the whole tab, then fine-tune any part of it.',
    theme: 'The colours every element on the tab draws in.',
    finish: 'How every element on the tab is drawn.',
    font: 'The tab’s font, and the size new text starts at.',
    canvas: 'The pattern and colours behind everything.',
  },
  panelTitles: { theme: 'Colours', finish: 'Finish', font: 'Text', canvas: 'Canvas' },
};

/** The help article each view links to. */
export const TAB_STYLE_HELP: Record<TabStyleView, TabStyleHelpArticle> = {
  looks: 'changingTheme',
  theme: 'changingTheme',
  finish: 'choosingAFinish',
  font: 'choosingFonts',
  canvas: 'changingTheBackground',
};

/** The copy with a profile's changes over the shared lines. */
export function tabStyleCopy(changes: TabStyleSurfaceChanges<TabStyleLook, string>['copy'] = {}) {
  return {
    viewLines: { ...TAB_STYLE_COPY.viewLines, ...changes.viewLines },
    panelTitles: { ...TAB_STYLE_COPY.panelTitles, ...changes.panelTitles },
  };
}

/** What a surface shows: the profile's base with that surface's changes over it (the base alone for a surface the
 *  profile does not name, or none). */
export function resolveTabStyleSurface<Look extends TabStyleLook, Pattern extends string>(
  profile: Pick<TabStyleProfile<Look, Pattern>, 'base' | 'surfaces'>,
  surface: string | undefined,
): TabStyleSurface<Look, Pattern> {
  const changes = surface
    ? profile.surfaces?.[surface as TabStyleSurfaceName]
    : undefined;
  if (!changes) return profile.base;
  const { copy, ...rest } = changes;
  const base = profile.base;
  return {
    ...base,
    ...rest,
    copy: {
      viewLines: { ...base.copy.viewLines, ...copy?.viewLines },
      panelTitles: { ...base.copy.panelTitles, ...copy?.panelTitles },
    },
  };
}

/** The view to show: a panel the surface leaves out opens on the home. */
export function shownTabStyleView(
  view: TabStyleView,
  panels: readonly TabStylePanel[],
): TabStyleView {
  return view === 'looks' || panels.includes(view) ? view : 'looks';
}
