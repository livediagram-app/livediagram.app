// A diagram's ownerId is a credential, not a label — for a guest owner it IS
// the X-Owner-Id bearer value, and /api/migrate will move that owner's entire
// workspace to whoever presents it. So "who gets to see it" is a security
// rule, and it gets a suite of its own rather than living inside one route's.
import { describe, expect, it } from 'vitest';
import { redactOwnerId } from './redact-owner';
import type { DiagramDTO } from './types';

// A guest-owned diagram: the owner id is the UUID that identifies that
// browser, which is exactly the value that must not travel.
const GUEST_OWNER = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const diagram = { id: 'd1', ownerId: GUEST_OWNER, name: 'Plan' } as DiagramDTO;

describe('redactOwnerId', () => {
  it('hands the owner their own id back untouched', () => {
    // Same object, not a copy: the owner path is the hot one (every editor
    // load) and there is nothing to rewrite.
    expect(redactOwnerId(diagram, GUEST_OWNER)).toBe(diagram);
  });

  it('blanks it for a share-link visitor', () => {
    const out = redactOwnerId(diagram, 'some-other-guest');
    expect(out.ownerId).toBe('');
    // Everything else survives — the visitor still needs the diagram.
    expect(out.id).toBe('d1');
    expect(out.name).toBe('Plan');
  });

  it('blanks it for an unidentified caller', () => {
    expect(redactOwnerId(diagram, null).ownerId).toBe('');
  });

  it('never mutates the row it was handed', () => {
    redactOwnerId(diagram, null);
    expect(diagram.ownerId).toBe(GUEST_OWNER);
  });

  it('does not let an empty caller match an empty ownerId', () => {
    // Belt and braces on the `caller &&` guard: an already-blank row must not
    // read as "this caller is the owner" for a caller with no identity, which
    // a bare `caller === ownerId` would.
    const blanked = { ...diagram, ownerId: '' } as DiagramDTO;
    expect(redactOwnerId(blanked, '').ownerId).toBe('');
    expect(redactOwnerId(blanked, null).ownerId).toBe('');
  });

  it('blanks a string that is merely similar', () => {
    expect(redactOwnerId(diagram, `${GUEST_OWNER} `).ownerId).toBe('');
    expect(redactOwnerId(diagram, GUEST_OWNER.toUpperCase()).ownerId).toBe('');
  });
});
