import { describe, expect, it } from 'vitest';
import type { ChangeLogEntryDTO } from './types';
import { parseChangeLogEntryBody } from './change-log-body';

// Every audit-log row POSTed by the live editor passes through
// parseChangeLogEntryBody. A regression that quietly accepts a
// missing field would write a malformed row to the change_log
// table, and the downstream readers (ActivityPanel, Revert) have
// no way to tell at render time whether a missing summary is a
// genuine edge case or a corrupted insert.
//
// The body is `Partial<ChangeLogEntryDTO>` because it's the raw
// JSON-parsed request body, but the parser's job is to confirm
// every required field is present + well-shaped and return the
// fully-typed DTO (or null on failure). The cases below pin each
// required-field rejection AND the success path's coalescing
// defaults (tabId, beforeState, afterState, createdAt).

function validBody(): Partial<ChangeLogEntryDTO> {
  return {
    id: 'entry-1',
    tabId: 'tab-1',
    participantId: 'p-1',
    participantName: 'Alex',
    participantColor: '#10b981',
    kind: 'edit',
    summary: 'Moved a shape',
    elementIds: ['el-1', 'el-2'],
    beforeState: { 'el-1': { x: 0 } },
    afterState: { 'el-1': { x: 10 } },
    createdAt: 1_700_000_000_000,
  };
}

describe('parseChangeLogEntryBody (happy path)', () => {
  it('returns a fully-typed entry when every required field is well-shaped', () => {
    const parsed = parseChangeLogEntryBody(validBody());
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      id: 'entry-1',
      tabId: 'tab-1',
      participantId: 'p-1',
      participantName: 'Alex',
      participantColor: '#10b981',
      kind: 'edit',
      summary: 'Moved a shape',
      elementIds: ['el-1', 'el-2'],
      beforeState: { 'el-1': { x: 0 } },
      afterState: { 'el-1': { x: 10 } },
      createdAt: 1_700_000_000_000,
    });
  });

  it('defaults tabId to null when the body omits it', () => {
    // Tab-meta entries (theme change, lock toggle) don't carry a
    // tabId on POST. They're nullable in the DTO and the parser
    // must coalesce undefined to null, not preserve undefined
    // (D1 would reject the bind otherwise).
    const body = validBody();
    delete body.tabId;
    const parsed = parseChangeLogEntryBody(body);
    expect(parsed?.tabId).toBeNull();
  });

  it('uses the supplied `now` for createdAt when the body omits it', () => {
    const body = validBody();
    delete body.createdAt;
    const parsed = parseChangeLogEntryBody(body, 9_999);
    expect(parsed?.createdAt).toBe(9_999);
  });

  it('preserves a client-supplied createdAt verbatim', () => {
    // The editor stamps Date.now() on the client side so multi-
    // peer ordering matches the user's perceived clock. The
    // parser must not overwrite it with the server's `now`.
    const parsed = parseChangeLogEntryBody(validBody(), 9_999);
    expect(parsed?.createdAt).toBe(1_700_000_000_000);
  });
});

describe('parseChangeLogEntryBody (rejections)', () => {
  // Each required field rejection is asserted independently so a
  // future change that drops one of the checks (e.g. "let's allow
  // entries without a kind") fails this test directly rather than
  // surfacing as a corrupted row in production.
  const requiredStringFields = [
    'id',
    'participantId',
    'participantName',
    'participantColor',
    'kind',
    'summary',
  ] as const;

  it.each(requiredStringFields)('rejects when `%s` is missing', (field) => {
    const body = validBody();
    delete (body as Record<string, unknown>)[field];
    expect(parseChangeLogEntryBody(body)).toBeNull();
  });

  it.each(requiredStringFields)('rejects when `%s` is the empty string', (field) => {
    // Truthy guard rejects '' along with undefined. The empty-id
    // case is the load-bearing one: a downstream insert with
    // id='' would create a PK conflict on the second empty entry.
    const body = validBody();
    (body as Record<string, unknown>)[field] = '';
    expect(parseChangeLogEntryBody(body)).toBeNull();
  });

  it('rejects when elementIds is missing', () => {
    const body = validBody();
    delete body.elementIds;
    expect(parseChangeLogEntryBody(body)).toBeNull();
  });

  it('rejects when elementIds is not an array (string)', () => {
    // Defends against a client serialising elementIds as a CSV
    // string accidentally. Array.isArray is the only path through.
    const body = validBody();
    (body as Record<string, unknown>).elementIds = 'el-1,el-2';
    expect(parseChangeLogEntryBody(body)).toBeNull();
  });

  it('accepts an empty elementIds array (tab-meta entries have no element ids)', () => {
    // Empty array is valid: tab-meta entries (rename, lock,
    // theme change) carry zero element ids. The truthy / length
    // tests above must NOT reject the empty case.
    const body = validBody();
    body.elementIds = [];
    expect(parseChangeLogEntryBody(body)).not.toBeNull();
  });

  it('rejects when beforeState is a string', () => {
    const body = validBody();
    (body as Record<string, unknown>).beforeState = 'oops';
    expect(parseChangeLogEntryBody(body)).toBeNull();
  });

  it('rejects when afterState is a string', () => {
    const body = validBody();
    (body as Record<string, unknown>).afterState = 'oops';
    expect(parseChangeLogEntryBody(body)).toBeNull();
  });

  it('accepts null beforeState/afterState (typeof null === "object", coalesced to {} on the way out)', () => {
    // Documents the existing behaviour: `typeof null === 'object'`
    // is true in JS, so a null state passes the typeof guard. The
    // parser then coalesces it to `{}` via the nullish-coalescing
    // operator. Preserves the prior inline route-handler behaviour
    // bit-for-bit; tightening to reject null would be a behaviour
    // change worth its own commit.
    const body = validBody();
    (body as Record<string, unknown>).beforeState = null;
    (body as Record<string, unknown>).afterState = null;
    const parsed = parseChangeLogEntryBody(body);
    expect(parsed).not.toBeNull();
    expect(parsed?.beforeState).toEqual({});
    expect(parsed?.afterState).toEqual({});
  });
});
