'use client';

// The Share dialog's Team Members list (one-explorer-contracts.md "Sharing and access"): who in the item's team can
// open it. The host reads the team (the Explorer from accounts, an editor through its app's api); the dialog asks
// once, when the Team tab first shows, and keeps the joined members.

import { useEffect, useRef, useState } from 'react';
import type { TeamRole } from '../../data/teams';
import { memberName } from '../../teams/rules';

export type ShareTeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: TeamRole;
  picture?: string | null;
  color?: string | null;
  // The reader's own row.
  self: boolean;
};

/** A member as a host's team read answers (the Explorer's from accounts, an editor's from its app's api). `self`
 *  marks the reader's own row where the host knows it; else the dialog matches `userId` to its `viewerUserId`. */
export type ShareTeamRead = Omit<ShareTeamMember, 'self'> & {
  status: string;
  userId?: string | null;
  self?: boolean;
};

/** A team read's joined members (an invitation opens nothing yet), admins first and then by name, the reader's own
 *  row marked. */
export function shareTeamMembers(
  members: readonly ShareTeamRead[],
  viewerUserId: string | null = null,
): ShareTeamMember[] {
  return members
    .filter((m) => m.status === 'joined')
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      picture: m.picture ?? null,
      color: m.color ?? null,
      self: m.self ?? (viewerUserId !== null && m.userId === viewerUserId),
    }))
    .sort(
      (a, b) =>
        Number(b.role === 'admin') - Number(a.role === 'admin') ||
        memberName(a, a.self).localeCompare(memberName(b, b.self)),
    );
}

export type ShareTeamMembersLoad =
  // No read (the host has none, or it failed): the list is left out.
  { state: 'none' } | { state: 'loading' } | { state: 'found'; members: ShareTeamMember[] };

/** The team's members, read once when `show` first turns true. */
export function useShareTeamMembers(
  load: (() => Promise<readonly ShareTeamRead[]>) | undefined,
  show: boolean,
  viewerUserId: string | null = null,
): ShareTeamMembersLoad {
  const [result, setResult] = useState<ShareTeamMembersLoad>({ state: 'none' });
  const loader = useRef(load);
  loader.current = load;
  const viewer = useRef(viewerUserId);
  viewer.current = viewerUserId;
  const wanted = show && Boolean(load);
  const asked = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    // Set on every mount: React's development double mount runs the cleanup once before the read answers.
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (!wanted || asked.current) return;
    asked.current = true;
    setResult({ state: 'loading' });
    loader
      .current?.()
      .then(
        (members) =>
          live.current &&
          setResult({ state: 'found', members: shareTeamMembers(members, viewer.current) }),
      )
      .catch(() => live.current && setResult({ state: 'none' }));
  }, [wanted]);
  return result;
}
