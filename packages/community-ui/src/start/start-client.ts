import {
  communityServiceUrl,
  type CommunityApp,
  type CommunityStartResponse,
} from '@liveworkspace/community';
import { fetchCommunityEnabled } from '../tile/useCommunityEnabled';

// Start With's Community tiles (liveworkspace/docs/specs/007-community/community.md "Start With"): one read per app
// (`GET /start?app=`), asked the first time a template picker opens, never on page load, and kept for the rest of the
// session, so every later open, in any tab or mode, draws them at once. It never fails: switched off (the app's
// COMMUNITY_ENABLED, or the service's own, which answers 404), unreachable or answering nonsense, it is no tiles.

/** Each category's tiles, best first; a category with none is absent. */
export type CommunityStartPosts = CommunityStartResponse['categories'];

export type CommunityStartSource = {
  app: CommunityApp;
  // The Community service the build names (NEXT_PUBLIC_COMMUNITY_API); unset means production's.
  communityApi?: string | undefined;
  // The app's own api, whose capabilities say whether its Community is on (default `/api`).
  apiBase?: string | undefined;
};

const NONE: CommunityStartPosts = Object.freeze({});
const answers = new Map<string, Promise<CommunityStartPosts>>();
// The answers that have arrived, so a picker opened again draws its tiles on its first frame.
const arrived = new Map<string, CommunityStartPosts>();

const startUrl = ({ app, communityApi }: CommunityStartSource) =>
  communityServiceUrl(app, '/start', { base: communityApi });

async function load(url: string, apiBase: string | undefined): Promise<CommunityStartPosts> {
  // Both at once: the capabilities answer is usually cached already (the editor asks it for its own Community
  // controls), and the tiles should not wait a round trip behind it.
  const [enabled, res] = await Promise.all([fetchCommunityEnabled(apiBase), fetch(url)]);
  // Switched off (the app's switch, or the service's own 404): no tiles for the session. Any other refusal is asked
  // again the next time a picker opens.
  if (!enabled || res.status === 404) return NONE;
  if (!res.ok) throw new Error(`start tiles answered ${res.status}`);
  const body = (await res.json()) as Partial<CommunityStartResponse> | null;
  const categories = body?.categories;
  return categories && typeof categories === 'object' && !Array.isArray(categories)
    ? categories
    : NONE;
}

/** The app's Start With tiles, once per session. A failure is no tiles, and is asked again next time. */
export function fetchCommunityStart(source: CommunityStartSource): Promise<CommunityStartPosts> {
  const url = startUrl(source);
  let answer = answers.get(url);
  if (!answer) {
    answer = load(url, source.apiBase).then(
      (posts) => {
        arrived.set(url, posts);
        return posts;
      },
      (err: unknown) => {
        console.warn('[community] start tiles unavailable', err);
        answers.delete(url);
        return NONE;
      },
    );
    answers.set(url, answer);
  }
  return answer;
}

/** The session's answer, if it has arrived. */
export function communityStartInHand(
  source: CommunityStartSource,
): CommunityStartPosts | undefined {
  return arrived.get(startUrl(source));
}

// Tests only: forget the session's answers.
export function resetCommunityStartForTests(): void {
  answers.clear();
  arrived.clear();
}
