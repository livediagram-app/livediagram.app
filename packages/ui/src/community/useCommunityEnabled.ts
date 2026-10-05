'use client';

import { useEffect, useState } from 'react';
import type { CapabilitiesResponse } from '@livediagram/api-schema';

// Whether the Community is switched on (docs/specs/025-community/community.md "Turning the Community off"), from the
// api's capabilities. Every app asks through this one hook, so the apps menu, the footer, the landing section, the
// editor and the Community app agree, and a page makes one request however many of them ask.
//
// Only an explicit `communityEnabled: false` turns it off. Until the answer arrives, and when the api cannot be
// reached, the Community is assumed on: the switch is a deliberate act, and a hiccup must not hide the product.

const DEFAULT_API_BASE = '/api';
const answers = new Map<string, Promise<boolean>>();

export function fetchCommunityEnabled(apiBase: string = DEFAULT_API_BASE): Promise<boolean> {
  let answer = answers.get(apiBase);
  if (!answer) {
    answer = fetch(`${apiBase}/capabilities`)
      .then((res) => (res.ok ? (res.json() as Promise<CapabilitiesResponse>) : null))
      .then((caps) => caps?.communityEnabled !== false)
      .catch((err: unknown) => {
        console.warn('[community] capabilities unavailable; assuming on', err);
        return true;
      });
    answers.set(apiBase, answer);
  }
  return answer;
}

// `ask` false skips the request (and answers on): a caller that only needs the answer in some states (the editor's
// badge, while a post is listed) does not cost every page load a request.
export function useCommunityEnabled(apiBase: string = DEFAULT_API_BASE, ask = true): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    if (!ask) return;
    let live = true;
    void fetchCommunityEnabled(apiBase).then((on) => {
      if (live) setEnabled(on);
    });
    return () => {
      live = false;
    };
  }, [apiBase, ask]);
  return ask ? enabled : true;
}

// Tests only: forget cached answers.
export function resetCommunityEnabledForTests(): void {
  answers.clear();
}
