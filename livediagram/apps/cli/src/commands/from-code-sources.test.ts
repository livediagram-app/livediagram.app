// A link file's infrastructure `[[sources]]` (docs/specs/027-repositories/diagram-sources.md "Infrastructure sources in
// the link file"): each entry checked, every bound tab updated from its files relative to the link, a refusal named
// and carried past.

import { describe, expect, it } from 'vitest';
import { layoutGraph, type Tab } from '@livediagram/document';
import { drawnRecord, infraGraph, sourceFiles } from '@livediagram/document/infra-code';
import { run } from '../main';
import type { LinkFile } from '../link/link-file';
import { capabilities, fakeIo, NOW, TOKEN, type Route } from '../testing/fake-io';
import { linkSourcesOf } from './from-code-sources';

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const WRANGLER = 'name = "api"\n[[kv_namespaces]]\nbinding = "CACHE"\nid = "k1"\n';

const link = (sources: Record<string, unknown>[]): LinkFile => ({
  path: '/work/livediagram.toml',
  root: '/work',
  host: null,
  covers: { folder: null, documents: [DOC] },
  mirror: { level: 'none', dir: 'diagrams' },
  hooks: { block: false },
  sources,
});

describe('linkSourcesOf', () => {
  it('reads the infrastructure entries and leaves other bridges unread', () => {
    expect(
      linkSourcesOf(
        link([
          { files: ['./infra/main.tf', 'wrangler.toml'], tab: `${DOC}/t1`, env: 'staging' },
          { path: 'docs/arch.excalidraw', tab: `${DOC}/t2` },
        ]),
      ),
    ).toEqual([{ files: ['infra/main.tf', 'wrangler.toml'], doc: DOC, tab: 't1', env: 'staging' }]);
  });

  it.each([
    [{ files: ['a.tf'], tab: `${DOC}/t1`, dir: 'x' }, 'unknown key "sources[0].dir"'],
    [{ files: [], tab: `${DOC}/t1` }, 'sources[0].files must be a non-empty array of strings'],
    [
      { files: ['../other/a.tf'], tab: `${DOC}/t1` },
      'sources[0].files holds "../other/a.tf", outside /work',
    ],
    [{ files: ['/etc/a.tf'], tab: `${DOC}/t1` }, 'outside /work'],
    [{ files: ['a.tf'], tab: DOC }, 'sources[0].tab must be <document>/<tab>'],
    [{ files: ['a.tf'], tab: `${DOC}/t1`, env: 1 }, 'sources[0].env must be a string'],
  ])('refuses %j', (entry, message) => {
    expect(() => linkSourcesOf(link([entry]))).toThrow(message);
  });
});

describe('link from-code in a link with [[sources]]', () => {
  // A tab drawn from the link's wrangler.toml, and one that no file drew.
  function api() {
    const files = [{ name: 'wrangler.toml', text: WRANGLER }];
    const result = infraGraph(files);
    if (!result.ok) throw new Error(result.error.message);
    const drawn = layoutGraph(result.graph);
    const tabs: Record<string, Tab> = {
      'tab-one-0000': {
        id: 'tab-one-0000',
        name: 'Infra',
        elements: drawn,
        sources: {
          bridge: 'infra',
          files: sourceFiles(files),
          readAt: 1,
          ...drawnRecord(drawn, result.graph),
        },
      },
      'tab-two-0000': { id: 'tab-two-0000', name: 'Notes', elements: [] },
    };
    const sent: string[] = [];
    const route: Route = async (request, url) => {
      if (url.pathname === `/api/documents/${DOC}`)
        return Response.json({
          document: {
            id: DOC,
            name: 'Shop',
            savedAt: NOW,
            tabs: Object.values(tabs).map(({ id, name }) => ({ id, name })),
          },
        });
      const tab = /\/tabs\/(tab-\w+-0000)$/.exec(url.pathname)?.[1];
      if (request.method === 'GET' && tab)
        return new Response(JSON.stringify({ tab: tabs[tab] }), { headers: { ETag: 'W/"3"' } });
      if (url.pathname.endsWith('/changesets')) {
        sent.push(url.pathname);
        return Response.json({
          dryRun: false,
          changeset: { id: 'cs_5', tabId: 't1', rev: 4, previousRev: 3, rebasedOver: 0 },
          results: [],
          text: 'rev 3→4 · cs_5',
          warnings: [],
          lint: null,
        });
      }
      return undefined;
    };
    return { sent, route };
  }

  const linkFile = (entries: string) =>
    `[covers]\ndocuments = ["${DOC}"]\n\n[mirror]\nlevel = "none"\n${entries}`;

  async function cli(route: Route, files: Record<string, string>, cwd = '/work/apps') {
    const io = fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [capabilities, route], files });
    Object.assign(io, { cwd });
    const code = await run(['link', 'from-code'], io);
    return { code, out: io.out(), err: io.err() };
  }

  it('updates each bound tab from its files, read relative to the link file', async () => {
    const { sent, route } = api();
    const { code, out, err } = await cli(route, {
      '/work/livediagram.toml': linkFile(
        `\n[[sources]]\nfiles = ["wrangler.toml"]\ntab = "${DOC}/tab-one-0000"\n`,
      ),
      '/work/wrangler.toml': `${WRANGLER}[[d1_databases]]\nbinding = "DB"\ndatabase_name = "main"\n`,
      '/work/apps/keep.txt': '',
    });
    expect(code).toBe(0);
    expect(err).toContain(`${DOC}/tab-one-0000:\n`);
    expect(err).toContain('updated: added 1 box');
    expect(out).toContain('rev 3→4 · cs_5');
    expect(sent).toEqual([`/api/documents/${DOC}/tabs/tab-one-0000/changesets`]);
  });

  it('carries on past a tab no file drew, and exits with its refusal', async () => {
    const { sent, route } = api();
    const { code, err } = await cli(route, {
      '/work/livediagram.toml': linkFile(
        `\n[[sources]]\nfiles = ["wrangler.toml"]\ntab = "${DOC}/tab-two-0000"\n\n[[sources]]\nfiles = ["wrangler.toml"]\ntab = "${DOC}/tab-one-0000"\n`,
      ),
      '/work/wrangler.toml': WRANGLER,
      '/work/apps/keep.txt': '',
    });
    expect(code).toBe(1);
    expect(err).toContain('tab "Notes" was not drawn from files');
    expect(err).toContain('1 of 2 sources in /work/livediagram.toml were not updated');
    expect(sent).toEqual([`/api/documents/${DOC}/tabs/tab-one-0000/changesets`]);
  });
});
