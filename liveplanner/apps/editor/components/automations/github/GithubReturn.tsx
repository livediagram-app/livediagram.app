'use client';

// Back from GitHub (docs/specs/026-plan/automations.md "The GitHub view"): `#github=…`, where Connect GitHub comes
// back, opens the Automations screen at the GitHub view, or at the rule kept for the round trip, and says how it
// went. Read before anything rewrites the address, then dropped from it (for anyone: a Viewer who followed the link
// gets a clean address and no screen). Drawn inside the Automations host, above the editor.

import { useEffect, useRef, useState } from 'react';
import { useAutomationsAccess } from '@liveworkspace/automations-ui/AutomationsContext';
import { useToast } from '@/hooks/ui/useToast';
import {
  dropGithubHash,
  githubResultOf,
  GITHUB_RULE_WORDS,
  takeGithubDraft,
  trackGithubResult,
  type GithubResult,
  type KeptRule,
} from './github-hash';

export function GithubReturn() {
  const access = useAutomationsAccess();
  const toast = useToast();
  const [github, setGithub] = useState<GithubResult | null>(() =>
    githubResultOf(window.location.hash),
  );
  useEffect(() => {
    dropGithubHash();
  }, []);
  const draftRef = useRef<KeptRule | null | undefined>(undefined);
  // The screen at the GitHub view (or the rule kept), once the plan's Editor scope is known.
  useEffect(() => {
    if (!github || !access) return;
    // oxlint-disable-next-line react/set-state-in-effect -- a one-shot return from GitHub, taken once the Editor scope arrives
    setGithub(null);
    trackGithubResult(github);
    // Taken once per mount: an effect run again (React's Strict Mode in development) must find the same rule, not
    // the empty slot the first run left.
    if (draftRef.current === undefined) draftRef.current = takeGithubDraft(access.scope.itemId);
    const draft = draftRef.current;
    if (draft) {
      // Back at the rule kept for the round trip: say how it went, once.
      if (github === 'connected') toast.success(GITHUB_RULE_WORDS.connected);
      else toast.error(GITHUB_RULE_WORDS[github]);
      access.open({
        view: 'rule',
        ruleId: null,
        kept: { ruleId: null, body: draft.body, picks: draft.picks, part: null },
      });
    } else access.open({ view: 'view', id: 'github', arrival: github });
  }, [github, access, toast]);
  return null;
}
