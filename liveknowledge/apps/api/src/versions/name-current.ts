// Name This Version (docs/specs/006-document/version-history.md "Name This Version"; blueprint VH10, VH20): the one
// path the route (routes/versions.ts) and a rule's step (document-room/automations/kit-versions.ts) take. A named
// version already holding the tab's revision is renamed; otherwise the content is kept as a `manual` one in the
// snapshots' store, or in `tab_versions` when that store fails. A version named queues Version Named for the
// document's rules (docs/specs/013-workspace/automations.md), by whoever named it.
import { VERSION_NAMED_MAX, type VersionSummary } from '@liveknowledge/api-schema';
import {
  copyTabStatement,
  getVersion,
  keepNamedVersion,
  namedVersionCount,
  nameVersion,
  tabRev,
  versionAtRev,
  versionId,
} from '../db';
import type { Author } from '../changesets/write';
import { queueVersionEvent, type VersionWho } from '../document-room/automations/version-events';
import type { DocumentEnv } from '../types';

export type NameCurrentOutcome =
  | { ok: true; version: VersionSummary }
  | { ok: false; reason: 'not_found' | 'too_many_names' | 'tab_busy' };

type NameCurrentInput = {
  documentId: string;
  tabId: string;
  name: string;
  // Who names it, asked only once it is to be kept.
  author: () => Promise<Author> | Author;
  // Who the document's rules hear named it.
  who: (author: Author) => VersionWho;
};

export async function nameCurrentVersion(
  env: DocumentEnv,
  input: NameCurrentInput,
): Promise<NameCurrentOutcome> {
  const { documentId, tabId, name } = input;
  const rev = await tabRev(env, tabId);
  if (rev === null) return { ok: false, reason: 'not_found' };
  const existing = await versionAtRev(env, tabId, rev);
  if (existing?.name != null) {
    const version = await nameVersion(env, tabId, existing.id, name);
    if (!version) return { ok: false, reason: 'not_found' };
    return named(env, input, version, await input.author());
  }
  if ((await namedVersionCount(env, tabId)) >= VERSION_NAMED_MAX)
    return { ok: false, reason: 'too_many_names' };
  const author = await input.author();
  const now = Date.now();
  try {
    const kept = await keepNamedVersion(env, { tabId, name, author, now });
    if (kept === undefined) return { ok: false, reason: 'not_found' };
    // Another version took the revision between the read and the write: name it on the next try.
    if (kept === null) return { ok: false, reason: 'tab_busy' };
    console.info('[versions] kept', {
      documentId,
      tabId,
      kind: 'manual',
      rev: kept.rev,
      store: 'snapshots',
    });
    return named(env, input, kept, author);
  } catch (err) {
    console.warn('[versions] refused', { documentId, tabId, reason: 'store' }, err);
  }
  // As it was before the snapshots' store: a `manual` row of `tab_versions`, the fallback when that store cannot be
  // written (VH20).
  const id = versionId();
  await copyTabStatement(env, { id, tabId, rev, kind: 'manual', name, author, now }).run();
  const version = await getVersion(env, tabId, id);
  // The tab moved between the read and the copy: name what now holds its revision on the next try.
  if (!version) return { ok: false, reason: 'tab_busy' };
  console.info('[versions] kept', { documentId, tabId, kind: 'manual', rev });
  return named(env, input, version.summary, author);
}

function named(
  env: DocumentEnv,
  input: NameCurrentInput,
  version: VersionSummary,
  author: Author,
): NameCurrentOutcome {
  queueVersionEvent(env, 'named', {
    tab: input.tabId,
    version: version.id,
    name: version.name,
    who: input.who(author),
  });
  return { ok: true, version };
}
