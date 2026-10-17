'use client';

// What every visualisation shares (docs/specs/026-plan/plan-views.md "Visualisations"): the card it sits
// on in the board's theme colours, a header of its name and count, its loading and empty states, and the
// press rules for an entry that opens a card.
import { useSlotSettings } from '@/components/plan/dashboard/slot-menu';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLAN_VIEW_TITLE_MAX, STATUS_PHASES, STATUS_PHASE_LABELS } from '@livediagram/items';
import type { PlanPalette } from '../plan-palette';
import type { PlanContextValue } from '../PlanContext';
import { CountBadge, Tooltip } from '@livediagram/ui';
import { IN_BOX_TITLE_CLASS, InMenuBox } from '../menu-name-slot';
import { BAND_CONTROLS_CLASS, bandControlsProps } from '../band-controls';

// The phase colours and the overdue red (phase-colours.ts), shared with the views' still pictures.
import { OVERDUE_RED, PHASE_COLOURS } from '@livediagram/plan-art';
export { OVERDUE_RED, PHASE_COLOURS };

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// An entry that opens a card: in Plan mode a press opens it (and keeps the press from the canvas); in any
// mode a double-click does (docs/specs/026-plan/plan-views.md "On the canvas").
export function openProps(plan: PlanContextValue | undefined, itemId: string) {
  const interactive = !!plan?.planInput;
  return {
    onPointerDown: interactive ? stop : undefined,
    onClick: (e: React.MouseEvent) => {
      if (!interactive) return;
      e.stopPropagation();
      plan?.openItem(itemId);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      plan?.openItem(itemId);
    },
  };
}

// What a view shows: loading while the cards are on their way, else empty or the chart.
export function viewState(
  plan: PlanContextValue | undefined,
  hasData: boolean,
): 'loading' | 'empty' | 'ready' {
  if (plan?.status === 'loading') return 'loading';
  return hasData ? 'ready' : 'empty';
}

// What ends every view's header after its own controls (the Maximise View button), set once by PlanViewView so
// each view needs no wiring.
export const ViewHeaderEnd = createContext<ReactNode>(null);

// A view's own title and its rename (PlanViewView): the title in place of the view's name, and, where the view fills
// a Visualisation tab, a double-click on it renaming the view and the tab together (docs/specs/026-plan/plan-tabs.md
// "Names").
export const ViewTitle = createContext<{ title?: string; rename?: (title: string) => void } | null>(
  null,
);

// The view's name with its own title in its place: "Due Calendar · Oct 2026" becomes "Launch · Oct 2026".
function titledView(name: string, own: string | undefined): string {
  if (!own) return name;
  const at = name.indexOf(' · ');
  return at < 0 ? own : `${own}${name.slice(at)}`;
}

// The view's own name without what it shows at the moment ("Due Calendar · October 2026" is "Due Calendar"): what a
// rename starts from, so saving it never bakes the month in.
function bareViewName(name: string): string {
  const at = name.indexOf(' · ');
  return at < 0 ? name : name.slice(0, at);
}

export function ViewFrame({
  title,
  count,
  countLabel,
  palette,
  fontFamily,
  state,
  empty,
  aside,
  children,
}: {
  title: string;
  count?: number;
  // The count spoken whole ("3 projects").
  countLabel?: string;
  palette: PlanPalette;
  fontFamily?: string;
  // 'loading' before the cards arrive, 'empty' when there is nothing to chart.
  state: 'loading' | 'empty' | 'ready';
  empty: string;
  // Controls at the header's end (the calendar's month steps).
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const end = useContext(ViewHeaderEnd);
  const own = useContext(ViewTitle);
  const shown = titledView(title, own?.title);
  const [renaming, setRenaming] = useState(false);
  // In a Dashboard slot with no controls of the view's own (PlanViewView puts the cog in `end`), the slot's cog.
  const slot = useSlotSettings();
  const slotCog = end ? null : (slot?.cog ?? null);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border"
      style={{
        borderColor: palette.border,
        backgroundColor: palette.surface,
        color: palette.text,
        ...(fontFamily ? { fontFamily } : null),
      }}
    >
      <div
        // In a header band (maximised, MaximisedPlanLayer's --plan-band-*), as tall as the top row, after the menu,
        // its title and count stopping short of the palette strip.
        className="flex h-[var(--plan-band-h,2.5rem)] shrink-0 items-center gap-2 border-b pl-[var(--plan-band-left,0.75rem)] pr-3"
        style={{ borderColor: palette.border }}
      >
        <span className="flex min-w-0 max-w-[var(--plan-band-mid,none)] items-center gap-2">
          {/* In a header band the title rides in the menu box (menu-name-slot). */}
          <InMenuBox
            render={(inBox) =>
              renaming && own?.rename ? (
                <TitleField
                  value={own.title ?? bareViewName(title)}
                  inBox={inBox}
                  onDone={(next) => {
                    setRenaming(false);
                    if (next) own.rename?.(next);
                  }}
                />
              ) : (
                <span
                  className={`${inBox ? IN_BOX_TITLE_CLASS : 'min-w-0 truncate text-[13px] font-semibold'} ${own?.rename ? 'cursor-text' : ''}`}
                  // In the menu box a click renames; in its own header a double-click (a click there moves the element).
                  {...(own?.rename
                    ? inBox
                      ? { onClick: () => setRenaming(true) }
                      : { onDoubleClick: () => setRenaming(true) }
                    : {})}
                >
                  {shown}
                </span>
              )
            }
          />
          {count !== undefined && state === 'ready' ? (
            <CountBadge
              size="md"
              background={palette.column}
              color={palette.text}
              label={countLabel}
            >
              {count}
            </CountBadge>
          ) : null}
        </span>
        {aside || end || slotCog ? (
          // In a header band, a card like the menu box (band-controls.ts).
          // A view's own controls give way first in a narrow slot (a phone): they scroll sideways, while Maximise and
          // the cog always stay in reach.
          <span
            {...bandControlsProps(palette)}
            className={`ml-auto flex min-w-0 items-center gap-1 ${BAND_CONTROLS_CLASS}`}
          >
            {aside ? (
              <span className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                {aside}
              </span>
            ) : null}
            <span className="flex shrink-0 items-center gap-1">
              {end}
              {slotCog}
            </span>
          </span>
        ) : null}
      </div>
      {state === 'ready' ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      ) : (
        <div
          className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 text-center text-[12px]"
          style={{ color: palette.muted }}
        >
          {state === 'loading' ? 'Loading cards…' : empty}
        </div>
      )}
    </div>
  );
}

// The three phases as a key.
export function PhaseLegend({ palette }: { palette: PlanPalette }) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
      style={{ color: palette.muted }}
    >
      {STATUS_PHASES.map((phase) => (
        <span key={phase} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: PHASE_COLOURS[phase] }}
          />
          {STATUS_PHASE_LABELS[phase]}
        </span>
      ))}
    </div>
  );
}

// A small header control (the calendar's month steps, the Gantt's scale and window): a quiet text or icon button
// that keeps its press from the canvas, named by a tooltip. `active` presses it (the Gantt's scale).
export function ViewStepButton({
  label,
  onPress,
  palette,
  active = false,
  children,
}: {
  label: string;
  onPress: () => void;
  palette: PlanPalette;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active || undefined}
        className="flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-md px-1.5 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
        style={
          active
            ? { color: palette.text, backgroundColor: palette.column }
            : { color: palette.muted }
        }
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// The view's title being renamed: Enter or leaving saves the trimmed name, Escape puts it back.
function TitleField({
  value,
  inBox,
  onDone,
}: {
  value: string;
  inBox: boolean;
  onDone: (next: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const closed = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    const next = draft.trim();
    onDone(save && next && next !== value ? next : null);
  };
  return (
    <input
      ref={input}
      aria-label="Chart name"
      value={draft}
      maxLength={PLAN_VIEW_TITLE_MAX}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      className={`${inBox ? IN_BOX_TITLE_CLASS : 'min-w-0 text-[13px] font-semibold'} w-48 rounded-md border border-brand-400 bg-transparent px-1.5 py-0.5 outline-none`}
    />
  );
}
