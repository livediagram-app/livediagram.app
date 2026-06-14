'use client';

// The right-click "Change Canvas" / "Change Theme" dialog (spec/42). One
// modal, two tabs: Canvas (pattern + colours + opacity) and Theme (the
// category-browse picker). Opens on whichever tab the menu item picked;
// the user can switch freely. Every control applies live to the active
// tab via its callback — there's no Apply/Cancel, closing just dismisses.
//
// Both tabs render shared components (CanvasStyleControls,
// ThemeCategoryBrowser) so they're identical to the palette accordion and
// the New-diagram picker respectively. Follows the standard modal
// contract (Portal + backdrop + Escape) used by SettingsDialog.

import type { BackgroundPattern } from '@livediagram/diagram';
import type { ThemeId } from '@/lib/themes';
import { useEscape } from '@/hooks/useEscape';
import { CanvasStyleControls } from './CanvasStyleControls';
import { CloseIcon } from './CloseIcon';
import { Portal } from './Portal';
import { ResetIcon } from './palette-icons';
import { ThemeCategoryBrowser } from './ThemeCategoryBrowser';

export type CanvasThemeTab = 'canvas' | 'theme';

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
            ) : (
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
