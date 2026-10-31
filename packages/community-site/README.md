# @liveworkspace/community-site

Every app's Community pages: the gallery (`/community/`), a post's page (`/community/post/?id=`) and the small
Worker in front of them. An app's `apps/community` is a thin shell on it, as each help centre is on
`@liveworkspace/help-site`. What every app's Community is, and what a binding names, is in
[liveworkspace/docs/specs/007-community](../../liveworkspace/docs/specs/007-community/community.md) ("Shared pieces",
"An app's Community pages").

## Binding an app

The shell keeps its layout (head, boot scripts, header, footer), its routes and its metadata, and binds the pages once:

```tsx
// apps/community/lib/community-site.tsx
'use client';
import { CommunitySiteProvider, type CommunitySite } from '@liveworkspace/community-site/client';

const SITE: CommunitySite = { app, words, apiBase, communityApi, keyStorage, signedInHint, links, telemetry, HelpLink };
export function CommunityProvider({ children }) {
  return <CommunitySiteProvider site={SITE}>{children}</CommunitySiteProvider>;
}
```

- `app/layout.tsx` wraps its `<main>` in `CommunityProvider` and `CommunityGate` (from `./gate`).
- `app/page.tsx` renders `CommunityGalleryPage`; `app/post/page.tsx` renders `CommunityPostPage` under its own metadata
  (no canonical: one shell serves every post).
- `worker/index.ts` exports `createCommunityWorker({ app, siteUrl, product })` as its default, and nothing else.
- `app/globals.css` imports `@liveworkspace/community-site/community.css` after Tailwind, and scans
  `packages/community-site/src` (not its tests) and community-ui's `tile` and `help-link`.

Functions cannot cross from a server component to a client one, so the binding lives in the shell's own client module.
Each page is its own entry, so a route loads only its page. The telemetry stays the app's own (its `siteTrack` calls), so its dashboard's emitter scan still reads it.

## Entries

| Entry            | What                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `./client`       | `CommunitySite` and its parts, `CommunitySiteProvider`, `useCommunitySite`               |
| `./gate`         | `CommunityGate`: nothing while the app's Community is switched off                       |
| `./gallery`      | `CommunityGalleryPage`                                                                   |
| `./post`         | `CommunityPostPage`                                                                      |
| `./worker`       | `createCommunityWorker`, `CommunityWorkerSite`, `CommunityWorkerEnv`                     |
| `./community.css`| The gallery's hero wash and the heart's pop                                              |
| `./testing`      | `communityTestSite`, `withCommunitySite`, `quietCommunityTelemetry`, for an app's tests  |
