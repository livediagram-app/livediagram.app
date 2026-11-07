'use client';

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  communitySearchMine,
  setCommunitySearchMine,
  type CommunityApp,
} from '@liveworkspace/community';
import { communityKeyStorage } from '@liveworkspace/community/paths';
import { COMMUNITY_APP_WORDS, type CommunityWords } from '@liveworkspace/community-ui/words';
import { CommunityHelpLink as HelpLinkLook } from '@liveworkspace/community-ui/help-link';
import { COMMUNITY_HELP } from '@liveworkspace/help-registry/community';
import { siteOfApp } from '@liveworkspace/sites';
import type { AppScope } from '@liveworkspace/ui';
import { communityTelemetry } from '@/lib/community/telemetry';
import { appOrigin, pageApp } from '@/lib/explorer/page-app';
import { CommunitySiteProvider, type CommunityHelpLinkProps, type CommunitySite } from './client';
import { communityAppOf, communityLinks } from './lib/links';
import { readQueryState, writeQueryState } from './lib/query-state';
import { replaceSearch } from './lib/url-search';

// The Community page's binding, worked out from where the page is (liveworkspace/docs/specs/007-community/
// community.md "One page for every app"; liveworkspace/docs/specs/010-site/site.md "The Community"). On an app's
// address (its router serves this page there, @/lib/explorer/page-app) the page is that app's: its posts first, with
// All Apps a click away, its words, its routes, its session and its telemetry. On liveworkspace.app it shows every
// app's posts and offers no switch. Which one is known only in the browser, so while the page is prerendered and
// hydrating `ready` is false: nothing loads and the words that depend on it hold their space unseen.

// Every app's posts together, in the platform's words.
export const ALL_APPS_WORDS: CommunityWords = {
  product: 'liveworkspace',
  noun: 'creation',
  nouns: 'creations',
  showcase: 'creation',
  showcases: 'creations',
};

// The help centre the links open: the page's app's (relative, on its address), else livediagram's, whose articles
// say the same for every app.
const HELP_FALLBACK = siteOfApp('livediagram').url;

function makeHelpLink(onApp: boolean): (props: CommunityHelpLinkProps) => ReactNode {
  return function CommunityHelp({ article, ...look }: CommunityHelpLinkProps) {
    const href = `${onApp ? '' : HELP_FALLBACK}${COMMUNITY_HELP[article].href}`;
    return (
      <HelpLinkLook href={href} onOpen={() => communityTelemetry.openedHelp(article)} {...look} />
    );
  };
}
const AppHelpLink = makeHelpLink(true);
const WorkspaceHelpLink = makeHelpLink(false);

/** Takes My Shares out of the address's search: All Apps has no My Shares (it is one app's, on its address). */
function leaveMine() {
  const params = new URLSearchParams(window.location.search);
  if (!communitySearchMine(params.get('q') ?? '')) return;
  const filters = readQueryState(params);
  replaceSearch(writeQueryState({ ...filters, q: setCommunitySearchMine(filters.q, false) }));
}

const noChange = () => () => {};
const notYet = () => undefined;

export function CommunityBinding({ children }: { children: ReactNode }) {
  // Undefined until the page knows where it is (prerendered, then the first render as it hydrates).
  const host = useSyncExternalStore(noChange, pageApp, notYet);
  const ready = host !== undefined;
  const app: CommunityApp | null = host ? communityAppOf(host) : null;
  // The switch's own choice, on an app's address; it starts on the app, as the Explorer's does.
  const [choice, setChoice] = useState<AppScope>('app');
  const set = useCallback((next: AppScope) => {
    if (next === 'all') leaveMine();
    setChoice(next);
  }, []);

  const site = useMemo<CommunitySite>(() => {
    const scope = app && choice === 'app' ? app : 'all';
    return {
      pageApp: app,
      ready,
      scope,
      scopeControl: app ? { value: choice, set } : null,
      words: scope === 'all' ? ALL_APPS_WORDS : COMMUNITY_APP_WORDS[scope],
      communityApi: process.env.NEXT_PUBLIC_COMMUNITY_API,
      // The app's own key on its origin (the one its Community app kept, so likes carry over); liveworkspace's here.
      keyStorage: communityKeyStorage(host ?? 'liveworkspace'),
      links: communityLinks(app, appOrigin),
      telemetry: communityTelemetry,
      HelpLink: app ? AppHelpLink : WorkspaceHelpLink,
    };
  }, [app, choice, host, ready, set]);

  return <CommunitySiteProvider site={site}>{children}</CommunitySiteProvider>;
}
