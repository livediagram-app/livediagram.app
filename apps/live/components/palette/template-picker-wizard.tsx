import { Fragment } from 'react';

type WizardStep = 'template' | 'theme' | 'settings';
const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'theme', label: 'Theme' },
  { key: 'settings', label: 'Settings' },
];

// The 3-step wizard header for the template picker (Template -> Theme ->
// Settings, spec/76), plus its StepChip pill. A compact, left-aligned
// stepper: each chip jumps to that step, and the connector fills brand as
// you advance so it reads as progress rather than a static rule.
export function WizardSteps({
  step,
  onStep,
}: {
  step: WizardStep;
  onStep: (s: WizardStep) => void;
}) {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="-ml-2.5 flex items-center justify-start gap-1.5">
      {WIZARD_STEPS.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 ? (
            <div className="h-1.5 w-9 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out ${
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
    ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
    : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
  const text = lit ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500';
  // The current step sits in a soft brand pill so "you are here" reads at
  // a glance; the other chips stay flush (matching padding keeps the row
  // from shifting as the active step moves).
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
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 6.2 5 8.5l4.5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          n
        )}
      </span>
      <span className={`text-xs font-medium transition-colors ${text}`}>{label}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1 transition-colors ${pill}`}
    >
      {inner}
    </button>
  ) : (
    <div className={`flex items-center gap-2 px-2.5 py-1 ${pill}`}>{inner}</div>
  );
}
