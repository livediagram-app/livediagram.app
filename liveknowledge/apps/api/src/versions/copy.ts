// Make a Copy (docs/specs/006-document/version-history.md "Make a Copy"; blueprint VH17): a new tab after the
// document's last, holding a version's content, written as a changeset that creates a tab so everyone sees it arrive.
// The tab the version came from is untouched.

import { nextOrderIndex } from '@liveworkspace/api-kit/tab-order';
import {
  LIVE_ELEMENT_FIELDS,
  migrateIncomingTab,
  type Element,
  type Tab,
} from '@liveknowledge/document';
import { COPY_SUMMARY, type VersionCopyResponse } from '@liveknowledge/api-schema';
import { lastChangesetRev, type StoredVersion } from '../db';
import { capStoredName } from '../names';
import type { DocumentDTO, DocumentEnv } from '../types';
import { writeChangeset, type Author } from '../changesets/write';
import { parseVersionBody } from './restore-tab';

export type CopyResult =
  | { status: 201; body: VersionCopyResponse }
  | { status: 404; body: { error: 'not_found'; message: string } }
  | { status: 409; body: { error: 'tab_busy'; message: string } }
  | { status: 413; body: { error: 'tab_too_large'; message: string } };

export async function copyVersion(args: {
  env: DocumentEnv;
  document: DocumentDTO;
  version: StoredVersion;
  // The name the editor sends ("Pitch (14 Nov)"); absent, "<tab name> (copy)".
  name: string | null;
  author: Author;
  tokenId: string | null;
  tokenName?: string | null;
}): Promise<CopyResult> {
  const { env, document, version } = args;
  const body = parseVersionBody(version.data);
  if (!body) {
    console.warn('[versions] refused', {
      documentId: document.id,
      versionId: version.summary.id,
      reason: 'unreadable',
    });
    return {
      status: 404,
      body: { error: 'not_found', message: 'That version can no longer be read.' },
    };
  }
  const id = crypto.randomUUID();
  const name = capStoredName(args.name?.trim() || `${version.tabName} (copy)`, null, 'tab');
  const { locked: _locked, ...content } = body;
  // The content, not the conversation: the comment threads and actions stay on the tab they were left on.
  const elements = content.elements.map((element) => {
    const copy: Record<string, unknown> = { ...element };
    for (const field of LIVE_ELEMENT_FIELDS) delete copy[field];
    return copy as Element;
  });
  const next = migrateIncomingTab({ ...content, elements, id, name }) as Tab;
  const outcome = await writeChangeset(env, {
    documentId: document.id,
    tabId: id,
    stored: null,
    next,
    orderIndex: nextOrderIndex(document.tabs),
    author: args.author,
    tokenId: args.tokenId,
    tokenName: args.tokenName ?? null,
    summary: COPY_SUMMARY,
    baseRev: null,
    rebasedOver: 0,
    prevRev: await lastChangesetRev(env, id),
    results: [],
    textFor: () => COPY_SUMMARY,
    revertOf: null,
  });
  if (outcome.kind === 'too_large') {
    return {
      status: 413,
      body: { error: 'tab_too_large', message: 'That version no longer fits a tab.' },
    };
  }
  // A fresh id cannot have been made in between; a lost create is a busy document.
  if (outcome.kind !== 'written') {
    return {
      status: 409,
      body: { error: 'tab_busy', message: 'The document kept changing; try again.' },
    };
  }
  console.info('[versions] copied', {
    documentId: document.id,
    versionId: version.summary.id,
    tabId: id,
    changesetId: outcome.written.id,
  });
  return { status: 201, body: { tab: { id, name, rev: outcome.written.rev } } };
}
