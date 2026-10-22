// The last-admin rule in the member list (docs/specs/013-workspace/teams.md): only JOINED admins
// count, as on the server. Counting an invited admin let the only joined admin see Leave and
// Demote, which the api then refused with 409 last_admin.
import { describe, expect, it } from 'vitest';
import type { TeamMember } from '@/lib/api-client';
import { lastAdminPinner } from './team-last-admin';

const member = (id: string, role: 'admin' | 'member', status: 'joined' | 'invited') =>
  ({ id, role, status }) as TeamMember;

describe('lastAdminPinner', () => {
  it('pins the only joined admin even when an invited admin is pending', () => {
    const joined = member('a', 'admin', 'joined');
    const invited = member('b', 'admin', 'invited');
    const pinned = lastAdminPinner([joined, invited]);
    expect(pinned(joined)).toBe(true);
    expect(pinned(invited)).toBe(false);
  });

  it('pins nobody while two admins have joined', () => {
    const a = member('a', 'admin', 'joined');
    const b = member('b', 'admin', 'joined');
    const pinned = lastAdminPinner([a, b]);
    expect(pinned(a)).toBe(false);
    expect(pinned(b)).toBe(false);
  });

  it('never pins a member', () => {
    const m = member('m', 'member', 'joined');
    expect(lastAdminPinner([m])(m)).toBe(false);
  });
});
