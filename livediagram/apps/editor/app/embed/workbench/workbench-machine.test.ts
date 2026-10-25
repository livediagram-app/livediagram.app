import { describe, expect, it } from 'vitest';
import type {
  WorkbenchDocumentSessionResponse,
  WorkbenchWorkspaceSessionResponse,
} from '@livediagram/api-schema';
import {
  endReasonOfInvalidSession,
  INITIAL_WORKBENCH_PHASE,
  workbenchTransition,
  type WorkbenchEvent,
  type WorkbenchPhase,
} from './workbench-machine';

// The page machine (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page"):
// every transition of the phase table.

const TICKET = `Ab3_-xYz0123456789abcd.${'0f'.repeat(32)}`;
const SESSION: WorkbenchDocumentSessionResponse = {
  session: `lvw_${'a'.repeat(43)}.${'0f'.repeat(32)}`,
  scope: 'document',
  documentId: 'doc-1',
  folderId: null,
  tabId: null,
  origin: 'https://127.0.0.1:5175',
  role: 'edit',
  expiresAt: 10_000,
  person: { id: 'user_1', name: 'Webber', color: '#0ea5e9' },
};
const RENEWED: WorkbenchDocumentSessionResponse = {
  ...SESSION,
  session: `lvw_${'b'.repeat(43)}.${'0f'.repeat(32)}`,
};

const redeeming: WorkbenchPhase = {
  phase: 'redeeming',
  ticket: TICKET,
  scope: 'document',
  documentId: 'doc-1',
};
const binding: WorkbenchPhase = { phase: 'binding', session: SESSION };
const mounted: WorkbenchPhase = { phase: 'mounted', session: SESSION, name: 'Acme Editor' };

const run = (from: WorkbenchPhase, event: WorkbenchEvent) => workbenchTransition(from, event);

describe('workbenchTransition', () => {
  it('starts reading', () => {
    expect(INITIAL_WORKBENCH_PHASE).toEqual({ phase: 'reading' });
  });

  it('redeems a ticket it read', () => {
    expect(
      run(INITIAL_WORKBENCH_PHASE, {
        type: 'read',
        ticket: TICKET,
        scope: 'document',
        documentId: 'doc-1',
      }),
    ).toEqual(redeeming);
  });

  it('refuses an address with no ticket', () => {
    expect(
      run(INITIAL_WORKBENCH_PHASE, {
        type: 'read',
        ticket: null,
        scope: 'document',
        documentId: 'doc-1',
      }),
    ).toEqual({
      phase: 'refused',
      cause: 'no-ticket',
    });
  });

  it('binds a session for the address’s document', () => {
    expect(run(redeeming, { type: 'redeemed', session: SESSION })).toEqual(binding);
  });

  it('refuses a session for another document', () => {
    expect(
      run(redeeming, { type: 'redeemed', session: { ...SESSION, documentId: 'doc-2' } }),
    ).toEqual({
      phase: 'refused',
      cause: 'mismatch',
    });
    expect(
      run(
        { ...redeeming, documentId: null },
        {
          type: 'redeemed',
          session: SESSION,
        },
      ),
    ).toEqual({ phase: 'refused', cause: 'mismatch' });
  });

  it('refuses a ticket the api refused', () => {
    expect(run(redeeming, { type: 'redeem-refused' })).toEqual({
      phase: 'refused',
      cause: 'ticket',
    });
  });

  it('fails when the redemption could not reach the api', () => {
    expect(run(redeeming, { type: 'redeem-failed' })).toEqual({ phase: 'failed' });
  });

  it('mounts once the workbench answers', () => {
    expect(run(binding, { type: 'acked', name: 'Acme Editor' })).toEqual(mounted);
  });

  it('is unbound when nobody answers', () => {
    expect(run(binding, { type: 'unanswered' })).toEqual({
      phase: 'unbound',
      origin: SESSION.origin,
    });
  });

  it('swaps a renewed session for the same document and origin', () => {
    expect(run(mounted, { type: 'renewed', session: RENEWED })).toEqual({
      ...mounted,
      session: RENEWED,
    });
  });

  it('keeps the session when a renewal names another document or origin', () => {
    expect(run(mounted, { type: 'renewed', session: { ...RENEWED, documentId: 'doc-2' } })).toBe(
      mounted,
    );
    expect(
      run(mounted, { type: 'renewed', session: { ...RENEWED, origin: 'https://evil.example' } }),
    ).toBe(mounted);
  });

  it.each(['expired', 'revoked', 'trashed'] as const)('ends a mounted page as %s', (reason) => {
    expect(run(mounted, { type: 'ended', reason })).toEqual({
      phase: 'ended',
      session: SESSION,
      name: 'Acme Editor',
      reason,
    });
  });

  const terminal: WorkbenchPhase[] = [
    { phase: 'ended', session: SESSION, name: 'Acme Editor', reason: 'expired' },
    { phase: 'unbound', origin: SESSION.origin },
    { phase: 'refused', cause: 'ticket' },
    { phase: 'failed' },
  ];
  const events: WorkbenchEvent[] = [
    { type: 'read', ticket: TICKET, scope: 'document', documentId: 'doc-1' },
    { type: 'redeemed', session: SESSION },
    { type: 'redeem-refused' },
    { type: 'redeem-failed' },
    { type: 'acked', name: 'Acme Editor' },
    { type: 'unanswered' },
    { type: 'renewed', session: RENEWED },
    { type: 'ended', reason: 'revoked' },
  ];

  it.each(terminal)('never leaves the terminal phase %o', (phase) => {
    for (const event of events) expect(run(phase, event)).toBe(phase);
  });

  it('ignores events out of turn', () => {
    expect(run(INITIAL_WORKBENCH_PHASE, { type: 'acked', name: 'x' })).toBe(
      INITIAL_WORKBENCH_PHASE,
    );
    expect(run(redeeming, { type: 'ended', reason: 'revoked' })).toBe(redeeming);
    expect(run(binding, { type: 'renewed', session: RENEWED })).toBe(binding);
    expect(run(mounted, { type: 'acked', name: 'Again' })).toBe(mounted);
  });
});

describe('endReasonOfInvalidSession', () => {
  it('reads a refusal before the expiry as revoked, and after it as expired', () => {
    expect(endReasonOfInvalidSession(10_000, 9_999)).toBe('revoked');
    expect(endReasonOfInvalidSession(10_000, 10_000)).toBe('expired');
  });
});

describe('workbenchTransition, workspace scope', () => {
  const WORKSPACE: WorkbenchWorkspaceSessionResponse = {
    ...SESSION,
    scope: 'workspace',
    documentId: null,
    folderId: 'f1',
    tabId: null,
  };
  const redeemingWorkspace: WorkbenchPhase = {
    phase: 'redeeming',
    ticket: TICKET,
    scope: 'workspace',
    documentId: null,
  };

  it('reads a workspace address into redeeming', () => {
    expect(
      run(INITIAL_WORKBENCH_PHASE, {
        type: 'read',
        ticket: TICKET,
        scope: 'workspace',
        documentId: null,
      }),
    ).toEqual(redeemingWorkspace);
  });

  it('binds a workspace session on the workspace page', () => {
    expect(run(redeemingWorkspace, { type: 'redeemed', session: WORKSPACE })).toEqual({
      phase: 'binding',
      session: WORKSPACE,
    });
  });

  it('refuses a session whose scope is not the address page’s, both ways', () => {
    expect(run(redeemingWorkspace, { type: 'redeemed', session: SESSION })).toEqual({
      phase: 'refused',
      cause: 'mismatch',
    });
    expect(run(redeeming, { type: 'redeemed', session: WORKSPACE })).toEqual({
      phase: 'refused',
      cause: 'mismatch',
    });
  });

  it('renews a workspace session with another of the same scope and origin only', () => {
    const on: WorkbenchPhase = { phase: 'mounted', session: WORKSPACE, name: 'Acme Editor' };
    const next = { ...WORKSPACE, session: `lvw_${'c'.repeat(43)}.${'0f'.repeat(32)}` };

    expect(run(on, { type: 'renewed', session: next })).toEqual({ ...on, session: next });
    expect(run(on, { type: 'renewed', session: SESSION })).toEqual(on);
    expect(
      run(on, { type: 'renewed', session: { ...next, origin: 'https://other.example' } }),
    ).toEqual(on);
  });
});
