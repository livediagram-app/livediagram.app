# Tab Style dialog: blueprint

Derived from [tab-style.md](../tab-style.md). The spec decides; this file only adds engineering precision. Defaults
are cited as `TSn` ([DEFAULTS.md](DEFAULTS.md)). Paths are relative to the repository root.

Scope, by file (all under `packages/workbench/src/components/dialogs/tab-style/`):

| File                    | Role                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `tab-style-profile.ts`  | The profile's types, the shared copy and help map, `resolveTabStyleSurface`, `shownTabStyleView`         |
| `TabStyleDialog.tsx`    | The controller: resolves the surface, holds the slide direction, eases the setters, picks the frame     |
| `TabStyleModal.tsx`     | The shared frame: Portal, click-catcher, hero header, popover or sheet, Show Me, Escape                 |
| `useTabStyleAnchor.ts`  | `tabStyleAnchor` and its hook: the popover's place, read once                                           |
| `LooksHome.tsx`         | The home: the carousel and one `FineTuneRow` per panel the surface shows                                |
| `LooksCarousel.tsx`     | The looks in pages of six, the Mashup card, the Seasonal toggle and the Finish filter                   |
| `FinishPanel.tsx`       | The four finish tiles over the product's preview                                                        |
| `TextPanel.tsx`         | The preview, the typeface carousel and the Size of New Text control                                     |
| `tab-style-fonts.ts`    | The typeface cards ("Editor default" first) and a tab font's name from the whole catalogue              |

Each editor's door is `components/dialogs/CanvasThemeDialog.tsx` (`apps/live/…` in livedesign), rendering
`<TabStyleDialog profile={TAB_STYLE_PROFILE} {...props} />`; its profile is `components/dialogs/tab-style-profile.tsx`.

## Domain and naming

| Term          | Identifier                                   | Meaning                                                                 |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| View          | `TabStyleView`: `looks` and the four panels  | What the dialog shows; `looks` is the home                              |
| Panel         | `TabStylePanel`: `theme` `finish` `font` `canvas` | A Fine-tune panel (named Colours, Finish, Text, Canvas by default) |
| Surface       | `TabStyleSurfaceName`, `surface` prop        | The kind of tab or page the editor says the dialog styles               |
| Control       | `TabStyleControl`                            | `defaultTextSize`, `animationSpeed`, `patternScale`, `patternColor`     |
| Profile       | `TabStyleProfile<Look, Pattern>`             | A product's parts and surface settings                                  |
| Surface settings | `TabStyleSurface<Look, Pattern>`          | What one surface shows; `base` and `surfaces[name]` changes             |
| Frame         | `TabStyleFrame`                              | `{ kind: 'modal', tour, opener? }` or `{ kind: 'custom', render }`      |

## Interfaces and contracts

```ts
type TabStyleProfile<Look extends TabStyleLook, Pattern extends string> = {
  looks: {
    all: readonly Look[];
    seasonalFor: (now: Date) => readonly Look[];
    matches: (settings: TabLookSettings, look: Look) => boolean;
    activeId: (settings: TabLookSettings) => string | undefined;
    preview: (look: Look) => { markup: string; paper: string | undefined };
    rollMashup: (options?: { finish?: Finish; previous?: Look }) => Look;
  };
  themeSummary: (themeId: string) => { label: string; swatch: ReactNode };
  ThemeBrowser: ComponentType<{ themeId; onSelect; onCommit; className? }>;
  finishLabels: Record<Finish, string>;
  FinishSwatch: ComponentType<{ finish: Finish; size?: number }>;
  patternLabel: (pattern: Pattern) => string;
  fonts?: readonly TabStyleFont[];                 // default: every face in FONTS
  TextSizeControl: ComponentType<{ current; onSet; onPreview; onPreviewEnd }>;
  useAppearance: () => unknown;                    // a hook, called once per carousel render
  renderHelp: (article: TabStyleHelpArticle) => ReactNode;
  frame: TabStyleFrame;
  tabLocks?: boolean;                              // default true (ApplyToAllTabsRow)
  base: TabStyleSurface<Look, Pattern>;
  surfaces?: Partial<Record<TabStyleSurfaceName, TabStyleSurfaceChanges<Look, Pattern>>>;
};

type TabStyleSurface<Look, Pattern> = {
  panels: readonly TabStylePanel[];
  hiddenControls: readonly TabStyleControl[];
  lookFilter?: (look: Look) => boolean;
  renderCanvasPanel: (props: TabStyleCanvasPanelProps<Pattern>) => ReactNode; // values, setters, hidden set
  renderPreview: (kind: 'finish' | 'text', props: TabStylePreviewProps) => ReactNode;
  copy: { viewLines: Record<TabStyleView, string>; panelTitles: Record<TabStylePanel, string> };
};
```

- `TabStyleSurfaceChanges` is `Partial` of the surface with `copy` itself partial: `resolveTabStyleSurface` spreads
  the changes over the base and merges `viewLines` and `panelTitles` key by key. An unknown or absent surface returns
  the base object itself.
- `tabStyleCopy(changes)` builds a base's copy from `TAB_STYLE_COPY` the same way.
- `TAB_STYLE_HELP` maps each view to its article: `looks` and `theme` `changingTheme`, `finish` `choosingAFinish`,
  `font` `choosingFonts`, `canvas` `changingTheBackground`.
- `TabStyleDialogProps<Look, Pattern>` is the door's props (the view, the tab's settings and setters, `allTabs`,
  `onClose`) plus `surface?: string`. `backgroundAnimationSpeed` and its setter are optional (livehuddle has none):
  the Canvas panel gets `1` and a no-op.
- `TabStylePreviewProps` carries the tab's resolved finish (the Finish panel's tile on show), unresolved
  background, theme id, font, the size new text takes (the Text panel only) and the finish and font names, so the
  product builds its own `aria-label`.

## Behaviour and state

- The view shown is `shownTabStyleView(tab, surface.panels)`: a panel the surface leaves out shows the home.
- `enter` is `'fade'` on open, `'forward'` into a panel and `'back'` home (`AnimatedHeightBox`).
- Every pick goes through `easedStyleChange`: the look, theme select, font, text size, finish and pattern; the canvas
  colours, opacity, scale and speed apply unwrapped (slider drags).
- The Fine-tune rows follow `surface.panels`; with `defaultTextSize` hidden, the Text row's value is the font name
  alone and the Text panel renders no Size of New Text section.
- The looks pool is the year-round looks (or, Seasonal on, the seasonal ones) through `lookFilter`, then the Finish
  filter. The Mashup card leads the year-round pool unfiltered.
- A card's preview is drawn on its first render and cached per open and appearance.
- The modal frame calls `useModalGuard(true)` and binds Escape to close only while Show Me is not running.
- `data-tab-style-view` names the view up, on a `display: contents` wrapper, in every editor.

## Performance and limits

- A look preview is a full export (about 220 ms of CPU for every look at once, measured in livehuddle's carousel
  test before it was made lazy); only the cards on the mounted pages (the page on show and its neighbours) are drawn,
  each once per open (`LooksCarousel` `previewOf`). livehuddle's `LooksCarousel.test.tsx` holds the open to a CPU
  budget.
- The surface resolve is a spread of at most six keys per render; the dialog is loaded only when opened (each door
  sits behind `next/dynamic`).

## Presentation and UX

The markup and classes are the five copies' as they were: the 44 rem panel, `min-h-[20rem]` body, two-column
Fine-tune grid from `sm`, six looks and six typefaces per page. The popover is `animate-fly-up-in` from the brush and
`animate-dialog-in` hanging from an opener, `motion-reduce:animate-fade-in` either way.

## Constants and configuration

| Constant         | Value | Where                  | Why                                           |
| ---------------- | ----- | ---------------------- | --------------------------------------------- |
| `ANCHOR_GAP_PX`  | 8     | `useTabStyleAnchor.ts` | The spec's gap to the brush or opener         |
| `PHONE_MAX_PX`   | 640   | `useTabStyleAnchor.ts` | Tailwind's `sm`, where the sheet gives way    |
| `EDGE_MIN_PX`    | 8     | `useTabStyleAnchor.ts` | The popover never meets the window's edge     |
| `LOOKS_PER_PAGE` | 6     | `lib/tab-looks.ts`     | Two rows of three                             |
| `FONTS_PER_PAGE` | 6     | `TextPanel.tsx`        | Two rows of three                             |

## Observability

The carousel's `UI / Changed / LooksSeasonal` and `UI / Changed / LooksFinishFilter` go through `workbench.track`;
Show Me's Started and Ended through the editor's bound tour. The dialog adds no events.

## Testing

- `tab-style-profile.test.ts`: the resolve (base, an unknown surface, a surface's changes with partial copy), the
  copy helper and the shown view.
- `TabStyleDialog.test.tsx`, over a fake profile: the home's rows follow the panels; a hidden panel's view opens
  home; hidden controls reach the Canvas panel and drop the Text panel's size; the look filter; the preview's kind
  and labels; the modal frame's anchors (brush, cluster, opener, phone, none) and the custom frame; the Seasonal
  toggle and Finish filter tracking; the Mashup roll; Apply to All Tabs; the theme commit closing the dialog.
- Every file in the folder is held at 100% (`packages/workbench/vitest.config.ts`).
- Each editor's `CanvasThemeDialog.test.tsx` and `LooksCarousel.test.tsx` drive the shared dialog over the real
  profile and catalogue.

## Defaults ledger

- TS1: a surface the profile does not name takes the base.
- TS2: the Mashup card is not filtered by a surface's look filter.
