// How a command names a file and a tab (docs/specs/015-api/blueprints/cli.md "Addressing"): a pasted URL,
// a full id, an id prefix or a name; a tab by name or id prefix, the first by default. None or several refuse
// with the nearest names or the candidates, never a guess. Each product binds it to its noun, collection, CLI and
// library sweep (its addressing.ts).

import type { ApiClient } from '@liveworkspace/api-client';
import type { FoundFile } from './find';
import { wordOf, wordsOf, type AgentProduct } from './product';
import { REF_MIN_PREFIX, shortestUniquePrefixes } from './refs';

export type AddressCandidate = { ref: string; name: string; detail: string };

export type AddressFailure<N extends string = string> = {
  kind: 'not-found' | 'ambiguous' | 'usage';
  what: N | 'tab';
  input: string;
  candidates: AddressCandidate[];
  message: string;
  hint: string;
};

// One class for every product, so a front door tells an address failure by `instanceof`; its `what` is the noun or
// `tab`.
export class AddressError extends Error {
  readonly failure: AddressFailure;
  constructor(failure: AddressFailure) {
    super(failure.message);
    this.name = 'AddressError';
    this.failure = failure;
  }
}

// A debug line naming how an address resolved (blueprint "Observability": `address <what> <how> <n> matches`).
type AddressLog = (line: string) => void;

const silent: AddressLog = () => {};

export type FileUrl = { id: string } | { shareCode: string };

export type ResolvedFile = { id: string; name: string; shareCode?: string };

// A tab as a file lists it; `folder` is its folder in this file, when it is in one.
export type TabSummary = { id: string; name: string; orderIndex: number; folder?: string };

// A full file id: a UUID. Matched by shape, not length alone, so a 36-character name still
// resolves by name.
const FULL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AddressingBinding<N extends string> = {
  product: AgentProduct<N>;
  // The product's sweep of every file the caller reaches (./find `listAllFiles`).
  listAllFiles: (api: ApiClient) => Promise<FoundFile[]>;
};

export function createAddressing<N extends string>({
  product,
  listAllFiles,
}: AddressingBinding<N>) {
  const { cli, noun, collection } = product;
  const word = wordOf(product);
  const words = wordsOf(product);
  const refuse = (failure: AddressFailure<N>) => new AddressError(failure);

  // A pasted URL of the product: `/<noun>/<id>` or a share link `/<noun>/shared?s=<code>`; null when the input
  // is not a URL. A URL on another origin than the host is a usage error (CLI21).
  function parseFileUrl(input: string, host: string): FileUrl | null {
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
        what: noun,
        input,
        candidates: [],
        message: `${url.origin} is not the host this profile uses (${hostOrigin})`,
        hint: `--host ${url.origin}`,
      });
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== noun || !parts[1])
      throw refuse({
        kind: 'usage',
        what: noun,
        input,
        candidates: [],
        message: `${input} is not a ${word} link`,
        hint: `${cli} ${noun} ls`,
      });
    if (parts[1] === 'shared') {
      const code = url.searchParams.get('s');
      if (!code)
        throw refuse({
          kind: 'usage',
          what: noun,
          input,
          candidates: [],
          message: `${input} has no share code`,
          hint: `${cli} ${noun} ls`,
        });
      return { shareCode: code };
    }
    // A pasted link with a broken escape (`%E0`) is not a link to anything, said as every other bad link is,
    // never a bare URIError the front doors can't word.
    let id: string;
    try {
      id = decodeURIComponent(parts[1]);
    } catch {
      throw refuse({
        kind: 'usage',
        what: noun,
        input,
        candidates: [],
        message: `${input} is not a ${word} link`,
        hint: `${cli} ${noun} ls`,
      });
    }
    return { id };
  }

  const nearest = (all: readonly FoundFile[], input: string) => {
    const q = input.toLowerCase();
    return all
      .filter((d) => d.name.toLowerCase().includes(q) || q.includes(d.name.toLowerCase()))
      .slice(0, 5);
  };

  async function resolveFile(
    api: ApiClient,
    input: string,
    host: string,
    log: AddressLog = silent,
  ): Promise<ResolvedFile> {
    const url = parseFileUrl(input, host);
    if (url && 'shareCode' in url) {
      log(`address ${noun} url 1 matches`);
      const shared = await api.json<Record<N, { id: string; name: string }>>(
        `/share/${encodeURIComponent(url.shareCode)}`,
      );
      return { id: shared[noun].id, name: shared[noun].name, shareCode: url.shareCode };
    }
    const id = url?.id ?? (FULL_ID.test(input) ? input : null);
    if (id) {
      log(`address ${noun} ${url ? 'url' : 'exact'} 1 matches`);
      const file = (
        await api.json<Record<N, { id: string; name: string }>>(
          `/${collection}/${encodeURIComponent(id)}`,
        )
      )[noun];
      return { id: file.id, name: file.name };
    }
    const all = await listAllFiles(api);
    const lower = input.toLowerCase();
    const matches = all.filter(
      (d) =>
        (input.length >= REF_MIN_PREFIX && d.id.startsWith(input)) ||
        d.name.toLowerCase() === lower,
    );
    // Every address is tried as a name; `prefix` only when an id prefix is what matched.
    const how = matches.some((d) => d.name.toLowerCase() !== lower) ? 'prefix' : 'name';
    log(`address ${noun} ${how} ${matches.length} matches`);
    const refs = shortestUniquePrefixes(all.map((d) => d.id));
    const candidate = (d: FoundFile) => ({
      ref: refs.get(d.id)!,
      name: d.name,
      detail: d.library,
    });
    if (matches.length === 1) return { id: matches[0]!.id, name: matches[0]!.name };
    if (matches.length === 0)
      throw refuse({
        kind: 'not-found',
        what: noun,
        input,
        candidates: nearest(all, input).map(candidate),
        message: `no ${word} matches "${input}"`,
        hint: `${cli} ${noun} ls`,
      });
    const listed = matches.map(candidate);
    throw refuse({
      kind: 'ambiguous',
      what: noun,
      input,
      candidates: listed,
      message: `"${input}" matches ${matches.length} ${words}`,
      hint: listed[0]!.ref,
    });
  }

  // A tab by name (ignoring case) or id prefix; the first tab by order when none is named.
  function resolveTab(
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
        hint: `${cli} tab add ${doc} <name>`,
      });
    }
    const lower = input.toLowerCase();
    const matches = ordered.filter(
      (t) =>
        t.name.toLowerCase() === lower ||
        (input.length >= REF_MIN_PREFIX && t.id.startsWith(input)),
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
      hint: `${cli} tab ls ${doc}`,
    });
  }

  return { parseFileUrl, resolveFile, resolveTab };
}
