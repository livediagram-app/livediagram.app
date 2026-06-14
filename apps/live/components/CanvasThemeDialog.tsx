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
import { Tooltip } from './Tooltip';

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
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
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
          </header>

          <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <TabButton active={tab === 'canvas'} onClick={() => onTabChange('canvas')}>
                Canvas
              </TabButton>
              <TabButton active={tab === 'theme'} onClick={() => onTabChange('theme')}>
                Theme
              </TabButton>
              <TabButton active={tab === 'font'} onClick={() => onTabChange('font')}>
                Font
              </TabButton>
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-4">
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
              // palette elements (spec/28), moved here from the tab editor.
              <div className="flex max-w-sm flex-col gap-1">
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Font</p>
                <FontSelect value={font} ariaLabel="Tab font" onChange={onSetTabFont} />
                <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                  The default for every element on this tab; individual elements can override it.
                </p>
                <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Default size for new elements
                  </p>
                  {/* Same controls as the element editor's Text > Size row so
                      the two read identically. */}
                  <div className="grid grid-cols-4 gap-1">
                    <Tooltip
                      title="Scale"
                      description="Auto-fit each new element's label to its size."
                    >
                      <SizeButton
                        active={(defaultTextSize ?? 'md') === 'scale'}
                        onClick={() => onSetTabDefaultTextSize('scale')}
                      >
                        <ScaleIcon />
                      </SizeButton>
                    </Tooltip>
                    <Tooltip title="Small" description="New elements start at the small font size.">
                      <SizeButton
                        active={(defaultTextSize ?? 'md') === 'sm'}
                        onClick={() => onSetTabDefaultTextSize('sm')}
                      >
                        <DotsIcon count={1} />
                      </SizeButton>
                    </Tooltip>
                    <Tooltip
                      title="Medium"
                      description="New elements start at the medium font size."
                    >
                      <SizeButton
                        active={(defaultTextSize ?? 'md') === 'md'}
                        onClick={() => onSetTabDefaultTextSize('md')}
                      >
                        <DotsIcon count={2} />
                      </SizeButton>
                    </Tooltip>
                    <Tooltip title="Large" description="New elements start at the large font size.">
                      <SizeButton
                        active={(defaultTextSize ?? 'md') === 'lg'}
                        onClick={() => onSetTabDefaultTextSize('lg')}
                      >
                        <DotsIcon count={3} />
                      </SizeButton>
                    </Tooltip>
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
          : 'rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }
    >
      {children}
    </button>
  );
}
