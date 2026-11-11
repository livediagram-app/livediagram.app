// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Incoming Webhook" and "Values": the trigger in the When panel, its address and
// secret (made once, shown once, then only its last 4 characters, Regenerate behind a confirm), How to Send, and
// Webhook Field… in Insert a Value, offered only in an incoming rule.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import type { AutomationHookInfo } from '@liveplanner/api-schema';
import { AutomationsContext } from './AutomationsContext';
import { IncomingRuleProvider, type IncomingRule } from './incoming-rule';
import { newRuleBody, type RulePart } from './rule-draft';
import { StepPanel } from './StepPanel';
import { sendExamples } from './step-panels/IncomingWebhookPanel';
import { outline } from './test-fixtures';
import { ValueTextField } from './ValueInsert';

const client = vi.hoisted(() => ({ makeHookSecret: vi.fn() }));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const NOW = Date.UTC(2026, 10, 11, 12);
const URL_ = 'https://www.liveplanner.app/api/hooks/automations/p1/r1';
const SECRET = `lwh_${'A'.repeat(82)}Xf3k`;
const made: AutomationHookInfo = {
  url: URL_,
  secret: { last4: 'Xf3k', madeAt: NOW - 3_600_000, usedAt: null },
};

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  client.makeHookSecret.mockReset();
  track.mockReset();
});
afterEach(cleanup);

const incoming = (over: Partial<IncomingRule> = {}): IncomingRule => ({
  incoming: true,
  ruleId: 'r1',
  hook: { url: URL_, secret: null },
  cardless: false,
  now: NOW,
  ...over,
});

let latest: AutomationRuleBody;
function Panel({
  body,
  rule = incoming(),
  part = { part: 'trigger' },
}: {
  body: AutomationRuleBody;
  rule?: IncomingRule;
  part?: RulePart;
}) {
  const [b, setB] = useState(body);
  return (
    <AutomationsContext.Provider value={{ scope: SCOPE, open: () => {} }}>
      <IncomingRuleProvider value={rule}>
        <StepPanel
          body={b}
          part={part}
          onChange={(next) => {
            latest = next;
            setB(next);
          }}
          outline={outline()}
          faultPath={null}
          person="Ana Costa"
          now={NOW}
          timeZone="Europe/London"
        />
      </IncomingRuleProvider>
    </AutomationsContext.Provider>
  );
}
const body = (over: Partial<AutomationRuleBody> = {}): AutomationRuleBody => ({
  ...newRuleBody('From CI', 'UTC'),
  trigger: { kind: 'incoming_webhook' },
  ...over,
});

describe('the trigger', () => {
  it('is offered under Another Tool Sends It and starts bare', () => {
    render(<Panel body={newRuleBody('From CI', 'UTC')} rule={incoming({ ruleId: null })} />);
    const select = screen.getByRole('combobox', { name: 'Trigger' });
    const group = within(select).getByRole('group', { name: 'Another Tool Sends It' });
    expect(within(group).getByRole('option', { name: 'Incoming Webhook' })).toBeTruthy();
    fireEvent.change(select, { target: { value: 'incoming_webhook' } });
    expect(latest.trigger).toEqual({ kind: 'incoming_webhook' });
    expect(screen.getByText(/Save the rule to get its address and secret/)).toBeTruthy();
  });

  it('says to save first while the rule saved is not one yet', () => {
    render(<Panel body={body()} rule={incoming({ hook: undefined })} />);
    expect(screen.getByText(/Save the rule to get its address and secret/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make Secret' })).toBeNull();
  });
});

describe('the address and secret', () => {
  it('copies the address, and makes a secret shown once with Copy and its warning', async () => {
    client.makeHookSecret.mockResolvedValue({ secret: SECRET, hook: made });
    render(<Panel body={body()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy the address' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_));
    expect(screen.getByText(/The call proves it comes from your tool/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make Secret' }));
    await screen.findByText('Secret Made · Shown Once');
    expect(client.makeHookSecret).toHaveBeenCalledWith(SCOPE, 'r1');
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'AutomationSecret');
    expect(screen.getByLabelText('the secret').textContent).toBe(SECRET);
    expect(screen.getByText(/You won’t see it again/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy the secret' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
    expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'AutomationSecret');
    // Done hides it for good: only the last 4 remain.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(screen.getByText('…Xf3k')).toBeTruthy();
    expect(screen.getByText(/Never used/)).toBeTruthy();
  });

  it('selects the value and says so when the browser refuses the clipboard', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<Panel body={body()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy the address' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/didn’t let us copy it/);
  });

  it('regenerates only after the confirm, and says when making one failed', async () => {
    render(
      <Panel
        body={body()}
        rule={incoming({ hook: { ...made, secret: { ...made.secret!, usedAt: NOW - 60_000 } } })}
      />,
    );
    expect(screen.getByText(/Last used/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm.textContent).toMatch(/old one stops working at once/);
    client.makeHookSecret.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(within(confirm).getByRole('button', { name: 'Regenerate' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/secret wasn’t made/);
    expect(track).not.toHaveBeenCalled();
    client.makeHookSecret.mockResolvedValue({ secret: SECRET, hook: made });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Regenerate' }),
    );
    await screen.findByText('Secret Made · Shown Once');
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'AutomationSecret');
  });

  it('says what a call runs on, and How to Send shows both ways with the address', () => {
    const { rerender } = render(<Panel body={body()} rule={incoming({ cardless: true })} />);
    expect(screen.getByText(/With none named, it runs once with no card/)).toBeTruthy();
    rerender(<Panel body={body()} rule={incoming({ cardless: false })} />);
    expect(screen.getByText(/the call must name cards/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'How to Send' }));
    expect(screen.getByLabelText('the header example').textContent).toContain(
      'Authorization: Bearer $SECRET',
    );
    expect(screen.getByLabelText('the signature example').textContent).toContain(
      'X-Liveplanner-Signature: sha256=$SIG',
    );
  });

  it('builds curl lines that sign the body sent', () => {
    const { header, signature } = sendExamples(URL_);
    expect(header).toContain(`curl -X POST '${URL_}'`);
    expect(signature).toContain('openssl dgst -sha256 -hmac "$SECRET"');
    expect(signature).toContain('-d "$BODY"');
  });
});

describe('Webhook Field…', () => {
  function Field({ rule }: { rule?: IncomingRule }) {
    const [text, setText] = useState('Build ');
    latestText = text;
    const field = <ValueTextField label="Comment" value={text} onChange={setText} fields={[]} />;
    return rule ? <IncomingRuleProvider value={rule}>{field}</IncomingRuleProvider> : field;
  }
  let latestText = '';
  const wrap = (node: ReactNode) => render(<>{node}</>);

  it('is offered only in an incoming rule', () => {
    wrap(<Field />);
    expect(screen.queryByRole('button', { name: 'Webhook Field…' })).toBeNull();
  });

  it('inserts {{webhook.<path>}} for a good path and explains a bad one', () => {
    wrap(<Field rule={incoming()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Webhook Field…' }));
    const input = screen.getByRole('textbox', { name: 'Webhook Field' });
    fireEvent.change(input, { target: { value: 'a.b.c.d.e.f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    expect(screen.getByRole('alert').textContent).toMatch(/up to 5 deep/);
    expect(latestText).toBe('Build ');
    fireEvent.change(input, { target: { value: ' build.status ' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(latestText).toContain('{{webhook.build.status}}');
    expect(screen.queryByRole('textbox', { name: 'Webhook Field' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Webhook Field…' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Webhook Field' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Webhook Field' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Webhook Field…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Webhook Field…' })).toBeTruthy();
  });

  it('keeps whoever triggered it out of an incoming rule’s recipients', () => {
    render(
      <Panel
        body={body({ steps: [{ kind: 'assign', to: { nobody: true } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(screen.queryByText(/Whoever Triggered It/i)).toBeNull();
  });
});
