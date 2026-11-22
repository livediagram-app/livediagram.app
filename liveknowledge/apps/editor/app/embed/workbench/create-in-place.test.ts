// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CreateDocument = typeof import('@/lib/api-client').apiCreateDocument;
const api = vi.hoisted(() => ({ apiCreateDocument: vi.fn<CreateDocument>() }));
vi.mock('@/lib/api-client', () => api);

import { createDocumentInPlace, createInPlaceOf } from './create-in-place';
import {
  knowledgebaseStartOffered,
  queuedStructurePick,
} from '@/components/start/knowledgebase-start';

const ORIGIN = 'https://live.test';
const HOME = { kind: 'explorer', node: { kind: 'home' } } as const;

describe('createInPlaceOf', () => {
  it('takes the wizard href’s place and template first', () => {
    expect(createInPlaceOf('/new?folder=f1&template=design-doc', ORIGIN, HOME)).toEqual({
      folderId: 'f1',
      teamId: null,
      templateKind: 'design-doc',
      structure: null,
    });
    expect(createInPlaceOf('/new?team=t1', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: 't1',
      templateKind: null,
      structure: null,
    });
  });

  it('fills in the place the frame shows when the href names none', () => {
    expect(
      createInPlaceOf('/new', ORIGIN, { kind: 'explorer', node: { kind: 'folder', id: 'f2' } }),
    ).toEqual({ folderId: 'f2', teamId: null, templateKind: null, structure: null });
    expect(
      createInPlaceOf('/new?blank=1', ORIGIN, {
        kind: 'explorer',
        node: { kind: 'team', id: 't2' },
      }),
    ).toEqual({ folderId: null, teamId: 't2', templateKind: 'blank', structure: null });
    expect(createInPlaceOf('/new?q=roadmap', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: null,
      templateKind: null,
      structure: null,
    });
  });

  it('takes the structure the href names', () => {
    expect(createInPlaceOf('/new?structure=team-handbook', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: null,
      templateKind: null,
      structure: 'team-handbook',
    });
  });
});

describe('createDocumentInPlace', () => {
  beforeEach(() => {
    api.apiCreateDocument.mockReset();
    api.apiCreateDocument.mockResolvedValue({} as never);
  });

  it('makes one page to write on, its start never shown, in the asked folder', async () => {
    const id = await createDocumentInPlace('user_1', {
      folderId: 'f1',
      teamId: null,
      templateKind: null,
      structure: null,
    });

    const [owner, made] = api.apiCreateDocument.mock.calls[0]!;
    expect(owner).toBe('user_1');
    expect(made).toMatchObject({
      id,
      name: 'Untitled Knowledgebase',
      folderId: 'f1',
      teamId: null,
    });
    expect(made.tabs).toHaveLength(1);
    expect(made.tabs?.[0]?.templateChosen).toBe(true);
    expect(made.tabs?.[0]?.name).toBe('Start Here');
    expect(made.tabs?.[0]?.pages).toHaveLength(1);
    expect(made.tabs?.[0]?.elements).toEqual([]);
  });

  it('makes the asked template as /new makes it', async () => {
    await createDocumentInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: 'design-doc',
      structure: null,
    });

    const [, made] = api.apiCreateDocument.mock.calls[0]!;
    expect(made.name).not.toBe('Untitled Knowledgebase');
    expect(made.tabs?.[0]?.templateChosen).toBe(true);
    expect(made.intent).toBeDefined();
  });

  it('queues the asked structure on the new knowledgebase’s start, and only then', async () => {
    sessionStorage.clear();
    await createDocumentInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: null,
      structure: 'sales-playbook',
    });
    const [, made] = api.apiCreateDocument.mock.calls[0]!;
    const tabId = made.tabs![0]!.id;
    expect(queuedStructurePick(tabId)).toBe('sales-playbook');
    expect(knowledgebaseStartOffered(tabId)).toBe(true);
  });

  it('lets a refused create through to the caller', async () => {
    const refused = new Error('403');
    api.apiCreateDocument.mockImplementation(async () => {
      throw refused;
    });

    const made = createDocumentInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: null,
      structure: null,
    }).catch((err: unknown) => err);

    expect(await made).toBe(refused);
  });
});
