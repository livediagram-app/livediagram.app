'use client';

// The page menu's Require Reading (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): a page that is
// not Required Reading shows nothing of it (owner 2026-11-23: "require reading should be in the page context menu
// until enabled, not always shown"), so its setup opens here, in a centred modal, once the menu asks for it
// (askReading). It waits for the page's state, then offers the setup as the page stands: Require Reading, or Save and
// Stop Requiring on a page that turned out to be required already. Saving or putting it away ends the ask.
import { lazy, Suspense, useEffect } from 'react';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useKnowledgePeople } from '@/components/knowledge/usePageKnowledge';
import { clearReadingAsk, useReadingAsked } from '@/lib/required-reading/reading-asked';
import { useRequiredReading } from './useRequiredReading';

// The setup is an Editor's, opened by a press: its own chunk (the rail's panel's), so a reader never loads it.
const ReadingSetupModal = lazy(() =>
  import('./ReadingSetupPanel').then((m) => ({ default: m.ReadingSetupModal })),
);

export function RequiredReadingAsk() {
  const pageId = useEditorChrome((s) => s.activeId);
  const asked = useReadingAsked(pageId);
  return asked ? <ReadingAskOpen key={pageId} /> : null;
}

function ReadingAskOpen() {
  const reading = useRequiredReading();
  const { people } = useKnowledgePeople();
  const { status, reading: state } = reading.entry;
  // Nothing to set up here (no room, a failed read, or the api says this person may not): the ask ends quietly.
  const refused = status === 'failed' || (status === 'ready' && (!reading.shown || !state.manages));
  useEffect(() => {
    if (refused) clearReadingAsk();
  }, [refused]);
  if (!reading.shown || !state.manages) return null;
  return (
    <Suspense fallback={null}>
      <ReadingSetupModal
        onClose={clearReadingAsk}
        audience={state.required?.audience ?? null}
        chosen={state.chosen ?? []}
        people={people}
        busy={reading.busy === 'set'}
        onSave={(change) => void reading.set(change).then((saved) => saved && clearReadingAsk())}
      />
    </Suspense>
  );
}
