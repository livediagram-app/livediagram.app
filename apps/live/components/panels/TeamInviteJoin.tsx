'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeamInviteLinkInfo } from '@livediagram/api-schema';
import { Brand } from '@livediagram/ui';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { clerkEnabled } from '@/lib/clerk-config';
import { ensureGuestSelfId } from '@/lib/local-identity';
import { track } from '@/lib/telemetry';
import { apiJoinTeamByInviteLink, apiResolveTeamInviteLink } from '@/lib/api-client';

// Landing for a shareable team invite link (spec/32), served at the
// top-level `/join?token=<token>` route (outside the Explorer chrome so
// it works the same for signed-out visitors). It resolves the token to
// a team, then offers Join / Decline to a signed-in user, or a "sign in
// to join" path that returns here afterwards.

type Resolved = 'loading' | 'invalid' | TeamInviteLinkInfo;

const teamHref = (teamId: string) => `/explorer/team?id=${encodeURIComponent(teamId)}`;

export function TeamInviteJoin() {
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  // Read the token after mount (not in an initializer) so the static
  // export and the first client render agree — no hydration mismatch.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  const ownerId = useMemo(() => clerkUserId ?? ensureGuestSelfId(), [clerkUserId]);
  const [resolved, setResolved] = useState<Resolved>('loading');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Resolve once auth has settled (so ownerId / the bearer are stable).
  useEffect(() => {
    if (!authLoaded || token === undefined) return;
    if (!token) {
      setResolved('invalid');
      return;
    }
    let cancelled = false;
    void apiResolveTeamInviteLink(ownerId, token)
      .then((res) => {
        if (!cancelled) setResolved(res ?? 'invalid');
      })
      .catch(() => {
        if (!cancelled) setResolved('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [authLoaded, token, ownerId]);

  const join = useCallback(async () => {
    if (!token || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await apiJoinTeamByInviteLink(ownerId, token);
      if (!result) {
        setResolved('invalid');
        return;
      }
      // Same event the Accept-invite flow fires (spec/22) — a new
      // membership, just via a link instead of an email row.
      if (!result.alreadyMember) track('Team', 'Joined');
      // Land on the team so they see what they just joined.
      window.location.assign(teamHref(result.teamId));
    } catch {
      setJoinError('Could not join. Try again.');
    } finally {
      setJoining(false);
    }
  }, [token, ownerId, joining]);

  // --- Render states ---------------------------------------------------

  if (!clerkEnabled) {
    return (
      <Card>
        <Heading>Teams aren&apos;t enabled here</Heading>
        <Body>This deployment runs without accounts, so it has no teams to join.</Body>
        <PrimaryLink href="/new">Go to the editor</PrimaryLink>
      </Card>
    );
  }

  if (!authLoaded || resolved === 'loading') {
    return (
      <Card>
        <Body>Loading the invite…</Body>
      </Card>
    );
  }

  if (resolved === 'invalid') {
    return (
      <Card>
        <Heading>This invite link isn&apos;t valid</Heading>
        <Body>It may have been turned off or expired. Ask a team admin for a fresh link.</Body>
        <PrimaryLink href="/explorer/recent">Back to your diagrams</PrimaryLink>
      </Card>
    );
  }

  const { team, memberCount, alreadyMember } = resolved;
  const orgLine = team.organisation
    ? `${team.organisation} · ${memberCount} member${memberCount === 1 ? '' : 's'}`
    : `${memberCount} member${memberCount === 1 ? '' : 's'}`;

  // Signed out: explain why an account is needed, then bounce back here
  // after auth (redirect_url carries this exact URL, token and all).
  if (!isSignedIn) {
    const back = encodeURIComponent(`/join?token=${encodeURIComponent(token!)}`);
    return (
      <Card>
        <Eyebrow>You&apos;re invited to join</Eyebrow>
        <Heading>{team.name}</Heading>
        <Body>{orgLine}</Body>
        <Body>
          Teams are tied to your account, so you&apos;ll need to sign in (or create one) to join.
          We&apos;ll bring you right back here.
        </Body>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryLink href={`/sign-in/?redirect_url=${back}`}>Sign in to join</PrimaryLink>
          <SecondaryLink href={`/get-started/?redirect_url=${back}`}>
            Create an account
          </SecondaryLink>
        </div>
      </Card>
    );
  }

  if (alreadyMember) {
    return (
      <Card>
        <Eyebrow>You&apos;re already a member of</Eyebrow>
        <Heading>{team.name}</Heading>
        <Body>{orgLine}</Body>
        <PrimaryLink href={teamHref(team.id)}>Open team</PrimaryLink>
      </Card>
    );
  }

  // Signed in, not yet a member: Join / Decline.
  return (
    <Card>
      <Eyebrow>You&apos;re invited to join</Eyebrow>
      <Heading>{team.name}</Heading>
      <Body>{orgLine}</Body>
      {joinError ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{joinError}</p>
      ) : null}
      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => void join()}
          disabled={joining}
          className="rounded-md bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join'}
        </button>
        <a
          href="/explorer/recent"
          className="rounded-md border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Decline
        </a>
      </div>
    </Card>
  );
}

// --- Small presentational pieces (one centred card) --------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-[26rem] max-w-full rounded-2xl border border-slate-200 bg-white px-8 py-9 text-center shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex justify-center">
          <Brand size="md" />
        </div>
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
      {children}
    </p>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{children}</h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="mt-5 inline-block rounded-md bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
    >
      {children}
    </a>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-block rounded-md border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </a>
  );
}
