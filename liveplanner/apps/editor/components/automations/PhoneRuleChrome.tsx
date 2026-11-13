'use client';

// The rule drawer's top and foot on a phone (docs/specs/026-plan/automations.md "The rule builder on a phone"). The
// top: a back chevron to Automations and the rule's state (the On / Off switch with its word, or an Off pill for a
// rule not saved yet), then the name as an editable title on its own line, wrapping as it needs, and "Edited by …".
// The foot, pinned over the safe area: Rule Details as a bar, then Test on a Card and Save Rule side by side.

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { AUTOMATION_NAME_MAX } from '@liveplanner/items';
import {
  Button,
  CheckIcon,
  ChevronLeftIcon,
  HoverCard,
  Switch,
  useDialogDismiss,
} from '@liveplanner/ui';

// The rule's On / Off switch's name, the same whichever way it is set (its state is the switch's own, read as on or
// off), on a phone as on a wide screen.
export const RULE_SWITCH_NAME = 'Rule On';

const BACK =
  'touch-target-y relative -ml-2 flex h-11 cursor-pointer items-center gap-1 rounded-lg px-2 text-[14px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

/** The rule's name as a title: a textarea of one row that grows with its words, never breaking on Enter. */
export function RuleNameField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label="Rule name"
      aria-invalid={invalid || undefined}
      rows={1}
      value={value}
      maxLength={AUTOMATION_NAME_MAX}
      spellCheck
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      className={`-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-lg bg-transparent px-2 py-1 text-[18px] font-semibold leading-snug text-slate-900 outline-none transition hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-200 motion-reduce:transition-none dark:text-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-900 dark:focus:ring-brand-500/30 ${invalid ? 'ring-2 ring-red-300 dark:ring-red-500/50' : ''}`}
    />
  );
}

// Back through the drawer, so it slides down (and asks first when there are unsaved changes).
function BackButton({ onBack }: { onBack: () => void }) {
  const dismiss = useDialogDismiss();
  return (
    <HoverCard title="Back to Automations" description="Leave this rule for the list of rules.">
      <button type="button" onClick={() => dismiss(onBack)} className={BACK}>
        <ChevronLeftIcon size={18} />
        Automations
      </button>
    </HoverCard>
  );
}

export function PhoneRuleHeader({
  name,
  onName,
  nameFault,
  state,
  edited,
  onBack,
}: {
  name: string;
  onName: (next: string) => void;
  nameFault: string | null;
  // A saved rule's switch; absent for a rule not saved yet.
  state: { enabled: boolean; busy: boolean; onToggle: (next: boolean) => void } | null;
  edited: ReactNode;
  onBack: () => void;
}) {
  return (
    <div
      data-rule-header="phone"
      className="shrink-0 border-b border-slate-100 px-4 pb-3 dark:border-slate-800"
    >
      <div className="flex h-11 items-center justify-between gap-3">
        <BackButton onBack={onBack} />
        {state ? (
          <label className="flex h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            <span aria-hidden>{state.enabled ? 'On' : 'Off'}</span>
            <Switch
              size="sm"
              checked={state.enabled}
              busy={state.busy}
              label={RULE_SWITCH_NAME}
              onChange={state.onToggle}
            />
          </label>
        ) : (
          <HoverCard title="Off" description="A rule starts off. Save it, then switch it on.">
            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className="font-semibold">Off</span>
              <span aria-hidden>·</span>
              <span>Not Saved</span>
            </span>
          </HoverCard>
        )}
      </div>
      <RuleNameField value={name} onChange={onName} invalid={nameFault !== null} />
      {edited ? (
        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{edited}</p>
      ) : null}
    </div>
  );
}

export function PhoneRuleFoot({
  details,
  message,
  onTest,
  onSave,
  saving,
  saved,
}: {
  details: ReactNode;
  // A refusal not tied to a step, or the name's.
  message: string | null;
  onTest: () => void;
  onSave: () => void;
  saving: boolean;
  // A saved rule with nothing changed: Save Rule reads Saved.
  saved: boolean;
}) {
  // Saved takes Save Rule's place: when the save had the keyboard (focus fell to the page with the button), it moves
  // to Saved rather than to the top of the dialog (busy-buttons.md "When the work ends").
  const savedRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!saved) return;
    const at = document.activeElement;
    if (at === null || at === document.body) savedRef.current?.focus({ preventScroll: true });
  }, [saved]);
  return (
    <div
      data-rule-foot=""
      className="shrink-0 border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {details}
      {message ? (
        <p
          role="alert"
          className="px-4 pb-1 text-[12px] font-medium text-red-700 dark:text-red-300"
        >
          {message}
        </p>
      ) : null}
      {/* Two equal columns: Saved has no button's padding, so flex-1 alone drew it narrower than Test on a Card. */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 pb-3 pt-3 dark:border-slate-800">
        <Button variant="secondary" size="md" className="h-11" onClick={onTest}>
          Test on a Card
        </Button>
        {saved ? (
          // Nothing to save: a plain, full-contrast state rather than a faded button.
          <span
            ref={savedRef}
            role="status"
            tabIndex={-1}
            className="flex h-11 items-center justify-center gap-1.5 rounded-md bg-emerald-50 text-sm font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
          >
            <CheckIcon size={14} />
            Saved
          </span>
        ) : (
          <Button variant="primary" size="md" className="h-11" onClick={onSave} busy={saving}>
            {saving ? 'Saving…' : 'Save Rule'}
          </Button>
        )}
      </div>
    </div>
  );
}
