'use client';

// The Incoming Webhook trigger's panel (docs/specs/026-plan/automations.md "Incoming Webhook"; blueprint
// automations.md "Phase 3", "Editor"): the rule's address with Copy; its secret, made once and shown that once in a
// monospace field with Copy and "You won't see it again", then only its last 4 characters, when it was made and last
// used, with Regenerate behind a confirm; what a call runs on; and How to Send, a curl with the header and one with the
// signature. A rule not saved yet has no address: it says to save first. Only an Editor of the whole plan, signed
// in, reaches the builder, so only they make, see or regenerate the secret.

import { useRef, useState } from 'react';
import { WEBHOOK_SIGNATURE_HEADER } from '@liveplanner/items';
import type { AutomationHookInfo, AutomationHookSecret } from '@liveplanner/api-schema';
import {
  Button,
  ConfirmPopover,
  Tooltip,
  formatRelativeTimeShort,
  lucideGlyph,
} from '@liveplanner/ui';
import { lucideCheck, lucideCopy } from '@liveworkspace/icons/lucide';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';
import { track } from '@/lib/telemetry';
import { useAutomationsAccess } from '../AutomationsContext';
import { makeHookSecret } from '../automations-client';
import { useIncomingRule } from '../incoming-rule';
import { PanelNote } from './panel-parts';

const CopyIcon = lucideGlyph(lucideCopy, 14);
const CheckIcon = lucideGlyph(lucideCheck, 14);

const LABEL = 'text-[12px] font-semibold text-slate-700 dark:text-slate-200';
const HINT = 'text-[12px] text-slate-500 dark:text-slate-400';
const CODE = 'font-mono text-[12px] leading-5 text-slate-800 dark:text-slate-100';

/** A value in a monospace field with an icon-only Copy at its right edge that turns into a check once copied. The
 *  browser refusing the clipboard selects the value for copying by hand and says so. */
function CopyField({
  label,
  value,
  onCopied,
  tone = 'plain',
}: {
  label: string;
  value: string;
  onCopied?: () => void;
  tone?: 'plain' | 'secret';
}) {
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const ref = useRef<HTMLElement>(null);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
      setCopied('yes');
      onCopied?.();
    } catch {
      setCopied('failed');
      if (ref.current) window.getSelection()?.selectAllChildren(ref.current);
    }
  };
  const ring =
    tone === 'secret'
      ? 'bg-white ring-emerald-200 dark:bg-slate-950 dark:ring-emerald-500/30'
      : 'bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700';
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex min-w-0 items-start gap-1 rounded-lg py-1.5 pl-2.5 pr-1 ring-1 ring-inset ${ring}`}
      >
        <code ref={ref} aria-label={label} className={`min-w-0 flex-1 break-all py-0.5 ${CODE}`}>
          {value}
        </code>
        <Tooltip label={copied === 'yes' ? 'Copied' : `Copy ${label}`}>
          <button
            type="button"
            aria-label={`Copy ${label}`}
            onClick={() => void copy()}
            className="touch-target relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            {copied === 'yes' ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          </button>
        </Tooltip>
      </div>
      {copied === 'failed' ? (
        <p role="alert" className="text-[12px] text-rose-700 dark:text-rose-300">
          This browser didn’t let us copy it. It’s selected: copy it with your keyboard or menu.
        </p>
      ) : null}
    </div>
  );
}

/** The two ways to send, as curl, with the address filled in. */
export function sendExamples(url: string): { header: string; signature: string } {
  const body = `{"cards": [12], "status": "green"}`;
  return {
    header: [
      `curl -X POST '${url}' \\`,
      `  -H 'Authorization: Bearer $SECRET' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${body}'`,
    ].join('\n'),
    signature: [
      `BODY='${body}'`,
      `SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')`,
      `curl -X POST '${url}' \\`,
      `  -H "${WEBHOOK_SIGNATURE_HEADER}: sha256=$SIG" \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d "$BODY"`,
    ].join('\n'),
  };
}

function HowToSend({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const examples = sendExamples(url);
  return (
    <div className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
      <AccordionSection
        title="How to Send"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        headerClassName="flex w-full cursor-pointer items-center justify-between py-2.5 text-left"
        titleClassName="text-[12px] font-semibold text-slate-700 dark:text-slate-200"
        bodyClassName="flex flex-col gap-3 pb-3"
      >
        <p className={HINT}>
          Send JSON, up to 16 KB. Name cards by number in <code className={CODE}>cards</code> (up to
          10); anything else in the body is yours to read with Webhook Field values. Set{' '}
          <code className={CODE}>SECRET</code> to the rule’s secret first.
        </p>
        <span className={LABEL}>With the Secret in a Header</span>
        <CopyField label="the header example" value={examples.header} />
        <span className={LABEL}>With a Signature</span>
        <p className={HINT}>
          An HMAC-SHA256 of the exact body, keyed with the secret, as GitHub signs its webhooks. The
          secret itself never travels.
        </p>
        <CopyField label="the signature example" value={examples.signature} />
      </AccordionSection>
    </div>
  );
}

function SecretState({
  hook,
  now,
  onRegenerate,
  busy,
}: {
  hook: AutomationHookSecret;
  now: number;
  onRegenerate: () => void;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState<HTMLButtonElement | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
          Ends in <span className={CODE}>…{hook.last4}</span>
        </span>
        <span className={HINT}>
          Made {formatRelativeTimeShort(Math.max(0, now - hook.madeAt))} ·{' '}
          {hook.usedAt === null
            ? 'Never used'
            : `Last used ${formatRelativeTimeShort(Math.max(0, now - hook.usedAt))}`}
        </span>
      </div>
      <Button
        variant="secondary"
        size="xs"
        disabled={busy}
        aria-haspopup="dialog"
        onClick={(e) => setConfirm(e.currentTarget)}
      >
        Regenerate
      </Button>
      {confirm ? (
        <ConfirmPopover
          anchor={confirm}
          message="Make a new secret? The old one stops working at once, so update the other tool with the new one."
          confirmLabel="Regenerate"
          onConfirm={() => {
            setConfirm(null);
            onRegenerate();
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

function Revealed({ secret, onDone }: { secret: string; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/5">
      <p role="status" className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
        Secret Made · Shown Once
      </p>
      <CopyField
        label="the secret"
        value={secret}
        tone="secret"
        onCopied={() => track('Plan', 'Copied', 'AutomationSecret')}
      />
      <p className={HINT}>
        You won’t see it again. Keep it where the other tool keeps its passwords.
      </p>
      <Button variant="secondary" size="xs" className="self-start" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export function IncomingWebhookPanel() {
  const access = useAutomationsAccess();
  const rule = useIncomingRule();
  // What this panel made since the list was read: the newer hook, and the secret while it is shown.
  const [made, setMade] = useState<AutomationHookInfo | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const hook = made ?? rule.hook ?? null;

  if (!rule.ruleId || !hook)
    return (
      <PanelNote>
        Save the rule to get its address and secret. Another tool then starts it by sending JSON to
        that address.
      </PanelNote>
    );

  const make = async () => {
    if (!access || busy) return;
    const again = hook.secret !== null;
    setBusy(true);
    setFailed(false);
    try {
      const answer = await makeHookSecret(access.scope, rule.ruleId!);
      if (again) track('Plan', 'Changed', 'AutomationSecret');
      else track('Plan', 'Created', 'AutomationSecret');
      setMade(answer.hook);
      setSecret(answer.secret);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-incoming-webhook="" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Address</span>
        <CopyField label="the address" value={hook.url} />
        <p className={HINT}>
          Another tool sends a POST with JSON here. The address alone starts nothing.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Secret</span>
        {secret ? (
          <Revealed secret={secret} onDone={() => setSecret(null)} />
        ) : hook.secret ? (
          <SecretState
            hook={hook.secret}
            now={rule.now}
            busy={busy}
            onRegenerate={() => void make()}
          />
        ) : (
          <>
            <Button size="xs" className="self-start" disabled={busy} onClick={() => void make()}>
              {busy ? 'Making Secret…' : 'Make Secret'}
            </Button>
            <p className={HINT}>
              The call proves it comes from your tool with this secret. It starts this rule and
              nothing else.
            </p>
          </>
        )}
        {failed ? (
          <p role="alert" className="text-[12px] text-rose-700 dark:text-rose-300">
            The secret wasn’t made. Check your connection and try again.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Runs On</span>
        <PanelNote>
          {rule.cardless
            ? 'The cards the call names. With none named, it runs once with no card.'
            : 'The cards the call names. Its steps change a card, so the call must name cards.'}
        </PanelNote>
      </div>
      <HowToSend url={hook.url} />
    </div>
  );
}
