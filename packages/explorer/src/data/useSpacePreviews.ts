'use client';

// What Home's Spaces tiles show of each space (the index's `GET /spaces/previews`, liveworkspace/docs/specs/004-index/
// one-explorer.md "Spaces, on Home"): every space's newest items and how many it holds, in one request for them all.
// Asked again for a new filter, a re-read of the lists (the epoch), a change to the person's teams, or Try again; a
// superseded read is cancelled rather than left to land late. A re-read in the same filter keeps the tiles it has
// until it lands, so a rename elsewhere never flashes them back to placeholders.

import { useCallback, useEffect, useState } from 'react';
import type { App, IndexClient, SpacePreview } from '@liveworkspace/index-client';
import { isAbort } from './errors';

export type SpacePreviews = {
  // Each space's preview by its team (null for My Work), or null until answered.
  byTeam: ReadonlyMap<string | null, SpacePreview> | null;
  // Nothing to show yet for this filter.
  loading: boolean;
  error: boolean;
  retry: () => void;
};

type Answer = {
  key: string;
  app: App | null;
  byTeam: Map<string | null, SpacePreview> | null;
  error: boolean;
};

export function useSpacePreviews({
  client,
  app,
  epoch,
  teamsKey,
}: {
  client: IndexClient;
  // The app shown (its items only), or null for every app's.
  app: App | null;
  epoch: number;
  // The person's teams, as one string: a team made, joined or left asks again.
  teamsKey: string;
}): SpacePreviews {
  const [tries, setTries] = useState(0);
  const key = `${app ?? '*'}|${epoch}|${teamsKey}|${tries}`;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // A host's client without the call answers as a failed read, never a crash.
    Promise.resolve()
      .then(() => client.spacePreviews(app ? { app } : {}, { signal: controller.signal }))
      .then((answered) => {
        // An answer with no spaces list (a body that is not JSON reads as null: a local stack whose router
        // answers the path with a page) is a failed read like a refusal, never a throw.
        const spaces = (answered as { spaces?: unknown } | null | undefined)?.spaces;
        if (!Array.isArray(spaces)) throw new Error('No space previews in the answer');
        return spaces as SpacePreview[];
      })
      .then(
        (spaces) =>
          setAnswer({
            key,
            app,
            byTeam: new Map(spaces.map((s) => [s.teamId, s])),
            error: false,
          }),
        (e: unknown) => {
          if (!isAbort(e)) setAnswer({ key, app, byTeam: null, error: true });
        },
      );
    return () => controller.abort();
  }, [client, app, key]);

  const retry = useCallback(() => setTries((n) => n + 1), []);
  const answered = answer?.key === key;
  // The last answer for this filter while its re-read is out; a failure shows only once it is the latest word.
  const byTeam = answer && answer.app === app ? answer.byTeam : null;
  const error = answered && answer.error;
  return { byTeam, loading: byTeam === null && !error, error, retry };
}
