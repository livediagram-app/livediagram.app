// @vitest-environment jsdom

// The editor's infrastructure import (docs/specs/020-import-export/infrastructure-import.md "The editor"): a pasted or
// picked wrangler.toml or Compose file drawn as an architecture tab in one replace, its skipped keys in the report,
// and every refusal said without touching the tab.

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { INFRA_FILE_MAX_BYTES, INFRA_REPORT_SUBTITLE } from '@/lib/infra-import';
import { remintTabElements, useTabImport } from './useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const pickTabFile = vi.hoisted(() => vi.fn());
vi.mock('@/lib/import-tab', async (load) => ({
  ...(await load<typeof import('@/lib/import-tab')>()),
  pickTabFile,
}));

function setup(locked = false, start?: Tab) {
  let tabs: Tab[] = [
    start ?? { id: 't1', name: 'Arch', elements: [], ...(locked ? { locked: true } : {}) },
  ];
  const deps = {
    tabs,
    ownerId: 'owner-1',
    documentId: 'doc-1',
    createTab: (name: string): Tab => ({ id: crypto.randomUUID(), name, elements: [] }),
    markTabLoaded: vi.fn(),
    activeId: 't1',
    commitTabs: vi.fn((f: (ts: Tab[]) => Tab[]) => void (tabs = f(tabs))),
    setSelectedId: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
    setImportError: vi.fn(),
    requestFit: vi.fn(),
    importScene: vi.fn(),
  };
  const { result } = renderHook(() => useTabImport(deps));
  return { api: result.current, deps, landed: () => tabs[0]! };
}

const WRANGLER = 'name = "api"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "shop"\n';

afterEach(() => vi.clearAllMocks());

describe('importing infrastructure code into a tab', () => {
  it('draws a pasted wrangler.toml with its icons and closes when nothing was skipped', async () => {
    const { api, landed, deps } = setup();
    expect(await api.importTextIntoActiveTab('infra', WRANGLER)).toEqual({ status: 'done' });
    const els = landed().elements;
    expect(els.find((e) => e.id === 'worker-api')).toMatchObject({
      label: 'api',
      iconId: 'cf-workers',
    });
    expect(els.find((e) => e.id === 'd1-shop')).toMatchObject({ iconId: 'cf-d1' });
    expect(els.filter((e) => e.type === 'arrow')).toHaveLength(1);
    expect(deps.commitTabs).toHaveBeenCalledOnce();
    expect(deps.requestFit).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Wrangler');
  });

  it('reports the keys it did not draw', async () => {
    const { api } = setup();
    const outcome = await api.importTextIntoActiveTab(
      'infra',
      'services:\n  web: { image: nginx, develop: {} }\nsecrets: {}\n',
    );
    expect(outcome).toMatchObject({
      status: 'done',
      subtitle: INFRA_REPORT_SUBTITLE,
      scene: {
        skipped: [{ rule: 'Keys not drawn: secrets, services.*.develop', count: 2 }],
      },
    });
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Compose');
  });

  it('says why a file could not be read, leaving the tab as it was', async () => {
    const { api, deps } = setup();
    const outcome = await api.importTextIntoActiveTab('infra', 'name = \n');
    expect(outcome).toMatchObject({ status: 'error' });
    expect(outcome.status === 'error' && outcome.error).toMatch(
      /^Couldn't read the TOML: .+\(line 1\)\.$/,
    );
    expect(await api.importTextIntoActiveTab('infra', 'services: {}')).toEqual({
      status: 'error',
      error: 'That Compose file has no services to draw.',
    });
    expect(deps.commitTabs).not.toHaveBeenCalled();
  });

  it('reads a picked file by its name, and refuses one past the cap unread', async () => {
    const { api, landed } = setup();
    pickTabFile.mockResolvedValueOnce({
      name: 'compose.yaml',
      text: 'services:\n  web: {}\n',
      file: {},
    });
    expect(await api.importIntoActiveTab('infra')).toEqual({ status: 'done' });
    expect(pickTabFile).toHaveBeenLastCalledWith(expect.stringContaining('.toml'), {
      maxBytes: INFRA_FILE_MAX_BYTES,
    });
    // The name says the format and heads the drawing: "From compose.yaml".
    expect(JSON.stringify(landed().elements)).toContain('From compose.yaml');
    pickTabFile.mockResolvedValueOnce({ name: 'big.yml', text: '', file: {}, tooBig: true });
    expect(await api.importIntoActiveTab('infra')).toMatchObject({
      status: 'error',
      error: expect.stringMatching(/over 1 MB/),
    });
    pickTabFile.mockResolvedValueOnce(null);
    expect(await api.importIntoActiveTab('infra')).toEqual({ status: 'cancelled' });
  });

  it('refuses a locked tab', async () => {
    const { api } = setup(true);
    expect(await api.importTextIntoActiveTab('infra', WRANGLER)).toMatchObject({ status: 'error' });
    expect(await api.importInfraFiles([{ text: WRANGLER }])).toEqual({
      status: 'error',
      error: 'This tab is locked. Unlock it before importing.',
    });
  });
});

const COMPOSE_V1 =
  'services:\n  web:\n    image: nginx\n    depends_on: [api]\n  api:\n    image: acme/api\n';
const COMPOSE_V2 =
  'services:\n  web:\n    image: nginx\n    depends_on: [api]\n  api:\n    image: acme/api\n    depends_on: [cache]\n  cache:\n    image: redis\n';

describe('several files, and the tab remembering them', () => {
  it('draws every file into one tab with the chosen environment, and remembers them', async () => {
    const { api, landed, deps } = setup();
    const outcome = await api.importInfraFiles(
      [
        {
          name: 'wrangler.toml',
          text: 'name = "api"\n[env.staging]\nname = "api-staging"\n',
        },
        { name: 'main.tf', text: 'resource "aws_s3_bucket" "assets" {}\n' },
      ],
      'staging',
    );
    expect(outcome).toEqual({ status: 'done' });
    expect(deps.commitTabs).toHaveBeenCalledOnce();
    const tab = landed();
    expect(tab.elements.map((e) => e.id)).toEqual(
      expect.arrayContaining(['worker-api-staging', 'tf-aws-s3-bucket-assets']),
    );
    expect(tab.sources).toMatchObject({
      bridge: 'infra',
      env: 'staging',
      files: [
        { name: 'wrangler.toml', format: 'wrangler', text: expect.any(String) },
        { name: 'main.tf', format: 'terraform', text: expect.any(String) },
      ],
      nodes: { 'worker-api-staging': { el: 'worker-api-staging', label: 'api-staging' } },
    });
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Wrangler');
  });

  it('names the file an error is in', async () => {
    const { api } = setup();
    expect(
      await api.importInfraFiles([
        { name: 'compose.yml', text: COMPOSE_V1 },
        { name: 'main.tf', text: 'resource {' },
      ]),
    ).toMatchObject({
      status: 'error',
      error: expect.stringMatching(/^main\.tf: Couldn't read the HCL/),
    });
  });

  it('updates the tab from new versions, keeping a moved box and a renamed label, in one commit', async () => {
    const first = setup();
    await first.api.importInfraFiles([{ name: 'compose.yml', text: COMPOSE_V1 }]);
    // A person moves web and renames api.
    const drawn = first.landed();
    const edited: Tab = {
      ...drawn,
      elements: drawn.elements.map((e) =>
        e.id === 'svc-web' && 'x' in e
          ? { ...e, x: e.x + 500 }
          : e.id === 'svc-api'
            ? { ...e, label: 'Orders API' }
            : e,
      ),
    };
    const { api, landed, deps } = setup(false, edited);
    const outcome = await api.updateFromSources([{ name: 'compose.yml', text: COMPOSE_V2 }]);
    expect(deps.commitTabs).toHaveBeenCalledOnce();
    const tab = landed();
    const web = tab.elements.find((e) => e.id === 'svc-web');
    const webBefore = edited.elements.find((e) => e.id === 'svc-web');
    expect(web && 'x' in web && web.x).toBe(webBefore && 'x' in webBefore && webBefore.x);
    expect(tab.elements.find((e) => e.id === 'svc-api')).toMatchObject({ label: 'Orders API' });
    expect(tab.elements.find((e) => e.id === 'svc-cache')).toMatchObject({ iconId: 'redis' });
    expect(tab.sources!.files[0]!.text).toBe(COMPOSE_V2);
    expect(outcome).toMatchObject({
      status: 'done',
      title: 'Update complete',
      subtitle: 'Updated from 1 file.',
      scene: {
        degraded: expect.arrayContaining([
          { rule: 'Boxes added from the files', count: 1 },
          { rule: 'Edits kept (labels, notes or icons changed on the tab)', count: 1 },
        ]),
      },
    });
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'InfraUpdate');
  });

  it('refuses to update a locked tab, a tab no file drew, or from files that do not read', async () => {
    const first = setup();
    await first.api.importInfraFiles([{ name: 'compose.yml', text: COMPOSE_V1 }]);
    const drawn = first.landed();
    const locked = setup(false, { ...drawn, locked: true });
    expect(await locked.api.updateFromSources([{ text: COMPOSE_V2 }])).toMatchObject({
      status: 'error',
      error: 'This tab is locked. Unlock it before importing.',
    });
    const plain = setup();
    expect(await plain.api.updateFromSources([{ text: COMPOSE_V2 }])).toMatchObject({
      status: 'error',
      error: 'This tab was not drawn from files.',
    });
    const bad = setup(false, drawn);
    expect(
      await bad.api.updateFromSources([{ name: 'compose.yml', text: 'services: [' }]),
    ).toMatchObject({
      status: 'error',
    });
    expect(bad.deps.commitTabs).not.toHaveBeenCalled();
    const gone = setup(false, { ...drawn, id: 'other' });
    expect(await gone.api.updateFromSources([{ text: COMPOSE_V2 }])).toMatchObject({
      status: 'error',
    });
  });

  it('forgets the files when another import replaces the tab', async () => {
    const first = setup();
    await first.api.importInfraFiles([{ name: 'compose.yml', text: COMPOSE_V1 }]);
    const { api, landed } = setup(false, first.landed());
    await api.importTextIntoActiveTab('mermaid', 'flowchart TD\n  A --> B');
    expect(landed().sources).toBeUndefined();
  });
});

describe('remintTabElements', () => {
  it('follows the re-minted ids in the remembered record, and drops one that does not read', async () => {
    const first = setup();
    await first.api.importInfraFiles([{ name: 'compose.yml', text: COMPOSE_V1 }]);
    const drawn = first.landed();
    const copy = remintTabElements(drawn);
    const web = copy.sources!.nodes['svc-web']!.el;
    expect(web).not.toBe('svc-web');
    expect(copy.elements.some((e) => e.id === web)).toBe(true);
    const arrow = copy.sources!.edges['svc-web>svc-api']!;
    expect(copy.elements.some((e) => e.id === arrow && e.type === 'arrow')).toBe(true);
    expect(remintTabElements({ elements: [], sources: 'junk' })).not.toHaveProperty('sources');
  });
});
