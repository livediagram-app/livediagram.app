'use client';

import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { CommunityApp, CommunityPostInput, CommunityOwnPost } from '@liveworkspace/community';
import { Dialog as DialogShell, type DialogProps } from '@liveworkspace/ui';

// What the Share dialog's Community tab needs from where it opens (liveworkspace/docs/specs/007-community/community.md
// "The Share dialog's Community tab"): an app's editor, its Explorer, or the Explorer on liveworkspace.app. The tab's
// pieces read it from context, so each host binds it once and the pieces stay the same everywhere.

/** The product's words, as the tab says them ("Sign in to share your canvas with the Community."). */
export type CommunityWords = {
  // The product's name ("livediagram").
  product: string;
  // One document, and several, in lowercase ("canvas", "canvases").
  noun: string;
  nouns: string;
  // What people show in its gallery, in the guide's heading and first line ("board", "boards").
  showcase: string;
  showcases: string;
  // The part whose content is the card's picture, which must not be empty ("first tab", the default; livedocuments'
  // "first page").
  cover?: string;
};

/** The owner's side of a document's post, through the document's own app (`/api/<items>/<id>/community`). Each call
 *  throws on a refusal; an error carrying `status` and `code` (the app's ApiError) is worded by its code. */
export type CommunityOwnerClient = {
  get: () => Promise<CommunityOwnPost | null>;
  publish: (input: CommunityPostInput) => Promise<CommunityOwnPost>;
  remove: () => Promise<void>;
  // The most used tags in the app's Community, offered while tagging; any failure is no suggestions.
  popularTags: () => Promise<string[]>;
};

export type CommunityNotify = (text: string, tone: 'success' | 'error' | 'info') => void;

/** The tab's telemetry (`Community·Shared|Changed·<Category>`, `Community·Removed·Post`). */
export type CommunityTrack = (action: 'Shared' | 'Changed' | 'Removed', type: string) => void;

export type CommunityShareHost = {
  app: CommunityApp;
  words: CommunityWords;
  // The owner's side of the document's post, through its own app.
  client: CommunityOwnerClient;
  // A post's page in the app's gallery (`/community/post/?id=`), absolute where the host is another site.
  postHref: (postId: string) => string;
  // How the tab says what happened (the host's toasts); the Share dialog's own note when absent.
  notify?: CommunityNotify;
  track?: CommunityTrack;
  // The app's help link on sharing to the Community, at a dialog header's size or a section label's.
  helpLink?: (opts: { size?: 'sm' | 'md'; className?: string }) => ReactNode;
  // The card preview's picture before a post exists (the editor's snapshot of the first tab); absent, the dot grid.
  thumbnail?: ReactNode;
  // The dialog shell (the editor's registers with its modal guard); the shared one by default.
  Dialog?: ComponentType<DialogProps>;
  // The Share dialog's section label, so the Community section reads as one of its own (the Share dialog sets it).
  sectionLabelClass?: string;
};

type BoundHost = CommunityShareHost & { notify: CommunityNotify };

const HostContext = createContext<BoundHost | null>(null);

const SILENT: CommunityNotify = () => {};

export function CommunityShareHostProvider({
  host,
  children,
}: {
  host: CommunityShareHost;
  children: ReactNode;
}) {
  const bound = useMemo(() => ({ ...host, notify: host.notify ?? SILENT }), [host]);
  return <HostContext.Provider value={bound}>{children}</HostContext.Provider>;
}

export function useCommunityShareHost(): BoundHost {
  const host = useContext(HostContext);
  if (!host) throw new Error('[community-ui] the Community tab needs a CommunityShareHostProvider');
  return host;
}

export const DefaultDialog = DialogShell;
