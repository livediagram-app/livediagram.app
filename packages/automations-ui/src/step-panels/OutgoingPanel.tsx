'use client';

// A message step's panel (liveworkspace/docs/specs/018-automations/automations.md "Connections"): Send to Webhook,
// Post to Slack or Post to Microsoft Teams. The Action row changes it into another of the three (its message kept),
// or into any other action Add Action offers where it stands (StepPanel's `change`); Connection picks one of the item's connections of its kind by name,
// a paused one marked, one the rule names that is gone kept as "(No Longer Here)"; Add a Connection… opens the
// screen's Connections tab, the rule kept for the way back; Message is the text, with Insert a Value. Connections
// are an account's: a guest is told to sign in.

import { useEffect } from 'react';
import {
  AUTOMATION_TEXT_MAX,
  type AutomationOutgoing,
  type AutomationVia,
} from '@liveworkspace/automations';
import type { Webhook, WebhookKind } from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { useItemConnections } from '../item-connections';
import { useAutomationsKit } from '../kit-context';
import { RULE_ROW_LINK } from '../RuleRow';
import type { RuleBody } from '../types';
import { ValueTextField } from '../ValueInsert';
import { ChangeActionField } from './ChangeActionField';
import { MessageRunCost } from '../tier/MessageRunCost';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

const KIND_OF: Readonly<Record<AutomationVia, WebhookKind>> = {
  webhook: 'json',
  slack: 'slack',
  teams: 'teams',
};
const KIND_WORDS: Readonly<Record<AutomationVia, string>> = {
  webhook: 'own-service',
  slack: 'Slack',
  teams: 'Teams',
};

function connectionLabel(w: Webhook): string {
  return w.pausedAt ? `${w.name} (Paused)` : w.name;
}

function ConnectionPicker({
  step,
  onChange,
  invalid,
}: {
  step: AutomationOutgoing;
  onChange: (next: AutomationOutgoing) => void;
  invalid: boolean;
}) {
  const kit = useAutomationsKit();
  const { item } = kit.plumbing.words;
  const hooks = useItemConnections();
  const signInHref = kit.connections.useSignInHref();
  const load = hooks?.load;
  useEffect(() => load?.(), [load]);
  if (!hooks) return null;
  if (hooks.status === 'signed_out')
    return (
      <PanelNote>
        Connections belong to an account, so only someone signed in can pick one.{' '}
        <a
          href={signInHref}
          className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
        >
          Sign In
        </a>
      </PanelNote>
    );
  const mine = hooks.connections.filter((w) => w.kind === KIND_OF[step.via]);
  const known = mine.some((w) => w.id === step.webhook);
  if (hooks.status === 'error')
    return (
      <div className="flex flex-col gap-2">
        <PanelNote>
          Couldn’t load this {item}’s connections. Check your connection and try again.
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
        label="Connection"
        hint={
          !loading && mine.length === 0
            ? `This ${item} has no ${KIND_WORDS[step.via]} connections yet. Add one, then pick it here.`
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
            {loading ? <option value={step.webhook}>Loading connections…</option> : null}
            {!loading && !step.webhook ? <option value="">Pick a connection</option> : null}
            {!loading && step.webhook && !known ? (
              <option value={step.webhook}>{step.name ?? 'A connection'} (No Longer Here)</option>
            ) : null}
            {mine.map((w) => (
              <option key={w.id} value={w.id}>
                {connectionLabel(w)}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {/* Outside the screen (a panel drawn on its own) there is no Connections tab to open. */}
      {hooks.openTab ? (
        <button
          type="button"
          className={`${RULE_ROW_LINK} self-start text-[12px]`}
          onClick={hooks.openTab}
        >
          Add a Connection…
        </button>
      ) : null}
    </div>
  );
}

export function OutgoingPanel({
  step,
  onChange,
  invalidPath,
  change,
}: {
  step: AutomationOutgoing;
  onChange: (next: AutomationOutgoing) => void;
  // Where it stands, for Change: the rule without it, whether it is the last step, and a change to a kind not a
  // message (started afresh).
  change: { rest: RuleBody; last: boolean; onKind: (key: string) => void };
  // Where a refusal points inside the step ('webhook', 'text'), or null.
  invalidPath: string | null;
}) {
  const { messages } = useAutomationsKit();
  return (
    <div className="flex flex-col gap-4">
      <ChangeActionField
        actionKey={`notify_${step.via}`}
        where="top"
        rest={change.rest}
        last={change.last}
        onChange={(key) => {
          if (!key.startsWith('notify_')) {
            change.onKind(key);
            return;
          }
          const via = key.slice('notify_'.length) as AutomationVia;
          // Another tool: its own connection to pick, the message kept.
          if (via !== step.via) onChange({ ...messages.fresh(via), text: step.text });
        }}
      />
      {/* With Pro on: each message counts as one of the owner's automation runs. */}
      <MessageRunCost />
      <ConnectionPicker step={step} onChange={onChange} invalid={invalidPath === 'webhook'} />
      <ValueTextField
        label="Message"
        maxLength={AUTOMATION_TEXT_MAX}
        value={step.text}
        invalid={invalidPath === 'text'}
        hint={messages.hints[step.via]}
        onChange={(text) => onChange({ ...step, text })}
      />
    </div>
  );
}
