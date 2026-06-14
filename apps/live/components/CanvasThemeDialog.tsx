'use client';

// The right-click "Change Canvas" / "Change Theme" dialog (spec/42). One
// modal, three tabs: Canvas (pattern + colours + opacity), Theme (the
// category-browse picker) and Font (the tab's default font + new-element
// size). Opens on whichever tab the menu item picked; the user can switch
// freely. Every control applies live to the active tab via its callback —
// there's no Apply/Cancel, closing just dismisses.
//
// The tabs render shared components (CanvasStyleControls,
// ThemeCategoryBrowser, FontSelect) so they're identical to the palette
// accordion and the New-diagram picker respectively. Follows the standard
// modal contract (Portal + backdrop + Escape) used by SettingsDialog.

import type { BackgroundPattern, TextSize } from '@livediagram/diagram';
import type { ThemeId } from '@/lib/themes';
import { useEscape } from '@/hooks/useEscape';
import { CanvasStyleControls } from './CanvasStyleControls';
import { CloseIcon } from './CloseIcon';
import { FontSelect } from './FontSelect';
import { SizeButton } from './palette-controls';
import { DotsIcon, ResetIcon, ScaleIcon } from './palette-icons';
import { Portal } from './Portal';
import { ThemeCategoryBrowser } from './ThemeCategoryBrowser';

export type CanvasThemeTab = 'canvas' | 'theme' | 'font';

type CanvasThemeDialogProps = {
  tab: CanvasThemeTab;
  onTabChange: (tab: CanvasThemeTab) => void;
  // Canvas style (current values + live setters).
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  // Theme.
  themeId: ThemeId;
  onSetTheme: (id: ThemeId) => void;
  onResetElementsToTheme: () => void;
  // Font (spec/28): the tab's default font + the size seeded onto new
  // palette elements. `null` font = the editor default.
  font: string | null;
  onSetTabFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetTabDefaultTextSize: (size: TextSize) => void;
  onClose: () => void;
};

export function CanvasThemeDialog({
  tab,
  onTabChange,
  backgroundPattern,
  backgroundColor,
  patternColor,
  backgroundOpacity,
  onSetBackgroundPattern,
  onSetBackgroundColor,
  onSetPatternColor,
  onSetBackgroundOpacity,
  themeId,
  onSetTheme,
  onResetElementsToTheme,
  font,
  onSetTabFont,
  defaultTextSize,
  onSetTabDefaultTextSize,
  onClose,
}: CanvasThemeDialogProps) {
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tab appearance"
          className="flex max-h-[calc(100%-2rem)] w-[44rem] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header + the full-width tab bar live in one band so the modal
              reads as a single unit rather than two stacked divider rows. */}
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Tab Appearance
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <CloseIcon size={16} strokeWidth={1.6} />
              </button>
            </div>
            <div className="flex w-full gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <TabButton
                active={tab === 'canvas'}
                onClick={() => onTabChange('canvas')}
                icon={<BackgroundTabIcon />}
              >
                Background
              </TabButton>
              <TabButton
                active={tab === 'theme'}
                onClick={() => onTabChange('theme')}
                icon={<ThemeTabIcon />}
              >
                Theme
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

          {/* Fixed min-height so switching to the short Font tab doesn't
              collapse the modal and make it jump around. */}
          <div className="min-h-[20rem] overflow-y-auto px-5 py-4">
            {tab === 'canvas' ? (
              <CanvasStyleControls
                backgroundPattern={backgroundPattern}
                backgroundColor={backgroundColor}
                patternColor={patternColor}
                backgroundOpacity={backgroundOpacity}
                onSetBackgroundPattern={onSetBackgroundPattern}
                onSetBackgroundColor={onSetBackgroundColor}
                onSetPatternColor={onSetPatternColor}
                onSetBackgroundOpacity={onSetBackgroundOpacity}
                patternColumns={7}
                showAllPatterns
              />
            ) : tab === 'theme' ? (
              <>
                <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Sets the canvas backdrop and recolours every element on this tab to match the
                  theme (sticky notes keep their amber palette).
                </p>
                <ThemeCategoryBrowser
                  themeId={themeId}
                  onSelect={onSetTheme}
                  onCommit={(id) => {
                    onSetTheme(id);
                    onClose();
                  }}
                  className="mt-3"
                />
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
              </>
            ) : (
              // Font: the tab's default font + the size seeded onto new
              // palette elements (spec/28). Centred in a comfortable column so
              // it fills the modal intentionally rather than hugging the left.
              <div className="mx-auto flex max-w-md flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Font</p>
                  <FontSelect value={font} ariaLabel="Tab font" onChange={onSetTabFont} />
                  <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                    The default for every element on this tab; individual elements can override it.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Default size for new elements
                  </p>
                  {/* Same Scale / S / M / L control as the element editor, with
                      visible labels since there's room here. */}
                  <div className="grid grid-cols-4 gap-1.5">
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
                        onClick={() => onSetTabDefaultTextSize(size)}
                      >
                        <span className="flex flex-col items-center gap-1 py-0.5">
                          {glyph}
                          <span className="text-[10px] font-medium">{label}</span>
                        </span>
                      </SizeButton>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
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
function FontTabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <text
        x="8"
        y="12"
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
        fontFamily="Georgia, serif"
      >
        A
      </text>
    </svg>
  );
}
