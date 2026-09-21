'use client';

// The Tab Look & Feel dialog (spec/42), opened from the paintbrush dock
// button. One modal, three tabs: Theme (the category-browse picker), Canvas
// (pattern + colours + opacity) and Font (the tab's default font + the size
// seeded onto new elements, spec/28). Opens on whichever tab the caller
// picked; the user can switch freely. Every control applies live to the
// active tab via its callback — there's no Apply/Cancel, closing just
// dismisses.
//
// The tabs render shared components (CanvasStyleControls,
// ThemeCategoryBrowser) so they're identical to the palette accordion and the
// New-diagram picker respectively. Follows the standard modal contract
// (Portal + backdrop + Escape) used by SettingsDialog.

import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { useRef } from 'react';
import type { BackgroundPattern } from '@livediagram/diagram';
import { useEscape } from '@/hooks/ui/useEscape';
import { useFocusTrap } from '@/hooks/ui/useFocusTrap';
import { CanvasStyleControls } from '@/components/canvas/CanvasStyleControls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { CustomThemePicker } from '@/components/palette/CustomThemePicker';
import { DotsIcon, ResetIcon, ScaleIcon } from '@/components/palette/palette-icons';
import { FontSelect } from '@/components/palette/FontSelect';
import { SizeButton } from '@/components/palette/palette-controls';
import type { TextSize } from '@livediagram/diagram';
import { Portal } from '@/components/primitives/Portal';
import { useModalGuard } from '@/hooks/ui/useModalGuard';

export type CanvasThemeTab = 'canvas' | 'theme' | 'font';

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
  // id (spec/44), so it's widened to string; onSetTheme applies either.
  themeId: string;
  onSetTheme: (id: string) => void;
  onResetElementsToTheme: () => void;
  // Font (spec/28). `font` null = the editor default; `defaultTextSize`
  // undefined defaults to medium.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // Push the tab font + default size onto every existing element on the
  // tab (clears per-element font overrides so they inherit).
  onApplyFontToAll: () => void;
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
  onClose,
}: CanvasThemeDialogProps) {
  // Mount-open modal: silence the canvas shortcut/paste listeners
  // behind it (see lib/modal-guard).
  useModalGuard(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
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
        // dialog as they click (spec/42). The full-screen layer stays as a
        // transparent click-catcher (click-outside / right-click guard) so an
        // accidental edit doesn't leak to the canvas while it's open.
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center"
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
          className="flex max-h-[calc(100%-2rem)] w-[44rem] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header + the full-width tab bar live in one band so the modal
              reads as a single unit rather than two stacked divider rows. */}
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              {/* "Appearance" is the VIEWER's own light / dark chrome now
                  (spec/07), so this dialog — which is the tab's look, shared
                  with everyone — takes the name of the section that opens it. */}
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Tab Look &amp; Feel
              </h2>
              {/* Help sits with the close button, where the other editor
                  dialogs keep their window controls, not beside the title. */}
              <div className="flex items-center gap-1">
                {/* The chrome variant, as the panel headers use beside their
                    own window controls: a plain glyph, no ring. */}
                <HelpArticleLink
                  variant="chrome"
                  article={
                    tab === 'canvas'
                      ? 'changingTheBackground'
                      : tab === 'font'
                        ? 'choosingFonts'
                        : 'changingTheme'
                  }
                  title={
                    tab === 'canvas' ? 'Canvas background' : tab === 'font' ? 'Fonts' : 'Themes'
                  }
                  description={
                    tab === 'canvas'
                      ? 'How to change the canvas background and pattern.'
                      : tab === 'font'
                        ? "How a tab's default font and text size work."
                        : 'How to switch and customise a tab theme.'
                  }
                />
                <DialogCloseButton compact onClick={onClose} />
              </div>
            </div>
            {/* The theme leads the strip: it's the broader, more-used
                control (the paintbrush dock button also opens here); Canvas is
                the finer backdrop tuning. */}
            <div className="flex w-full gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <TabButton
                active={tab === 'theme'}
                onClick={() => onTabChange('theme')}
                icon={<ThemeTabIcon />}
              >
                Theme
              </TabButton>
              <TabButton
                active={tab === 'canvas'}
                onClick={() => onTabChange('canvas')}
                icon={<BackgroundTabIcon />}
              >
                Canvas
              </TabButton>
              <TabButton
                active={tab === 'font'}
                onClick={() => onTabChange('font')}
                icon={<FontTabIcon />}
              >
                Font
              </TabButton>
            </div>
          </div>

          {/* Fixed min-height so switching between tabs doesn't collapse the
              modal and make it jump around. */}
          <div className="min-h-[20rem] overflow-y-auto px-5 py-4">
            {tab === 'font' ? (
              <FontTab
                font={font}
                onSetFont={onSetFont}
                defaultTextSize={defaultTextSize}
                onSetDefaultTextSize={onSetDefaultTextSize}
                onApplyFontToAll={onApplyFontToAll}
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
// (spec/28). Every change applies live; "Apply to all elements" pushes
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

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ' +
        (active
          ? 'bg-white font-semibold text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100')
      }
    >
      <span className={active ? 'text-brand-500 dark:text-brand-300' : ''}>{icon}</span>
      {children}
    </button>
  );
}

// Compact 14px glyphs for the tab bar.
function BackgroundTabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <circle cx="6" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FontTabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 13L7.5 3l4.5 10M4.6 9.5h5.8" />
    </svg>
  );
}
function ThemeTabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path d="M8 2.5a5.5 5.5 0 1 0 0 11c.9 0 1.3-.7 1.3-1.3 0-.7-.6-1-.6-1.6 0-.5.4-.9 1-.9h1.1A2.7 2.7 0 0 0 13.5 7 5.5 5.5 0 0 0 8 2.5z" />
      <circle cx="5.5" cy="7" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5.2" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
