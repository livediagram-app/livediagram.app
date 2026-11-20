'use client';

// The Knowledgebase Home (docs/specs/030-knowledgebase/knowledgebase-home.md): the start of liveknowledge for a
// signed-in person, in place of the forked start. Someone not signed in is sent where the start sent everyone: /new,
// which makes a knowledgebase kept Offline for a guest, so the editor still works with no account.
import { useEffect, useMemo, useState } from 'react';
import { Callout } from '@liveworkspace/ui/callout';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { recentQuestionsEverywhere } from '@/lib/knowledge-ask/recent-questions';
import { handArrival } from '@/lib/knowledge-home/arrival-handoff';
import { firstNameOf, recentPagesAcross } from '@/lib/knowledge-home/home-data';
import {
  BLANK_KNOWLEDGEBASE_HREF,
  NEW_KNOWLEDGEBASE_HREF,
  askHref,
  knowledgebaseHref,
} from '@/lib/knowledge-home/home-links';
import { useRelativeNow } from '@/lib/relative-time';
import { looksSignedIn } from '@/lib/signed-in-hint';
import { track } from '@/lib/telemetry';
import { HomeHero, type HomeExample } from './HomeHero';
import {
  HomeFirstKnowledgebase,
  HomeKnowledgebases,
  HomeRecent,
  HomeReview,
  HomeStartTiles,
} from './HomeSections';
import { useStillRight } from './useStillRight';
import { useHomeData } from './useHomeData';
import { useHomeSearch } from './useHomeSearch';

/** Example questions shown under the field. */
const HOME_EXAMPLES = 3;
// Still Right hides its row at once (useStillRight), so no row is ever seen busy.
const NOT_VERIFYING: ReadonlySet<string> = new Set();

const go = (href: string) => window.location.assign(href);

/**
 * Whether nobody is signed in, settled: the session itself said so, or the page gave up waiting for it (`authLoaded`
 * without `sessionAnswered`, the bootstrap's 5 s give-up) in a browser that does not look signed in. A browser that
 * looks signed in waits for its session's own answer, as /new does (useNewDocumentLocation): on a cold first load
 * the session's code can arrive after the give-up, and reading that as signed out sent a signed-in person to /new.
 */
export function homeSignedOut(state: {
  authLoaded: boolean;
  sessionAnswered: boolean;
  signedIn: boolean;
  looksSignedIn: boolean;
}): boolean {
  if (state.signedIn || !state.authLoaded) return false;
  return state.sessionAnswered || !state.looksSignedIn;
}

export function HomeScreen() {
  const { authLoaded, sessionAnswered, accountUserId, accountDisplayName } = useAccountBootstrap();
  const signedOut = homeSignedOut({
    authLoaded,
    sessionAnswered,
    signedIn: !!accountUserId,
    // Read only for the one case it decides: the give-up, with no session answer yet.
    looksSignedIn: authLoaded && !sessionAnswered && !accountUserId && looksSignedIn(),
  });
  useEffect(() => {
    if (signedOut) window.location.replace(`${NEW_KNOWLEDGEBASE_HREF}${window.location.search}`);
  }, [signedOut]);
  useEffect(() => {
    document.title = 'Home | liveknowledge';
  }, []);
  // The same opening screen the editor shows, until who is here is known.
  if (!authLoaded || !accountUserId) return <OpeningScreen />;
  return <SignedInHome ownerId={accountUserId} name={accountDisplayName} />;
}

function SignedInHome({ ownerId, name }: { ownerId: string; name: string | null }) {
  const data = useHomeData(ownerId);
  const now = useRelativeNow();
  const [words, setWords] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const { knowledgebases, summaries } = data;
  // Ask goes to the knowledgebase chosen, else the most recent one.
  const scope =
    (chosen && knowledgebases.some((k) => k.id === chosen) ? chosen : knowledgebases[0]?.id) ??
    null;
  const search = useHomeSearch(ownerId, knowledgebases, words);
  const recent = useMemo(
    () => recentPagesAcross(knowledgebases, summaries),
    [knowledgebases, summaries],
  );
  // The person's own recent questions, for the knowledgebases still listed; none on a first visit.
  const [examples] = useState<readonly HomeExample[]>(() => {
    try {
      return recentQuestionsEverywhere(localStorage, ownerId, 12);
    } catch {
      return [];
    }
  });
  const shownExamples = examples
    .filter((example) => knowledgebases.some((k) => k.id === example.documentId))
    .slice(0, HOME_EXAMPLES);

  const ask = (documentId: string, question: string) => {
    track('UI', 'Used', 'HomeAsk');
    handArrival({ kind: 'ask', documentId, question });
    go(askHref(documentId));
  };
  const openImport = () => {
    track('UI', 'Opened', 'HomeImport');
    handArrival({ kind: 'import', documentId: scope });
    go(scope ? knowledgebaseHref(scope) : BLANK_KNOWLEDGEBASE_HREF);
  };

  // Yours to Review: the person's own due pages, from the summaries Home already reads (useStillRight).
  const review = useStillRight({ ownerId, knowledgebases, summaries, refresh: data.refresh });

  const loading = data.status === 'loading';
  const none = data.status === 'ready' && knowledgebases.length === 0;
  const summariesPending = knowledgebases.some(
    (k) => !summaries.has(k.id) && !data.summaryFailed.has(k.id),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <EditorHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6" data-home="">
        <HomeHero
          firstName={firstNameOf(name)}
          knowledgebases={knowledgebases}
          ready={data.status === 'ready'}
          scope={scope}
          onScope={setChosen}
          words={words}
          onWords={setWords}
          search={search}
          examples={shownExamples}
          onAsk={ask}
        />
        {data.status === 'failed' ? (
          <Callout
            tone="error"
            size="md"
            role="alert"
            title="Your Knowledgebases Could Not Be Read"
            action={{ label: 'Try Again', onSelect: data.retry }}
          >
            Check your connection. Nothing is lost.
          </Callout>
        ) : none ? (
          <HomeFirstKnowledgebase onImport={openImport} />
        ) : (
          <>
            <HomeKnowledgebases
              loading={loading}
              knowledgebases={knowledgebases}
              total={data.total}
              summaries={summaries}
              summaryFailed={data.summaryFailed}
            />
            <HomeReview
              rows={review.rows}
              now={now}
              verifying={NOT_VERIFYING}
              onStillRight={review.stillRight}
            />
            <HomeRecent
              loading={loading || (recent.length === 0 && summariesPending)}
              pages={recent}
              now={now}
            />
            <HomeStartTiles onImport={openImport} />
          </>
        )}
      </main>
    </div>
  );
}
