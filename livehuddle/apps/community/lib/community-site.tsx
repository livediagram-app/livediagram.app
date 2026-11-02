'use client';

import type { ReactNode } from 'react';
import {
  COMMUNITY_APP,
  COMMUNITY_KEY_STORAGE,
  communityImagePath,
  documentPath,
  signedInHintOf,
} from '@livehuddle/api-schema';
import { CommunityHelpLink } from '@livehuddle/ui';
import { CommunitySiteProvider, type CommunitySite } from '@liveworkspace/community-site/client';
import { COMMUNITY_APP_WORDS } from '@liveworkspace/community-ui/words';
import { communityTelemetry } from './telemetry';

// livehuddle's binding of the Community pages (@liveworkspace/community-site; docs/specs/025-community/community.md
// "The Community app"), mounted once by the root layout. The pages are every app's; what is livehuddle's is here:
// its posts, its words, its api, its editor's routes, its signed-in hint, its telemetry and its help links.

// Where the api lives. In production the router stitches the api worker onto this hostname under `/api`, so the
// origin-relative default is right; local development points it at a `wrangler dev` (see .env.example). The api
// answers My Shares and the session, and serves each post's card image, viewer and copy.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

const shareQuery = (shareCode: string) => `s=${encodeURIComponent(shareCode)}`;

const SITE: CommunitySite = {
  app: COMMUNITY_APP,
  words: COMMUNITY_APP_WORDS[COMMUNITY_APP],
  apiBase: API_BASE,
  communityApi: process.env.NEXT_PUBLIC_COMMUNITY_API,
  keyStorage: COMMUNITY_KEY_STORAGE,
  signedInHint: signedInHintOf,
  links: {
    openDocument: (code) => `/document/shared?${shareQuery(code)}`,
    makeCopy: (code) => `/document/shared?${shareQuery(code)}&copy=1`,
    embed: (code) => `/embed?${shareQuery(code)}`,
    image: (code) => `${API_BASE}${communityImagePath(code)}`,
    editDocument: documentPath,
    // The editor's sign-in page, returning here afterwards (it reads `redirect_url`).
    signIn: (returnTo) => `/sign-in/?redirect_url=${encodeURIComponent(returnTo)}`,
    // Sharing starts from a canvas the person already has, so every invitation opens Explorer Home.
    shareYourOwn: '/explorer/home',
  },
  telemetry: communityTelemetry,
  HelpLink: CommunityHelpLink,
};

export function CommunityProvider({ children }: { children: ReactNode }) {
  return <CommunitySiteProvider site={SITE}>{children}</CommunitySiteProvider>;
}
