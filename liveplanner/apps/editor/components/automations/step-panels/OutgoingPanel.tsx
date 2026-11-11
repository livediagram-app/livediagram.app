'use client';

// Send to Webhook, Post to Slack and Post to Microsoft Teams (docs/specs/026-plan/automations.md "Outgoing
// actions"): which of the plan's webhooks of that kind it posts through (Your Own Service, Slack, Teams), picked by
// name and kept with its name for the Run Log, with Add a Webhook… opening the plan's Webhooks dialog; and the message,
// with its values and a Preview. The list is the index's, read when the panel first opens (plan-webhooks.tsx). A rule
// never holds an address: a plan with no webhook of the kind says so and offers to add one.

import {
  AUTOMATION_NOTIFY_NAMES,
  AUTOMATION_TEXT_MAX,
  type AutomationOutgoing,
  type AutomationVia,
} from '@liveplanner/items';
import type { Webhook, WebhookKind } from '@liveworkspace/index-client';
import { Button } from '@liveplanner/ui';
import { useEffect } from 'react';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { usePlanWebhooks } from '../plan-webhooks';
import { OUTGOING_KINDS, defaultOutgoing, viaOf, type OutgoingKind } from '../step-defaults';
import { ValueTextField } from '../ValueInsert';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

const KIND_OF: Readonly<Record<AutomationVia, WebhookKind>> = {
  webhook: 'json',
  slack: 'slack',
  teams: 'teams',
};

// What the plan's webhooks of a kind are called in a sentence.
const KIND_WORDS: Readonly<Record<AutomationVia, string>> = {
  webhook: 'own-service',
  slack: 'Slack',
  teams: 'Teams',
};

const HINTS: Readonly<Record<AutomationVia, string>> = {
  webhook: 'Sent as a signed JSON event with the rule and the card.',
  slack: 'Posted with an Open in liveplanner link to the card.',
  teams: 'Posted as a card with an Open in liveplanner link.',
};

const kindOfStep = (via: AutomationVia): OutgoingKind =>
  OUTGOING_KINDS.find((k) => viaOf(k) === via) ?? 'notify_webhook';

const LINK =
  'touch-target-y relative cursor-pointer self-start rounded text-[12px] font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline dark:text-brand-300 dark:hover:text-brand-200';

function webhookLabel(w: Webhook): string {
  return w.pausedAt ? `${w.name} (Paused)` : w.name;
}

function WebhookPicker({
  step,
  onChange,
  invalid,
}: {
  step: AutomationOutgoing;
  onChange: (next: AutomationOutgoing) => void;
  invalid: boolean;
}) {
  const hooks = usePlanWebhooks();
  const { signInHref } = useAuthHrefs();
  const load = hooks?.load;
  useEffect(() => load?.(), [load]);
  if (!hooks) return null;
  if (hooks.status === 'signed_out')
    return (
      <PanelNote>
        Webhooks belong to an account, so only someone signed in can pick one.{' '}
        <a
          href={signInHref}
          className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
        >
          Sign In
        </a>
      </PanelNote>
    );
  const mine = hooks.webhooks.filter((w) => w.kind === KIND_OF[step.via]);
  const known = mine.some((w) => w.id === step.webhook);
  const add = (
    <button type="button" className={LINK} onClick={hooks.openDialog}>
      Add a Webhook…
    </button>
  );
  if (hooks.status === 'error')
    return (
      <div className="flex flex-col gap-2">
        <PanelNote>
          Couldn’t load this plan’s webhooks. Check your connection and try again.
        </PanelNote>
        <Button variant="secondary" size="xs" className="self-start" onClick={hooks.retry}>
          Try Again
        </Button>
      </div>
    );
  const loading = hooks.status !== 'ready';
  return (
    <div className="flex flex-col gap-1.5">
      <PanelField
        label="Webhook"
        hint={
          !loading && mine.length === 0
            ? `This plan has no ${KIND_WORDS[step.via]} webhooks yet. Add one, then pick it here.`
            : undefined
        }
      >
        {(id) => (
          <PanelSelect
            id={id}
            value={step.webhook}
            disabled={loading}
            aria-invalid={invalid || undefined}
            onChange={(e) => {
              const picked = mine.find((w) => w.id === e.target.value);
              if (picked) onChange({ ...step, webhook: picked.id, name: picked.name });
            }}
          >
            {loading ? <option value={step.webhook}>Loading webhooks…</option> : null}
            {!loading && !step.webhook ? <option value="">Pick a webhook</option> : null}
            {!loading && step.webhook && !known ? (
              <option value={step.webhook}>{step.name ?? 'A webhook'} (No Longer Here)</option>
            ) : null}
            {mine.map((w) => (
              <option key={w.id} value={w.id}>
                {webhookLabel(w)}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {add}
    </div>
  );
}

export function OutgoingPanel({
  step,
  onChange,
  outline,
  invalidPath,
}: {
  step: AutomationOutgoing;
  onChange: (next: AutomationOutgoing) => void;
  outline: AutomationOutline;
  // The refusal's path within this step ('webhook', 'text'), or null.
  invalidPath: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Action">
        {(id) => (
          <PanelSelect
            id={id}
            value={kindOfStep(step.via)}
            onChange={(e) => {
              const via = viaOf(e.target.value as OutgoingKind);
              if (via !== step.via) onChange({ ...defaultOutgoing(via), text: step.text });
            }}
          >
            {OUTGOING_KINDS.map((k) => (
              <option key={k} value={k}>
                {AUTOMATION_NOTIFY_NAMES[viaOf(k)]}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <WebhookPicker step={step} onChange={onChange} invalid={invalidPath === 'webhook'} />
      <ValueTextField
        label="Message"
        maxLength={AUTOMATION_TEXT_MAX}
        value={step.text}
        fields={outlineFields(outline.types)}
        invalid={invalidPath === 'text'}
        hint={HINTS[step.via]}
        onChange={(text) => onChange({ ...step, text })}
      />
    </div>
  );
}
