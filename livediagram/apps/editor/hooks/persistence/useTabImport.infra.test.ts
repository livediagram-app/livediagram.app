// @vitest-environment jsdom

// The editor's infrastructure import (docs/specs/020-import-export/infrastructure-import.md "The editor"): a pasted or
// picked wrangler.toml or Compose file drawn as an architecture tab in one replace, its skipped keys in the report,
// and every refusal said without touching the tab.

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { INFRA_FILE_MAX_BYTES, INFRA_REPORT_SUBTITLE } from '@/lib/infra-import';
import { useTabImport } from './useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const pickTabFile = vi.hoisted(() => vi.fn());
vi.mock('@/lib/import-tab', async (load) => ({
  ...(await load<typeof import('@/lib/import-tab')>()),
  pickTabFile,
}));

function setup(locked = false) {
  let tabs: Tab[] = [{ id: 't1', name: 'Arch', elements: [], ...(locked ? { locked: true } : {}) }];
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
  });
});
