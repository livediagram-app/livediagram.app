// A livediagram host for the repository link's suites: libraries with folders and teams, documents whose tabs move
// on, the overview as the api renders it, and documents that can be trashed, purged, or fail. Over `fakeIo`.

import type { VerbContext } from '@livediagram/agent-verbs';
import type { Element } from '@livediagram/document';
import { headerFactsOf, overviewView } from '@livediagram/document-views';
import { transport } from '../transport';
import { NOW, TOKEN, type FakeIo, type Route } from './fake-io';

export const HOST = 'https://livediagram.app';

export type HostTab = {
  id: string;
  name: string;
  rev: number;
  elements: Element[];
  kind?: 'event-storming';
  folder?: string;
  theme?: string;
};
export type HostDoc = {
  id: string;
  name: string;
  folderId: string | null;
  teamId: string | null;
  presentation: string | null;
  savedAt: number;
  tabs: HostTab[];
  // live, trashed (410), purged or another's (404), or failing with a status or the network.
  state: 'live' | 'trashed' | 'purged' | 403 | 429 | 503 | 'network';
};
export type HostFolder = {
  id: string;
  name: string;
  parentId: string | null;
  teamId: string | null;
};

export const box = (id: string, label: string, x = 0): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 120,
  height: 60,
  label,
});

export function hostDoc(id: string, name: string, over: Partial<HostDoc> = {}): HostDoc {
  return {
    id,
    name,
    folderId: null,
    teamId: null,
    presentation: null,
    savedAt: NOW - 3_600_000,
    tabs: [{ id: `${id}-t1`, name: 'Main', rev: 1, elements: [box('b1', `${name} box`)] }],
    state: 'live',
    ...over,
  };
}

const summary = (d: HostDoc) => ({
  id: d.id,
  ownerId: 'user-1',
  name: d.name,
  folderId: d.folderId,
  teamId: d.teamId,
  savedAt: d.savedAt,
});
const folderDto = (f: HostFolder) => ({ ...f, ownerId: 'user-1', createdAt: 1, updatedAt: 1 });

export type LinkHost = {
  route: Route;
  docs: HostDoc[];
  folders: HostFolder[];
  teams: { id: string; name: string }[];
  doc(id: string): HostDoc;
  // Moves a tab on: a new revision, with its elements when given.
  edit(documentId: string, tabIndex?: number, elements?: Element[]): void;
  // Every api path asked, with its query.
  asked: string[];
};

export function linkHost(
  docs: HostDoc[],
  folders: HostFolder[] = [],
  teams: { id: string; name: string }[] = [],
): LinkHost {
  const asked: string[] = [];
  const live = (d: HostDoc) => d.state !== 'trashed' && d.state !== 'purged';
  const host: LinkHost = {
    docs,
    folders,
    teams,
    asked,
    doc: (id) => docs.find((d) => d.id === id)!,
    edit: (documentId, tabIndex = 0, elements) => {
      const tab = host.doc(documentId).tabs[tabIndex]!;
      tab.rev += 1;
      if (elements) tab.elements = elements;
    },
    route: async (request, url) => {
      const path = url.pathname.replace(/^\/api/, '');
      asked.push(`${request.method} ${path}${url.search}`);
      if (path === '/capabilities')
        return Response.json({
          apiBase: `${HOST}/api`,
          authEnabled: true,
          documentFormat: 2,
        });
      if (path === '/documents')
        return Response.json({ documents: docs.filter((d) => live(d) && !d.teamId).map(summary) });
      if (path === '/folders')
        return Response.json({ folders: folders.filter((f) => !f.teamId).map(folderDto) });
      if (path === '/teams') return Response.json({ teams });
      const team = /^\/teams\/([^/]+)\/library$/.exec(path);
      if (team)
        return Response.json({
          folders: folders.filter((f) => f.teamId === team[1]).map(folderDto),
          documents: docs.filter((d) => live(d) && d.teamId === team[1]).map(summary),
        });
      const match = /^\/documents\/([^/]+)(\/.*)?$/.exec(path);
      if (!match) return undefined;
      const doc = docs.find((d) => d.id === decodeURIComponent(match[1]!));
      if (!doc || doc.state === 'purged')
        return Response.json({ error: 'not_found' }, { status: 404 });
      if (doc.state === 'trashed')
        return Response.json({ error: 'document_trashed' }, { status: 410 });
      if (doc.state === 'network') throw new TypeError('fetch failed');
      if (typeof doc.state === 'number')
        return Response.json({ error: 'busy' }, { status: doc.state });
      const rest = match[2] ?? '';
      const tabIds = doc.tabs.map((t) => t.id);
      const plain = (t: HostTab, i: number) => ({
        id: t.id,
        name: t.name,
        elements: t.elements,
        ...(t.kind ? { kind: t.kind } : {}),
        ...(t.theme ? { theme: t.theme } : {}),
        rev: t.rev,
        documentId: doc.id,
        orderIndex: i,
        updatedAt: doc.savedAt,
      });
      if (rest === '' && url.searchParams.get('view') === 'overview')
        return Response.json(
          overviewView(
            doc,
            doc.tabs.map((t, i) => ({
              id: t.id,
              outOfScope: false,
              facts: headerFactsOf(plain(t, i), { rev: t.rev, tabIds }),
            })),
            { now: NOW },
          ).json,
        );
      if (rest === '')
        return Response.json({
          document: {
            ...summary(doc),
            presentation: doc.presentation,
            tabs: doc.tabs.map((t, i) => ({
              id: t.id,
              documentId: doc.id,
              name: t.name,
              orderIndex: i,
              updatedAt: doc.savedAt,
              ...(t.folder ? { folder: t.folder } : {}),
            })),
          },
        });
      if (rest === '/room-ticket') return Response.json({ ticket: `ticket-${doc.id}` });
      const tab = /^\/tabs\/([^/]+)$/.exec(rest);
      const index = doc.tabs.findIndex((t) => t.id === tab?.[1]);
      if (index < 0) return Response.json({ error: 'not_found' }, { status: 404 });
      const t = doc.tabs[index]!;
      return new Response(JSON.stringify({ tab: plain(t, index) }), {
        headers: { ETag: `W/"${t.rev}"` },
      });
    },
  };
  return host;
}

// A command's context over the fake io, signed in, as `main` builds it.
export function linkContext(io: FakeIo, log: (line: string) => void = () => {}): VerbContext {
  const http = transport(io, `${HOST}/api`, () => {});
  return {
    api: http.forToken(TOKEN),
    host: HOST,
    useShareCode: http.useShareCode,
    log,
    notice: (line) => io.stderr(`${line}\n`),
    now: io.now,
    newId: () => crypto.randomUUID(),
    sleep: io.sleep,
    readInput: async () => '',
    copies: null,
  };
}
