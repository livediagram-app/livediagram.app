import { Fragment } from 'react';
import { SOLID_BRAND_DARK, Glyph } from '@livediagram/ui';

export type WizardStep = 'template' | 'settings';
const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'template', label: 'Template' },
  // The step is still "settings" in code; what it asks is where the document
  // lives (name, save location, folder), so the chip says that.
  { key: 'settings', label: 'Location' },
];

// The welcome wizard's header (Template -> Location,
// docs/specs/007-editor/new-document-route.md), plus its StepChip pill. A compact, left-aligned
// stepper: each chip jumps to that step, and the connector fills brand as you
// advance so it reads as progress rather than a static rule. There is no theme
// step: a new document starts on the default theme and the Theme and canvas
// controls change it later. Quick Start (in the editor) is a single page, so it
// renders no rail at all.
export function WizardSteps({
  step,
  onStep,
}: {
  step: WizardStep;
  onStep: (s: WizardStep) => void;
}) {
  const steps = WIZARD_STEPS;
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="-ml-1 flex items-center justify-start gap-1 sm:gap-1.5">
      {steps.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 ? (
            <div className="h-1.5 w-3 overflow-hidden rounded-full bg-slate-200 sm:w-9 dark:bg-slate-700">
              <div
                className={`h-full rounded-full bg-brand-500 transition-[width] duration-short ease-out ${
                  i <= idx ? 'w-full' : 'w-0'
                }`}
              />
            </div>
          ) : null}
          <StepChip
            n={i + 1}
            label={s.label}
            state={i < idx ? 'done' : i === idx ? 'active' : 'upcoming'}
            onClick={() => onStep(s.key)}
          />
        </Fragment>
      ))}
    </div>
  );
}

function StepChip({
  n,
  label,
  state,
  onClick,
}: {
  n: number;
  label: string;
  state: 'active' | 'done' | 'upcoming';
  onClick?: () => void;
}) {
  const lit = state === 'active' || state === 'done';
  const circle = lit
    ? `bg-brand-700 text-white shadow-sm shadow-brand-500/30 ${SOLID_BRAND_DARK}`
    : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
  const text = lit ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400';
  // The current step sits in a soft brand pill so "you are here" reads at
  // a glance; the other chips stay flush (matching padding keeps the row
  // from shifting as the active step moves). The pill's round cap is
  // concentric with the circle: pl-1 equals py-1 at every breakpoint
  // (docs/specs/004-interface-design/color-scheme.md, Usage rules).
  const pill =
    state === 'active'
      ? 'rounded-full bg-brand-50 dark:bg-brand-500/15'
      : 'rounded-full bg-transparent';
  const inner = (
    <>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${circle}`}
      >
        {state === 'done' ? (
          <Glyph size={12} units={12}>
            <path d="M2.5 6.2 5 8.5l4.5-5" />
          </Glyph>
        ) : (
          <span className="text-optical-centre">{n}</span>
        )}
      </span>
      <span className={`text-xs font-medium transition-colors ${text}`}>{label}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 py-1 pl-1 pr-1.5 transition-colors sm:gap-2 sm:pr-2.5 ${pill}`}
    >
      {inner}
    </button>
  ) : (
    <div className={`flex items-center gap-1.5 py-1 pl-1 pr-1.5 sm:gap-2 sm:pr-2.5 ${pill}`}>
      {inner}
    </div>
  );
}
