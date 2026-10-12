'use client';

// The Tab Look & Feel dialog (docs/specs/011-theme/canvas-and-theme-dialog.md), opened from the paintbrush dock
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

import { lucideChevronLeft } from '@livediagram/icons/lucide';
import { useRef, useState } from 'react';
import { resolveFinish, type BackgroundPattern, type Finish } from '@livediagram/document';
import { lucideGlyph, useEscape, useFocusTrap, Portal, DialogCloseButton } from '@livediagram/ui';
import { CanvasStyleControls } from '@/components/canvas/CanvasStyleControls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { CustomThemePicker } from '@/components/palette/CustomThemePicker';
import { DotsIcon, ResetIcon, ScaleIcon } from '@/components/palette/palette-icons';
import { FontSelect } from '@/components/palette/FontSelect';
import { SizeButton } from '@/components/palette/palette-controls';
import type { TextSize } from '@livediagram/document';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import { FinishTab } from './FinishTab';
import { LooksHome } from './LooksHome';
import { activeLookId } from '@/lib/tab-looks';

// 'looks' is the home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"); the others are its Fine-tune panels.
export type CanvasThemeTab = 'looks' | 'canvas' | 'theme' | 'font' | 'finish';

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
  onResetElementsToTheme: () => void;
  // Font (docs/specs/004-interface-design/fonts.md). `font` null = the editor default; `defaultTextSize`
  // undefined defaults to medium.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // Push the tab font + default size onto every existing element on the
  // tab (clears per-element font overrides so they inherit).
  onApplyFontToAll: () => void;
  // Finish (docs/specs/008-canvas/finish.md). `finish` undefined is Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  onApplyFinishToAll: () => void;
  // The tab's own background, unresolved, for the Finish preview's paper.
  canvasBackground?: string;
  // Looks: set the tab's theme, finish, font and pattern at once (lib/tab-looks.ts).
  onApplyLook: (id: string) => void;
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
  onResetElementsToTheme,
  font,
  onSetFont,
  defaultTextSize,
  onSetDefaultTextSize,
  onApplyFontToAll,
  finish,
  onSetFinish,
  onApplyFinishToAll,
  canvasBackground,
  onApplyLook,
  onClose,
}: CanvasThemeDialogProps) {
  // Mount-open modal: silence the canvas shortcut/paste listeners
  // behind it (see lib/modal-guard).
  useModalGuard(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  // A popover flying out of the paintbrush (docs/specs/011-theme/canvas-and-theme-dialog.md): on a screen wider than a
  // phone, the panel's bottom-right corner sits just above the brush and it grows from there. Without the brush (a
  // whiteboard, an embed) or on a phone, it is the centred (phone: full-screen) dialog it always was.
  const anchor = useBrushAnchor();
  useEscape(onClose);

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
        className={`fixed inset-0 z-[var(--z-modal)] flex ${anchor ? '' : 'items-center justify-center'}`}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Tab look and feel"
          // Edge to edge on a phone, matching the shared Dialog's rule for its
          // larger sizes. This one predates that component and carries its own
          // portal + backdrop, so it repeats the classes rather than inheriting
          // them — the theme grid is exactly the kind of content that wants the
          // whole screen.
          className={`flex max-h-[calc(100%-2rem)] w-[44rem] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 dark:border-slate-700 dark:bg-slate-900 ${anchor ? 'fixed animate-fly-up-in shadow-2xl motion-reduce:animate-fade-in' : ''}`}
          style={
            anchor
              ? {
                  right: anchor.right,
                  bottom: anchor.bottom,
                  maxHeight: `calc(100% - ${anchor.bottom + 16}px)`,
                  transformOrigin: 'bottom right',
                }
              : undefined
          }
        >
          {/* The header: the title with help and close on the right; inside a panel, a Back row to the home
              (docs/specs/011-theme/canvas-and-theme-dialog.md "Fine-tune"). */}
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              {/* "Appearance" is the VIEWER's own light / dark chrome now
                  (docs/specs/007-editor/live-app.md), so this dialog — which is the tab's look, shared
                  with everyone — takes the name of the section that opens it. */}
              <div className="flex min-w-0 flex-col">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Tab Look &amp; Feel
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
            {tab !== 'looks' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onTabChange('looks')}
                  className="-ml-1.5 inline-flex h-9 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <BackIcon />
                  Back
                </button>
                <span aria-hidden className="text-slate-300 dark:text-slate-600">
                  /
                </span>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {PANEL_TITLES[tab]}
                </h3>
              </div>
            ) : null}
          </div>

          {/* Fixed min-height so switching between tabs doesn't collapse the
              modal and make it jump around. */}
          <div className="min-h-[20rem] overflow-y-auto px-5 py-4">
            {tab === 'looks' ? (
              <LooksHome
                activeLook={activeLookId({
                  theme: themeId,
                  finish,
                  font: font ?? undefined,
                  backgroundPattern,
                })}
                onPickLook={onApplyLook}
                themeId={themeId}
                finish={resolveFinish(finish, undefined)}
                font={font}
                defaultTextSize={defaultTextSize}
                pattern={backgroundPattern}
                onOpenPanel={onTabChange}
              />
            ) : tab === 'font' ? (
              <FontTab
                font={font}
                onSetFont={onSetFont}
                defaultTextSize={defaultTextSize}
                onSetDefaultTextSize={onSetDefaultTextSize}
                onApplyFontToAll={onApplyFontToAll}
              />
            ) : tab === 'finish' ? (
              <FinishTab
                finish={finish}
                onSetFinish={onSetFinish}
                onApplyFinishToAll={onApplyFinishToAll}
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
                onSetBackgroundPattern={onSetBackgroundPattern}
                onSetBackgroundColor={onSetBackgroundColor}
                onSetPatternColor={onSetPatternColor}
                onSetBackgroundOpacity={onSetBackgroundOpacity}
                onSetBackgroundPatternScale={onSetBackgroundPatternScale}
                onSetBackgroundAnimationSpeed={onSetBackgroundAnimationSpeed}
                patternColumns={7}
                showAllPatterns
              />
            ) : (
              <CustomThemePicker
                themeId={themeId}
                onSelect={onSetTheme}
                onCommit={(id) => {
                  onSetTheme(id);
                  onClose();
                }}
                info={
                  <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    Sets the canvas backdrop and recolours every element on this tab to match the
                    theme (sticky notes keep their amber palette).
                  </p>
                }
                footer={
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={onResetElementsToTheme}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
                    >
                      <ResetIcon />
                      Reset elements to theme
                    </button>
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// The tab's default font and the size seeded onto new elements
// (docs/specs/004-interface-design/fonts.md). Every change applies live; "Apply to all elements" pushes
// the pair onto everything already on the tab.
function FontTab({
  font,
  onSetFont,
  defaultTextSize,
  onSetDefaultTextSize,
  onApplyFontToAll,
}: {
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  onApplyFontToAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Tab font
        </span>
        <FontSelect value={font} ariaLabel="Tab font" onChange={onSetFont} />
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          The default for every text element on this tab that hasn't set its own.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Default size for new elements
        </span>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ['scale', 'Scale', <ScaleIcon key="s" />],
              ['sm', 'Small', <DotsIcon key="1" count={1} />],
              ['md', 'Medium', <DotsIcon key="2" count={2} />],
              ['lg', 'Large', <DotsIcon key="3" count={3} />],
            ] as const
          ).map(([size, label, glyph]) => (
            <SizeButton
              key={size}
              active={(defaultTextSize ?? 'md') === size}
              onClick={() => onSetDefaultTextSize(size)}
            >
              <span className="flex flex-col items-center gap-1 py-0.5">
                {glyph}
                <span className="text-[10px] font-medium">{label}</span>
              </span>
            </SizeButton>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          Seeded onto each element you add next; existing elements keep their size.
        </p>
      </div>
      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onApplyFontToAll}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
        >
          Apply to all elements
        </button>
      </div>
    </div>
  );
}

// The Back row's chevron.
const BackIcon = lucideGlyph(lucideChevronLeft, 14);

// The paintbrush's place: how far the panel's right edge and bottom sit from the window's, so its corner is just above
// the brush, right edges aligned. Null without a brush on screen, or on a phone (below 640 px), where it stays a dialog.
const BRUSH_GAP_PX = 8;
function useBrushAnchor(): { right: number; bottom: number } | null {
  // Read once as it opens (the dialog is client-only, loaded with ssr off): the brush does not move while it is open.
  const [anchor] = useState<{ right: number; bottom: number } | null>(() => {
    if (typeof window === 'undefined' || window.innerWidth < 640) return null;
    const brush = document.querySelector<HTMLElement>('[data-tour-id="canvas-theme"]');
    const box = brush?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return {
      right: Math.max(8, Math.round(window.innerWidth - box.right)),
      bottom: Math.round(window.innerHeight - box.top + BRUSH_GAP_PX),
    };
  });
  return anchor;
}
