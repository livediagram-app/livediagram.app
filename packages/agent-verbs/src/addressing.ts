// How a command names a document and a tab (docs/specs/015-api/blueprints/cli.md "Addressing"): a pasted URL,
// a full id, an id prefix or a name; a tab by name or id prefix, the first by default. None or several refuse
// with the nearest names or the candidates, never a guess.

import type { ApiClient } from '@livediagram/api-client';
import { listAllDocuments, type FoundDocument } from './find-documents';
import { REF_MIN_PREFIX, shortestUniquePrefixes } from './refs';

export type AddressCandidate = { ref: string; name: string; detail: string };

export type AddressFailure = {
  kind: 'not-found' | 'ambiguous' | 'usage';
  what: 'document' | 'tab';
  input: string;
  candidates: AddressCandidate[];
  message: string;
  hint: string;
};

export class AddressError extends Error {
  readonly failure: AddressFailure;
  constructor(failure: AddressFailure) {
    super(failure.message);
    this.name = 'AddressError';
    this.failure = failure;
  }
}

const refuse = (failure: AddressFailure) => new AddressError(failure);

// A debug line naming how an address resolved (blueprint "Observability": `address <what> <how> <n> matches`).
export type AddressLog = (line: string) => void;

const silent: AddressLog = () => {};

export type DocumentUrl = { id: string } | { shareCode: string };

// A full document id: a UUID. Matched by shape, not length alone, so a 36-character name still
// resolves by name.
const FULL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A pasted livediagram URL: `/document/<id>` or a share link `/document/shared?s=<code>`; null when the input
// is not a URL. A URL on another origin than the host is a usage error (CLI21).
export function parseDocumentUrl(input: string, host: string): DocumentUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const hostOrigin = new URL(host).origin;
  const sameSite = (a: string, b: string) =>
    a.replace('://www.', '://') === b.replace('://www.', '://');
  if (!sameSite(url.origin, hostOrigin))
    throw refuse({
      kind: 'usage',
      what: 'document',
      input,
      candidates: [],
      message: `${url.origin} is not the host this profile uses (${hostOrigin})`,
      hint: `--host ${url.origin}`,
    });
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'document' || !parts[1])
    throw refuse({
      kind: 'usage',
      what: 'document',
      input,
      candidates: [],
      message: `${input} is not a document link`,
      hint: 'livediagram document ls',
    });
  if (parts[1] === 'shared') {
    const code = url.searchParams.get('s');
    if (!code)
      throw refuse({
        kind: 'usage',
        what: 'document',
        input,
        candidates: [],
        message: `${input} has no share code`,
        hint: 'livediagram document ls',
      });
    return { shareCode: code };
  }
  return { id: decodeURIComponent(parts[1]) };
}

export type ResolvedDocument = { id: string; name: string; shareCode?: string };

const nearest = (all: readonly FoundDocument[], input: string) => {
  const q = input.toLowerCase();
  return all
    .filter((d) => d.name.toLowerCase().includes(q) || q.includes(d.name.toLowerCase()))
    .slice(0, 5);
};

export async function resolveDocument(
  api: ApiClient,
  input: string,
  host: string,
  log: AddressLog = silent,
): Promise<ResolvedDocument> {
  const url = parseDocumentUrl(input, host);
  if (url && 'shareCode' in url) {
    log('address document url 1 matches');
    const shared = await api.json<{ document: { id: string; name: string } }>(
      `/share/${encodeURIComponent(url.shareCode)}`,
    );
    return { id: shared.document.id, name: shared.document.name, shareCode: url.shareCode };
  }
  const id = url?.id ?? (FULL_ID.test(input) ? input : null);
  if (id) {
    log(`address document ${url ? 'url' : 'exact'} 1 matches`);
    const { document } = await api.json<{ document: { id: string; name: string } }>(
      `/documents/${encodeURIComponent(id)}`,
    );
    return { id: document.id, name: document.name };
  }
  const all = await listAllDocuments(api);
  const lower = input.toLowerCase();
  const matches = all.filter(
    (d) =>
      (input.length >= REF_MIN_PREFIX && d.id.startsWith(input)) || d.name.toLowerCase() === lower,
  );
  // Every address is tried as a name; `prefix` only when an id prefix is what matched.
  const how = matches.some((d) => d.name.toLowerCase() !== lower) ? 'prefix' : 'name';
  log(`address document ${how} ${matches.length} matches`);
  const refs = shortestUniquePrefixes(all.map((d) => d.id));
  const candidate = (d: FoundDocument) => ({
    ref: refs.get(d.id)!,
    name: d.name,
    detail: d.library,
  });
  if (matches.length === 1) return { id: matches[0]!.id, name: matches[0]!.name };
  if (matches.length === 0)
    throw refuse({
      kind: 'not-found',
      what: 'document',
      input,
      candidates: nearest(all, input).map(candidate),
      message: `no document matches "${input}"`,
      hint: 'livediagram document ls',
    });
  const listed = matches.map(candidate);
  throw refuse({
    kind: 'ambiguous',
    what: 'document',
    input,
    candidates: listed,
    message: `"${input}" matches ${matches.length} documents`,
    hint: listed[0]!.ref,
  });
}

// A tab as a document lists it; `folder` is its folder in this document, when it is in one.
export type TabSummary = { id: string; name: string; orderIndex: number; folder?: string };

// A tab by name (ignoring case) or id prefix; the first tab by order when none is named.
export function resolveTab(
  tabs: readonly TabSummary[],
  input: string | undefined,
  doc: string,
  log: AddressLog = silent,
): TabSummary {
  const ordered = [...tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const refs = shortestUniquePrefixes(ordered.map((t) => t.id));
  const candidates = ordered.map((t) => ({
    ref: refs.get(t.id)!,
    name: t.name,
    detail: `tab ${ordered.indexOf(t) + 1}`,
  }));
  if (input === undefined) {
    log(`address tab first ${ordered.length ? 1 : 0} matches`);
    if (ordered[0]) return ordered[0];
    throw refuse({
      kind: 'not-found',
      what: 'tab',
      input: '',
      candidates: [],
      message: `${doc} has no tabs`,
      hint: `livediagram tab add ${doc} <name>`,
    });
  }
  const lower = input.toLowerCase();
  const matches = ordered.filter(
    (t) =>
      t.name.toLowerCase() === lower || (input.length >= REF_MIN_PREFIX && t.id.startsWith(input)),
  );
  log(
    `address tab ${matches.some((t) => t.name.toLowerCase() !== lower) ? 'prefix' : 'name'} ${matches.length} matches`,
  );
  if (matches.length === 1) return matches[0]!;
  const kind = matches.length === 0 ? 'not-found' : 'ambiguous';
  const message =
    matches.length === 0
      ? `no tab matches "${input}"`
      : `"${input}" matches ${matches.length} tabs`;
  throw refuse({
    kind,
    what: 'tab',
    input,
    candidates,
    message,
    hint: `livediagram tab ls ${doc}`,
  });
}
