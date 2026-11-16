// A public roadmap's page talking to the api (docs/specs/026-plan/public-roadmap.md "How it answers"): plain fetches,
// no identity and no editor modules, so the page stays small. Every failure comes back as a value the page can say.
import type { PublicRoadmap, RoadmapVoteResponse } from '@liveplanner/api-schema';
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';

const roadmapUrl = (planId: string, code: string, door = '') =>
  `${API_BASE}/roadmaps/${encodeURIComponent(planId)}/${encodeURIComponent(code)}${door ? `/${door}` : ''}`;

export type RoadmapLoad =
  { kind: 'ok'; data: PublicRoadmap } | { kind: 'not_found' } | { kind: 'error' };

export async function loadPublicRoadmap(
  planId: string,
  code: string,
  browser: string,
  fetcher: typeof fetch = fetch,
): Promise<RoadmapLoad> {
  try {
    const res = await fetcher(
      `${roadmapUrl(planId, code)}?browser=${encodeURIComponent(browser)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', data: (await res.json()) as PublicRoadmap };
  } catch {
    return { kind: 'error' };
  }
}

export type VoteResult =
  | { kind: 'ok'; votes: number; voted: boolean }
  // The roadmap or the card went (unpublished, moved out of a shown column, voting turned off).
  | { kind: 'gone' }
  | { kind: 'full' }
  | { kind: 'busy' }
  | { kind: 'failed' };

export async function sendRoadmapVote(
  planId: string,
  code: string,
  body: { card: string; browser: string; up: boolean },
  fetcher: typeof fetch = fetch,
): Promise<VoteResult> {
  try {
    const res = await fetcher(roadmapUrl(planId, code, 'votes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The hidden field a person never fills (public-roadmap.md "Upvotes").
      body: JSON.stringify({ ...body, website: '' }),
    });
    if (res.ok) {
      const answer = (await res.json()) as RoadmapVoteResponse;
      return { kind: 'ok', votes: answer.votes, voted: answer.voted };
    }
    if (res.status === 404) return { kind: 'gone' };
    if (res.status === 409) return { kind: 'full' };
    if (res.status === 429) return { kind: 'busy' };
    return { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}
