import { useShowMoreList } from '@/hooks/useShowMoreList';
import { Accordion, PATTERNS, ColorSwatch, PatternButton, SizeButton } from './palette-controls';
import type {} from '@livediagram/diagram';
import { THEMES } from '@/lib/themes';
import { AutoAlignIcon, DotsIcon, ResetIcon, ScaleIcon } from './palette-icons';
import { ShowMoreButton } from './ShowMoreButton';
import { Tooltip } from './Tooltip';
import { FontSelect } from './FontSelect';

import type { TabSectionControls } from './CommandPalette';

export type TabAccordionState = {
  text: boolean;
  theme: boolean;
  canvas: boolean;
  cleanup: boolean;
};

export function TabSection({
  tab,
  open,
  setOpen,
}: {
  tab: TabSectionControls;
  open: TabAccordionState;
  setOpen: React.Dispatch<React.SetStateAction<TabAccordionState>>;
}) {
  // Mutually exclusive (matches SelectedElementSection).
  const toggle = (key: keyof TabAccordionState) =>
    setOpen((prev) => {
      const closed: TabAccordionState = {
        text: false,
        theme: false,
        canvas: false,
        cleanup: false,
      };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });

  // Same opt-in shape as the welcome / template picker. Auto-expands
  // when the current tab is already on an extra so the active swatch
  // is always visible.
  const themesList = useShowMoreList(THEMES, (t) => t.id === tab.themeId);
  const patternsList = useShowMoreList(PATTERNS, (p) => p.id === tab.backgroundPattern);

  return (
    <div className="flex flex-col">
      <Accordion title="Theme" open={open.theme} onToggle={() => toggle('theme')}>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
          Sets the canvas backdrop and recolours every element on this tab to match the theme
          (sticky notes keep their amber palette).
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {themesList.visible.map((t) => {
            const active = tab.themeId === t.id;
            // Border / dot colours come from the theme's element-stroke (or
            // pattern colour when the theme is the brand default).
            const dot = t.elementStroke ?? t.patternColor;
            const swatch = t.elementFill ?? '#ffffff';
            return (
              <Tooltip
                key={t.id}
                title={t.label}
                description="Applies the theme's background and new-element colours."
                block
              >
                <button
                  type="button"
                  onClick={() => tab.onSetTheme(t.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? 'flex w-full flex-col items-center gap-1 rounded-md border border-brand-400 bg-brand-50 p-1.5 text-[10px] font-medium text-brand-800'
                      : 'flex w-full flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15'
                  }
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: t.backgroundColor }}
                    className="flex h-7 w-full items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700"
                  >
                    <span
                      style={{ backgroundColor: swatch, borderColor: dot }}
                      className="h-3 w-3 rounded-sm border"
                    />
                  </span>
                  <span>{t.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
        {themesList.hasMore && !themesList.showAll ? (
          <ShowMoreButton label="Show more themes" onClick={themesList.reveal} />
        ) : null}
        <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
        <Tooltip
          title="Reset elements to theme"
          description="Recolour every shape, text and arrow on this tab to the active theme's defaults — including elements you've hand-coloured."
        >
          <button
            type="button"
            onClick={tab.onResetElementsToTheme}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
          >
            <ResetIcon />
            Reset elements to theme
          </button>
        </Tooltip>
      </Accordion>
      <Accordion title="Canvas" open={open.canvas} onToggle={() => toggle('canvas')}>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Pattern</p>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {patternsList.visible.map((p) => (
            <Tooltip key={p.id} title={p.label} description={p.description}>
              <PatternButton
                active={tab.backgroundPattern === p.id}
                onClick={() => tab.onSetBackgroundPattern(p.id)}
                label={p.shortLabel}
              >
                <p.icon />
              </PatternButton>
            </Tooltip>
          ))}
        </div>
        {patternsList.hasMore && !patternsList.showAll ? (
          <ShowMoreButton label="Show more patterns" onClick={patternsList.reveal} />
        ) : null}
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Colours
        </p>
        <div className="mt-1 flex items-stretch gap-1">
          <Tooltip title="Canvas colour" description="The colour of the canvas background.">
            <ColorSwatch
              label="Canvas"
              value={tab.backgroundColor}
              onChange={tab.onSetBackgroundColor}
            />
          </Tooltip>
          <Tooltip title="Pattern colour" description="The colour of the grid dots or ruled lines.">
            <ColorSwatch
              label="Pattern"
              value={tab.patternColor}
              onChange={tab.onSetPatternColor}
            />
          </Tooltip>
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Opacity</p>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
              {Math.round(tab.backgroundOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={tab.backgroundOpacity}
            onChange={(e) => tab.onSetBackgroundOpacity(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
          />
        </div>
      </Accordion>
      {/* Tab text defaults (spec/28): the font every element without its
          own font inherits, and the size seeded onto new palette elements.
          Sits under Canvas — it's tab appearance, not a primary control. */}
      <Accordion title="Text" open={open.text} onToggle={() => toggle('text')}>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Font</p>
          <FontSelect value={tab.font} ariaLabel="Tab font" onChange={tab.onSetTabFont} />
          <p className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
            The default for every element on this tab; individual elements can override it.
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
            Default size for new elements
          </p>
          {/* Same controls as the element editor's Text > Size row so the
              two read identically. */}
          <div className="grid grid-cols-4 gap-1">
            <Tooltip title="Scale" description="Auto-fit each new element's label to its size.">
              <SizeButton
                active={(tab.defaultTextSize ?? 'md') === 'scale'}
                onClick={() => tab.onSetTabDefaultTextSize('scale')}
              >
                <ScaleIcon />
              </SizeButton>
            </Tooltip>
            <Tooltip title="Small" description="New elements start at the small font size.">
              <SizeButton
                active={(tab.defaultTextSize ?? 'md') === 'sm'}
                onClick={() => tab.onSetTabDefaultTextSize('sm')}
              >
                <DotsIcon count={1} />
              </SizeButton>
            </Tooltip>
            <Tooltip title="Medium" description="New elements start at the medium font size.">
              <SizeButton
                active={(tab.defaultTextSize ?? 'md') === 'md'}
                onClick={() => tab.onSetTabDefaultTextSize('md')}
              >
                <DotsIcon count={2} />
              </SizeButton>
            </Tooltip>
            <Tooltip title="Large" description="New elements start at the large font size.">
              <SizeButton
                active={(tab.defaultTextSize ?? 'md') === 'lg'}
                onClick={() => tab.onSetTabDefaultTextSize('lg')}
              >
                <DotsIcon count={3} />
              </SizeButton>
            </Tooltip>
          </div>
        </div>
      </Accordion>
      {tab.importError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
          {tab.importError}
        </p>
      ) : null}
      {tab.onAutoAlign ? (
        <Accordion title="Assistant" open={open.cleanup} onToggle={() => toggle('cleanup')}>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Snap every element on this tab to the canvas grid so near-aligned shapes line up exactly
            and minor dimension drift collapses. Undoable.
          </p>
          <div className="mt-1 flex items-stretch gap-1.5">
            <Tooltip
              title="Auto align"
              description="Snap positions and sizes to the canvas grid."
              block
            >
              <button
                type="button"
                onClick={tab.onAutoAlign}
                disabled={!tab.canAutoAlign}
                className={
                  tab.canAutoAlign
                    ? 'inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200'
                    : 'inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500'
                }
              >
                <AutoAlignIcon />
                Auto align
              </button>
            </Tooltip>
          </div>
        </Accordion>
      ) : null}
    </div>
  );
}
