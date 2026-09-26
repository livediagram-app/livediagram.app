import { pct } from './chart-utils';
import { bestSlot, formatRate, rate, type FunnelSurface } from './cta-funnel';
import { categoryColor } from './event-vocab';

// One public surface's landing funnel (docs/specs/019-marketing/landing-funnel.md): its three counts as a
// shrinking bar, the step rate between each, then every CTA slot on it with
// its arrivals, diagrams and conversion, so the buttons on one page can be
// compared directly.

// Rows in a card besides its slots (title, three steps, the table head), for
// CardColumns to balance by.
const FIXED_ROWS = 8;

export const funnelCardWeight = (surface: FunnelSurface) => FIXED_ROWS + surface.slots.length;

export function FunnelSurfaceCard({
  surface,
}: {
  surface: FunnelSurface;
  // Read by CardColumns to balance the columns; see funnelCardWeight.
  weight: number;
}) {
  const viewColor = categoryColor('Page');
  const ctaColor = categoryColor('Cta');
  const widest = Math.max(surface.views, surface.arrived, surface.created, 1);
  const best = bestSlot(surface.slots);
  const busiest = Math.max(...surface.slots.map((s) => s.arrived), 1);

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {surface.label}
        </h3>
        <span className="text-xs text-slate-400">
          {formatRate(rate(surface.created, surface.views))} of views became a diagram
        </span>
      </div>

      <ol className="mt-4 flex flex-col">
        <FunnelStep
          label="Page views"
          count={surface.views}
          width={pct(surface.views, widest)}
          color={viewColor}
        />
        <StepRate value={rate(surface.arrived, surface.views)} verb="reached the editor" />
        <FunnelStep
          label="Reached the editor"
          count={surface.arrived}
          width={pct(surface.arrived, widest)}
          color={ctaColor}
          faded
        />
        <StepRate value={rate(surface.created, surface.arrived)} verb="created a diagram" />
        <FunnelStep
          label="Created a diagram"
          count={surface.created}
          width={pct(surface.created, widest)}
          color={ctaColor}
        />
      </ol>

      {/* Fixed layout so a long label truncates instead of widening the card
          past a phone screen. */}
      <table className="mt-5 w-full table-fixed text-sm">
        <colgroup>
          <col />
          <col className="w-16 sm:w-20" />
          <col className="w-16 sm:w-20" />
          <col className="w-16 sm:w-20" />
        </colgroup>
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-slate-400 uppercase">
            <th className="pb-2 font-medium">Call to action</th>
            <th className="pb-2 pl-2 text-right font-medium">Arrived</th>
            <th className="pb-2 pl-2 text-right font-medium">Created</th>
            <th className="pb-2 pl-2 text-right font-medium">Converts</th>
          </tr>
        </thead>
        <tbody>
          {surface.slots.map((slot) => {
            const unused = slot.arrived === 0 && slot.created === 0;
            return (
              <tr
                key={slot.source}
                className={`border-t border-slate-100 dark:border-slate-800 ${unused ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <td className="py-2 pr-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
                    <span className="min-w-0 sm:truncate" title={slot.label}>
                      {slot.label}
                    </span>
                    {slot.source === best ? <BestTag /> : null}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 block h-1 rounded-full"
                    style={{
                      width: `${pct(slot.arrived, busiest)}%`,
                      backgroundColor: ctaColor,
                      opacity: 0.45,
                    }}
                  />
                </td>
                <td className="py-2 text-right tabular-nums">{slot.arrived.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums">{slot.created.toLocaleString()}</td>
                <td className="py-2 pl-3 text-right font-medium tabular-nums">
                  {formatRate(rate(slot.created, slot.arrived))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FunnelStep({
  label,
  count,
  width,
  color,
  faded = false,
}: {
  label: string;
  count: number;
  width: number;
  color: string;
  faded?: boolean;
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${width}%`, backgroundColor: color, opacity: faded ? 0.6 : 1 }}
        />
      </div>
    </li>
  );
}

// The rate between two steps, on the connector between their bars.
function StepRate({ value, verb }: { value: number | null; verb: string }) {
  return (
    <li
      aria-label={`${formatRate(value)} ${verb}`}
      className="flex items-center gap-2 py-1.5 pl-1 text-xs text-slate-400"
    >
      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
        <path d="M5 1v8M2 6l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>
        <span className="font-semibold text-slate-600 tabular-nums dark:text-slate-300">
          {formatRate(value)}
        </span>{' '}
        {verb}
      </span>
    </li>
  );
}

function BestTag() {
  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
      Most diagrams
    </span>
  );
}
