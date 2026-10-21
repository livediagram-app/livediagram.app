'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TeamInviteDecline as TeamInviteDeclineInfo } from '@liveplanner/api-schema';
import { Button } from '@liveplanner/ui';
import {
  Body,
  Eyebrow,
  Heading,
  LandingCard as Card,
  PrimaryLink,
  SecondaryLink,
} from '@/components/chrome/LandingCard';
import { useUrlToken } from '@/hooks/ui/useUrlToken';
import { track } from '@/lib/telemetry';
import { apiDeclineTeamInvite, apiReadTeamInviteDecline } from '@/lib/api-client';

// The landing for a team invite email's Decline link (docs/specs/013-workspace/teams.md "Declining from the
// email"), served at `/join/decline?token=<token>` outside the Explorer chrome, signed in or not. Opening
// the page only READS the invite: mail-client link scanners and prefetchers open links on their own, so
// only the Decline Invite button sends the decline.

type Lookup = 'loading' | 'invalid' | 'already_joined' | TeamInviteDeclineInfo;

export function TeamInviteDecline() {
  const token = useUrlToken();
  const [lookup, setLookup] = useState<Lookup>('loading');
  // A link without a token is invalid without asking.
  const resolved: Lookup = token === null || token === '' ? 'invalid' : lookup;
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void apiReadTeamInviteDecline(token)
      .then((res) => {
        if (!cancelled) setLookup(res ?? 'invalid');
      })
      .catch(() => {
        if (!cancelled) setLookup('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const decline = useCallback(async () => {
    if (!token || declining) return;
    setDeclining(true);
    setError(null);
    try {
      const result = await apiDeclineTeamInvite(token);
      if (result && result !== 'already_joined' && result.status === 'declined') {
        track('Team', 'Declined', 'Email');
      }
      setLookup(result ?? 'invalid');
    } catch {
      setError('Could not decline the invite. Try again.');
    } finally {
      setDeclining(false);
    }
  }, [token, declining]);

  if (resolved === 'loading') {
    return (
      <Card>
        <Body>Loading the invite…</Body>
      </Card>
    );
  }

  if (resolved === 'invalid') {
    return (
      <Card>
        <Heading>This Invite Link Isn&apos;t Valid</Heading>
        <Body>
          The invite may have been withdrawn, or sent again with a new link. There is nothing you
          need to do.
        </Body>
        <PrimaryLink href="/">Go to liveplanner</PrimaryLink>
      </Card>
    );
  }

  if (resolved === 'already_joined' || resolved.status === 'joined') {
    const team = resolved === 'already_joined' ? 'the team' : resolved.teamName;
    return (
      <Card>
        <Heading>You&apos;re Already in {team}</Heading>
        <Body>
          This link can&apos;t undo a membership. To leave, open the team in the Explorer and choose
          Leave Team.
        </Body>
        <PrimaryLink href="/explorer">Open Explorer</PrimaryLink>
      </Card>
    );
  }

  const { teamName, status } = resolved;

  if (status === 'declined') {
    return (
      <Card>
        <Eyebrow>{teamName}</Eyebrow>
        <Heading>Invite Declined</Heading>
        <Body>
          You won&apos;t join {teamName}, and there will be no more reminders. The team&apos;s
          admins can see that you declined. If you change your mind, ask them to invite you again.
        </Body>
        <PrimaryLink href="/">Go to liveplanner</PrimaryLink>
      </Card>
    );
  }

  if (status === 'expired') {
    return (
      <Card>
        <Eyebrow>{teamName}</Eyebrow>
        <Heading>This Invite Has Expired</Heading>
        <Body>
          Nobody answered the invite within four weeks, so it closed on its own. There is nothing
          you need to do.
        </Body>
        <PrimaryLink href="/">Go to liveplanner</PrimaryLink>
      </Card>
    );
  }

  // Still pending: ask before declining.
  return (
    <Card>
      <Eyebrow>Team Invite</Eyebrow>
      <Heading>Decline the Invite to {teamName}?</Heading>
      <Body>
        You won&apos;t join the team, and the reminders stop. The team&apos;s admins will see that
        you declined. No account needed.
      </Body>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-col gap-2">
        <Button size="md" onClick={() => void decline()} disabled={declining}>
          {declining ? 'Declining…' : 'Decline Invite'}
        </Button>
        <SecondaryLink href="/explorer/invites">Accept Instead</SecondaryLink>
      </div>
      <Body>To accept, sign in with the address this invite was sent to.</Body>
    </Card>
  );
}
