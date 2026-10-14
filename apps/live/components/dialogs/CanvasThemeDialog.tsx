'use client';

// The Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md), opened from the paintbrush dock
// button. One modal, four tabs: Theme (the category-browse picker), Canvas
// (pattern + colours + opacity), Font (the tab's default font + the size
// seeded onto new elements, docs/specs/004-interface-design/fonts.md) and Finish (how elements are drawn,
// docs/specs/008-canvas/finish.md). Opens on whichever tab the caller
// picked; the user can switch freely. Every control applies live to the
// active tab via its callback — there's no Apply/Cancel, closing just
// dismisses.
//
// The tabs render shared components (CanvasStyleControls,
// ThemeCategoryBrowser) so they're identical to the palette accordion and the
// New-document picker respectively. Follows the standard modal contract
// (Portal + backdrop + Escape) used by SettingsDialog.

import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { useRef, useState } from 'react';
import { resolveFinish, type BackgroundPattern, type Finish } from '@livediagram/document';
import {
  useEscape,
  useFocusTrap,
  Portal,
  DialogCloseButton,
  SheetHandle,
  safeInset,
  useSheetDrag,
} from '@livediagram/ui';
import { CanvasStyleControls } from '@/components/canvas/CanvasStyleControls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { BackBar } from '@/components/primitives/BackBar';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import {
  TabStyleShowMeButton,
  TabStyleTourStage,
  useTabStyleTour,
} from '@/components/tour/TabStyleTour';
import { CustomThemePicker } from '@/components/palette/CustomThemePicker';
import type { TextSize } from '@livediagram/document';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import { FinishTab } from './FinishTab';
import { TextTab } from './TextTab';
import { easeNextStyleChange } from '@/lib/tab-style-ease';
import { LooksHome } from './LooksHome';
import { activeLookId, type LookSettings, type TabLook } from '@/lib/tab-looks';

// 'looks' is the home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"); the others are its Fine-tune panels.
export type CanvasThemeTab = 'looks' | 'canvas' | 'theme' | 'font' | 'finish';

// A setter whose change the canvas eases into rather than snaps to.
const eased =
  <A,>(fn: (a: A) => void) =>
  (a: A) => {
    easeNextStyleChange();
    fn(a);
  };

const PANEL_TITLES: Record<Exclude<CanvasThemeTab, 'looks'>, string> = {
  theme: 'Colours',
  finish: 'Finish',
  font: 'Text',
  canvas: 'Canvas',
};

type CanvasThemeDialogProps = {
  tab: CanvasThemeTab;
  onTabChange: (tab: CanvasThemeTab) => void;
  // Canvas style (current values + live setters).
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  backgroundPatternScale: number;
  backgroundAnimationSpeed: number;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  onSetBackgroundAnimationSpeed: (speed: number) => void;
  // Theme. `themeId` is a built-in ThemeId or a custom `custom:<uuid>`
  // id (docs/specs/011-theme/custom-themes.md), so it's widened to string; onSetTheme applies either.
  themeId: string;
  onSetTheme: (id: string) => void;
  // Font (docs/specs/004-interface-design/fonts.md). `font` null = the editor default; `defaultTextSize`
  // undefined defaults to medium.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // Finish (docs/specs/008-canvas/finish.md). `finish` undefined is Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  // The tab's own background, unresolved, for the Finish preview's paper.
  canvasBackground?: string;
  // Looks: set the tab's theme, finish, font and pattern at once (lib/tab-looks.ts).
  // A named look's id, or the Mashup card's random look whole.
  onApplyLook: (look: string | TabLook) => void;
  onClose: () => void;
};

export function CanvasThemeDialog({
  tab,
  onTabChange,
  backgroundPattern,
  backgroundColor,
  patternColor,
  backgroundOpacity,
  backgroundPatternScale,
  backgroundAnimationSpeed,
  onSetBackgroundPattern,
  onSetBackgroundColor,
  onSetPatternColor,
  onSetBackgroundOpacity,
  onSetBackgroundPatternScale,
  onSetBackgroundAnimationSpeed,
  themeId,
  onSetTheme,
  font,
  onSetFont,
  defaultTextSize,
  onSetDefaultTextSize,
  finish,
  onSetFinish,
  canvasBackground,
  onApplyLook: applyLook,
  onClose,
}: CanvasThemeDialogProps) {
  // Mount-open modal: silence the canvas shortcut/paste listeners
  // behind it (see lib/modal-guard).
  useModalGuard(true);
  // Every pick eases the canvas into its new colours (lib/tab-style-ease.ts).
  const onApplyLook = eased(applyLook);
  // The tab's four look settings: which look (or mashup) it wears.
  const lookSettings: LookSettings = {
    theme: themeId,
    finish,
    font: font ?? undefined,
    backgroundPattern,
    backgroundOpacity,
  };
  // How the next view arrives: the first one only fades (the dialog has its own entrance), then a move into a panel
  // slides forward and a move home slides back.
  const [enter, setEnter] = useState<'fade' | 'forward' | 'back'>('fade');
  const go = (next: CanvasThemeTab) => {
    setEnter(next === 'looks' ? 'back' : 'forward');
    onTabChange(next);
  };
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  // A popover flying out of the paintbrush (docs/specs/011-theme/canvas-and-theme-dialog.md): on a screen wider than a
  // phone, the panel's bottom-right corner sits just above the brush and it grows from there. Without the brush (a
  // whiteboard, an embed) or on a phone, it is the centred (phone: full-screen) dialog it always was.
  const anchor = useBrushAnchor();
  const panelScale = useUiScale('panels');
  // On a phone it is a bottom sheet, its grab handle dragging it taller or down to close (BottomSheet's).
  const sheet = useSheetDrag(onClose);
  // Show Me: the tour of the home, run on this dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me").
  const tour = useTabStyleTour({ showHome: () => (tab === 'looks' ? undefined : go('looks')) });
  // While Show Me runs, Escape is the tour's, never the dialog's.
  useEscape(onClose, { enabled: !tour.active });

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        // No dimming / blur backdrop: every control applies live to the tab, so
        // the user needs to SEE the canvas background + theme change behind the
        // dialog as they click (docs/specs/011-theme/canvas-and-theme-dialog.md). The full-screen layer stays as a
        // transparent click-catcher (click-outside / right-click guard) so an
        // accidental edit doesn't leak to the canvas while it's open.
        className={`fixed inset-0 z-[var(--z-modal)] flex ${anchor ? '' : 'items-center justify-center max-sm:items-end'}`}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Tab style"
          // A bottom sheet on a phone, rising from the bottom edge as the editor's other phone sheets do, the canvas
          // still in view above it so each pick shows on the tab.
          className={`flex max-h-[calc(100%-2rem)] w-[44rem] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none max-sm:max-h-[75dvh] max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-up max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900 ${anchor ? 'fixed animate-fly-up-in shadow-2xl motion-reduce:animate-fade-in' : ''}`}
          // Drawn at the Panels UI scale like every other panel (docs/specs/007-editor/ui-scale.md); under its
          // `zoom` the anchored offsets are in the panel's own px, so they are converted (toSurfacePx).
          style={
            anchor
              ? {
                  ...uiScaleStyle(panelScale),
                  right: toSurfacePx(anchor.right, panelScale),
                  bottom: toSurfacePx(anchor.bottom, panelScale),
                  maxHeight: `calc(100% - ${toSurfacePx(anchor.bottom + 16, panelScale)}px)`,
                  transformOrigin: 'bottom right',
                }
              : { ...uiScaleStyle(panelScale), ...sheet.style, paddingBottom: safeInset('bottom') }
          }
        >
          <SheetHandle handleProps={sheet.handleProps} className="sm:hidden" />
          {/* The header: the title with help and close on the right; inside a panel, a Back row to the home
              (docs/specs/011-theme/canvas-and-theme-dialog.md "Fine-tune"). */}
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 pb-2.5 pt-3 max-sm:pt-0 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              {/* "Appearance" is the VIEWER's own light / dark chrome now
                  (docs/specs/007-editor/live-app.md), so this dialog — which is the tab's look, shared
                  with everyone — takes the name of the section that opens it. */}
              <div className="flex min-w-0 flex-col">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Tab Style
                </h2>
                {tab === 'looks' ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pick a look for the whole tab, then fine-tune any part of it.
                  </p>
                ) : null}
              </div>
              {/* Help sits with the close button, where the other editor
                  dialogs keep their window controls, not beside the title. */}
              <div className="flex items-center gap-1">
                <TabStyleShowMeButton tour={tour} />
                <HelpArticleLink
                  size="md"
                  article={
                    tab === 'canvas'
                      ? 'changingTheBackground'
                      : tab === 'font'
                        ? 'choosingFonts'
                        : tab === 'finish'
                          ? 'choosingAFinish'
                          : 'changingTheme'
                  }
                />
                <DialogCloseButton compact onClick={onClose} />
              </div>
            </div>
          </div>

          {/* Fixed min-height so switching between tabs doesn't collapse the
              modal and make it jump around. */}
          <div className="min-h-[20rem] overflow-y-auto px-5 pb-4 pt-2">
            {/* The home and its panels swap through an easing height and a short slide: into a panel from the
                right, back home from the left (AnimatedHeightBox). */}
            <AnimatedHeightBox viewKey={tab} enter={enter}>
              {/* Inside a panel: the shared breadcrumb back to the home, the panel named in its chip, as the
                import / export panels do (docs/specs/011-theme/canvas-and-theme-dialog.md "Fine-tune"). */}
              {tab !== 'looks' ? (
                <BackBar
                  label="Tab Style"
                  current={PANEL_TITLES[tab]}
                  onClick={() => go('looks')}
                />
              ) : null}
              {tab === 'looks' ? (
                <LooksHome
                  settings={lookSettings}
                  activeLook={activeLookId(lookSettings)}
                  onPickLook={onApplyLook}
                  themeId={themeId}
                  finish={resolveFinish(finish, undefined)}
                  font={font}
                  defaultTextSize={defaultTextSize}
                  pattern={backgroundPattern}
                  onOpenPanel={go}
                />
              ) : tab === 'font' ? (
                <TextTab
                  font={font}
                  onSetFont={eased(onSetFont)}
                  defaultTextSize={defaultTextSize}
                  onSetDefaultTextSize={eased(onSetDefaultTextSize)}
                  finish={resolveFinish(finish, undefined)}
                  canvasBackground={canvasBackground}
                  themeId={themeId}
                />
              ) : tab === 'finish' ? (
                <FinishTab
                  finish={finish}
                  onSetFinish={eased(onSetFinish)}
                  canvasBackground={canvasBackground}
                  themeId={themeId}
                  font={font}
                />
              ) : tab === 'canvas' ? (
                <CanvasStyleControls
                  backgroundPattern={backgroundPattern}
                  backgroundColor={backgroundColor}
                  patternColor={patternColor}
                  backgroundOpacity={backgroundOpacity}
                  backgroundPatternScale={backgroundPatternScale}
                  backgroundAnimationSpeed={backgroundAnimationSpeed}
                  onSetBackgroundPattern={eased(onSetBackgroundPattern)}
                  onSetBackgroundColor={onSetBackgroundColor}
                  onSetPatternColor={onSetPatternColor}
                  onSetBackgroundOpacity={onSetBackgroundOpacity}
                  onSetBackgroundPatternScale={onSetBackgroundPatternScale}
                  onSetBackgroundAnimationSpeed={onSetBackgroundAnimationSpeed}
                  showAllPatterns
                  previewTiles
                />
              ) : (
                <CustomThemePicker
                  themeId={themeId}
                  onSelect={eased(onSetTheme)}
                  onCommit={(id) => {
                    onSetTheme(id);
                    onClose();
                  }}
                />
              )}
            </AnimatedHeightBox>
          </div>
        </div>
      </div>
      <TabStyleTourStage tour={tour} />
    </Portal>
  );
}

// The paintbrush's place: how far the panel's right edge and bottom sit from the window's, so it sits just above the
// brush with its right edge on the bottom-right cluster's (the screen's right-hand side), keeping as much of the work
// as it can in view. Null without a brush on screen, or on a phone (below 640 px), where it stays a dialog.
const BRUSH_GAP_PX = 8;
function useBrushAnchor(): { right: number; bottom: number } | null {
  // Read once as it opens (the dialog is client-only, loaded with ssr off): the brush does not move while it is open.
  const [anchor] = useState<{ right: number; bottom: number } | null>(() => {
    if (typeof window === 'undefined' || window.innerWidth < 640) return null;
    const brush = document.querySelector<HTMLElement>('[data-tour-id="canvas-theme"]');
    const box = brush?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    // The cluster's right edge (the zoom controls end it), else the brush's own.
    const cluster = document
      .querySelector<HTMLElement>('[data-zoom-cluster]')
      ?.getBoundingClientRect();
    const edge = cluster && cluster.width > 0 ? Math.max(cluster.right, box.right) : box.right;
    return {
      right: Math.max(8, Math.round(window.innerWidth - edge)),
      bottom: Math.round(window.innerHeight - box.top + BRUSH_GAP_PX),
    };
  });
  return anchor;
}
