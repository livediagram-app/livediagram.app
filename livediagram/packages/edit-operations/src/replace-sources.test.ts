// A replace's sources record (docs/specs/027-repositories/diagram-sources.md "Writing the record"): worked out from a
// graph, taken from an elements body, cleared by a replace without one, and refused whole when it does not read.
import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { INFRA_SOURCES_MAX_STORED_CHARS } from '@livediagram/document/infra-code';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, refused } from './fixtures/outcomes';
import { applyReplace } from './replace';
import type { ReplaceBody, ReplaceOptions } from './types';

const graph = {
  nodes: [
    { id: 'api', label: 'api' },
    { id: 'db', label: 'db' },
  ],
  edges: [{ from: 'api', to: 'db' }],
};
const files = [
  { name: 'wrangler.toml', format: 'wrangler', hash: '0a1b2c3d', text: 'name = "api"' },
];
const options: ReplaceOptions = { tabId: 'infra', name: 'Infra', makeId: fixedIds(), now: 42 };

describe('a replace with sources', () => {
  it('works out what each node and edge became from the graph it draws', () => {
    const { tab } = applied(
      applyReplace(
        null,
        { graph },
        { ...options, sources: { bridge: 'infra', files, env: 'staging' } },
      ),
    );
    const arrow = tab.elements.find((el) => el.type === 'arrow')!;
    expect(tab.sources).toEqual({
      bridge: 'infra',
      files,
      env: 'staging',
      readAt: 42,
      nodes: { api: { el: 'api', label: 'api' }, db: { el: 'db', label: 'db' } },
      edges: { 'api>db': arrow.id },
    });
  });

  it('takes nodes and edges from an elements body, stamping the time', () => {
    const before = checkoutFlow();
    const nodes = { cart: { el: before.elements[0]!.id, label: 'Cart' } };
    const { tab } = applied(
      applyReplace(
        before,
        { elements: before.elements, layout: 'preserve' },
        { ...options, sources: { bridge: 'infra', files, nodes, edges: {} } },
      ),
    );
    expect(tab.sources).toEqual({ bridge: 'infra', files, readAt: 42, nodes, edges: {} });
  });

  it('stamps the time it was written by default, and keeps a file remembered by its fingerprint alone', () => {
    const bare = [{ name: 'main.tf', format: 'terraform', hash: '0a1b2c3d' }];
    const { now: _now, ...untimed } = options;
    const { tab } = applied(
      applyReplace(null, { graph }, { ...untimed, sources: { bridge: 'infra', files: bare } }),
    );
    expect(tab.sources).toMatchObject({ files: bare, readAt: expect.any(Number) });
  });

  it('leaves a replaced tab without the record it had when the replace brings none', () => {
    const before: Tab = {
      ...checkoutFlow(),
      sources: { bridge: 'infra', files, readAt: 1, nodes: {}, edges: {} },
    };
    const { tab } = applied(applyReplace(before, { graph }, options));
    expect(tab).not.toHaveProperty('sources');
  });

  it.each([
    ['not an object', 'files', { graph }],
    ['nodes with a graph', { bridge: 'infra', files, nodes: {}, edges: {} }, { graph }],
    ['no nodes with elements', { bridge: 'infra', files }, { elements: [] }],
    ['Mermaid', { bridge: 'infra', files }, { mermaid: 'flowchart LR\n a --> b' }],
    ['another bridge', { bridge: 'mermaid', files }, { graph }],
    ['an env that is not text', { bridge: 'infra', files, env: 3 }, { graph }],
    [
      'a file without its fingerprint',
      { bridge: 'infra', files: [{ name: 'a', format: 'x' }] },
      { graph },
    ],
    [
      'nodes that are not a table',
      { bridge: 'infra', files, nodes: 'x', edges: {} },
      { elements: [] },
    ],
    [
      'a node without its element',
      { bridge: 'infra', files, nodes: { a: { label: 'A' } }, edges: {} },
      { elements: [] },
    ],
    [
      'texts past the cap',
      {
        bridge: 'infra',
        files: [{ ...files[0]!, text: 'x'.repeat(INFRA_SOURCES_MAX_STORED_CHARS + 1) }],
      },
      { graph },
    ],
  ] as const)('refuses %s, naming replace.sources', (_, sources, body) => {
    const rejection = refused(applyReplace(null, body as ReplaceBody, { ...options, sources }));
    expect(rejection).toMatchObject({ code: 'invalid_value' });
    expect(rejection.details[0]).toMatch(/^replace\.sources: /);
  });
});
