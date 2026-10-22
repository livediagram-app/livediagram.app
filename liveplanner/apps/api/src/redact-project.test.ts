// A project's ownerId is a credential, not a label — for a guest owner it IS
// the X-Owner-Id bearer value, and /api/migrate will move that owner's entire
// workspace to whoever presents it. So "who gets to see it" is a security
// rule, and it gets a suite of its own rather than living inside one route's.
import { describe, expect, it } from 'vitest';
import { redactProjectForReader, redactProjectForScope } from './redact-project';
import type { ProjectDTO } from './types';

// A guest-owned project: the owner id is the UUID that identifies that
// browser, which is exactly the value that must not travel.
const GUEST_OWNER = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const liveDoc = {
  id: 'd1',
  ownerId: GUEST_OWNER,
  name: 'Plan',
  shareCode: 'EDITCODE',
} as ProjectDTO;

describe('redactProjectForReader', () => {
  it('hands the owner their own id back untouched', () => {
    // Same object, not a copy: the owner path is the hot one (every editor
    // load) and there is nothing to rewrite.
    expect(redactProjectForReader(liveDoc, GUEST_OWNER)).toBe(liveDoc);
  });

  it('blanks it for a share-link visitor', () => {
    const out = redactProjectForReader(liveDoc, 'some-other-guest');
    expect(out.ownerId).toBe('');
    // Everything else survives — the visitor still needs the project.
    expect(out.id).toBe('d1');
    expect(out.name).toBe('Plan');
  });

  // The primary share code is the project's OLDEST link, of any role. Handing
  // it to a view-link visitor handed them an edit link.
  it('withholds the primary share code from a share-link visitor', () => {
    expect(redactProjectForReader(liveDoc, 'some-other-guest').shareCode).toBeNull();
    expect(redactProjectForReader(liveDoc, null).shareCode).toBeNull();
  });

  it('hands the owner their primary share code', () => {
    expect(redactProjectForReader(liveDoc, GUEST_OWNER).shareCode).toBe('EDITCODE');
  });

  it('blanks it for an unidentified caller', () => {
    expect(redactProjectForReader(liveDoc, null).ownerId).toBe('');
  });

  it('never mutates the row it was handed', () => {
    redactProjectForReader(liveDoc, null);
    expect(liveDoc.ownerId).toBe(GUEST_OWNER);
  });

  it('does not let an empty caller match an empty ownerId', () => {
    // Belt and braces on the `caller &&` guard: an already-blank row must not
    // read as "this caller is the owner" for a caller with no identity, which
    // a bare `caller === ownerId` would.
    const blanked = { ...liveDoc, ownerId: '' } as ProjectDTO;
    expect(redactProjectForReader(blanked, '').ownerId).toBe('');
    expect(redactProjectForReader(blanked, null).ownerId).toBe('');
  });

  it('blanks a string that is merely similar', () => {
    expect(redactProjectForReader(liveDoc, `${GUEST_OWNER} `).ownerId).toBe('');
    expect(redactProjectForReader(liveDoc, GUEST_OWNER.toUpperCase()).ownerId).toBe('');
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md. A scoped visitor's copy of the project keeps every
// tab in place, so the bar can draw a "Not shared" pill for it, but nothing about a
// tab outside their scope beyond its id and position.
describe('redactProjectForScope', () => {
  const tabs = [
    { id: 't1', projectId: 'd1', name: 'Pricing', orderIndex: 0, updatedAt: 5, folder: 'Money' },
    { id: 't2', projectId: 'd1', name: 'Roadmap', orderIndex: 1, updatedAt: 6 },
  ];
  const full = { ...liveDoc, tabs } as ProjectDTO;

  it('marks every tab outside the scope out of scope, keeping only id and position', () => {
    const out = redactProjectForScope(full, 't2');
    expect(out.tabs[0]).toEqual({
      id: 't1',
      projectId: 'd1',
      name: '',
      orderIndex: 0,
      updatedAt: 0,
      outOfScope: true,
    });
  });

  it('leaves the scoped tab as it is', () => {
    expect(redactProjectForScope(full, 't2').tabs[1]).toEqual(tabs[1]);
  });

  it('hands an unscoped reader the project untouched', () => {
    expect(redactProjectForScope(full, null)).toBe(full);
  });
});
