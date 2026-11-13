// @vitest-environment jsdom
// docs/specs/026-plan/describe-a-plan.md: Describe a Plan's call (a refusal in the api's words, anything else a
// failure), the preview's edit parts, and the host: who is asking, the plan the draft joins, Make Plan adding the types
// the plan lacks before placing the board as Start Planning does, and the telemetry.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPES,
  PLAN_DRAFT_COLOURS,
  type ItemTypeDef,
  type PlanBoardSetup,
  type PlanDraft,
} from '@liveplanner/items';
import type { ComponentProps } from 'react';
import { freshName, newDraftType, problemsByPath, withKind } from './draft-edits';

const core = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response): Promise<unknown> => (await res.json()) as unknown),
}));
vi.mock('@/lib/api/core', () => ({ API_BASE: 'https://api.test/api', ...core }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const dialog = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('./DescribePlanDialog', () => ({
  DescribePlanDialog: (props: Record<string, unknown>) => {
    dialog.props = props;
    return null;
  },
}));
const ctx = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/app/project/[id]/EditorContext', () => ({ useEditorContext: () => ctx.value }));

const { draftPlan, PlanDraftRefusal } = await import('./plan-draft-client');
const { DescribePlanHost, DESCRIBE_PLAN_NOT_READY } = await import('./DescribePlanHost');

const draft = (): PlanDraft => ({
  title: 'Hiring',
  columns: ['Applied', 'Offer'],
  cardTypes: [
    {
      name: 'Candidate',
      color: PLAN_DRAFT_COLOURS[0]!,
      glyph: 'person',
      builtInFields: ['description', 'assignee'],
      fields: [{ name: 'Role', kind: 'text' }],
    },
    { ...newDraftType({ title: '', columns: [], cardTypes: [] }), name: 'Task' },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  dialog.props = null;
});

describe('draftPlan', () => {
  it('asks with the words and answers the draft', async () => {
    core.apiFetch.mockResolvedValueOnce(Response.json({ draft: draft() }));
    await expect(draftPlan('o1', 'hiring')).resolves.toEqual({ draft: draft() });
    expect(core.apiFetch).toHaveBeenCalledWith('https://api.test/api/plan-drafts', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
      body: JSON.stringify({ prompt: 'hiring' }),
    });
    expect(core.apiHeaders).toHaveBeenCalledWith('o1', { body: true });
  });

  it('throws a refusal the api names with its words', async () => {
    core.apiFetch.mockResolvedValueOnce(
      Response.json(
        { error: 'plan_draft_capped', message: 'You’ve described 10 plans today.' },
        {
          status: 429,
        },
      ),
    );
    const refused = await draftPlan('o1', 'x').catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(PlanDraftRefusal);
    expect(refused).toMatchObject({ status: 429, code: 'plan_draft_capped' });
  });

  it.each([
    ['an error it does not name', Response.json({ error: 'nope', message: 'x' }, { status: 500 })],
    ['a body that is not JSON', new Response('<html>', { status: 502 })],
  ])('leaves %s to expectOk', async (_, res) => {
    core.apiFetch.mockResolvedValueOnce(res);
    core.expectOk.mockRejectedValueOnce(new Error('failed'));
    await expect(draftPlan('o1', 'x')).rejects.toThrow('failed');
  });
});

describe('the preview’s parts', () => {
  it('names a new one apart from the rest', () => {
    expect(freshName('New Column', ['Applied'])).toBe('New Column');
    expect(freshName('New Column', ['new column', 'New Column 2'])).toBe('New Column 3');
  });

  it('gives a field another kind: a Choice keeps or gains options, any other holds none', () => {
    expect(withKind({ name: 'Band', kind: 'text' }, 'choice')).toEqual({
      name: 'Band',
      kind: 'choice',
      options: ['Option 1'],
    });
    expect(withKind({ name: 'Band', kind: 'choice', options: ['A'] }, 'multichoice')).toEqual({
      name: 'Band',
      kind: 'multichoice',
      options: ['A'],
    });
    expect(withKind({ name: 'Band', kind: 'choice', options: ['A'] }, 'date')).toEqual({
      name: 'Band',
      kind: 'date',
    });
  });

  it('starts a new type in the next colour, named apart', () => {
    const d = draft();
    expect(newDraftType(d)).toMatchObject({
      name: 'New Type',
      color: PLAN_DRAFT_COLOURS[2],
      glyph: 'star',
      fields: [],
    });
    expect(problemsByPath([{ path: 'title', message: 'm' }]).get('title')).toBe('m');
  });
});

describe('DescribePlanHost', () => {
  const host = (opts: { plan?: boolean; account?: string | null; catalogue?: boolean } = {}) => {
    const addTypes = vi.fn<(defs: readonly ItemTypeDef[]) => void>();
    const startElementTab = vi.fn((_kind: string, add: () => void) => add());
    const dropPaletteItem =
      vi.fn<(kind: string, x: number, y: number, art: { planBoard: PlanBoardSetup }) => void>();
    ctx.value = {
      plan:
        opts.plan === false
          ? undefined
          : {
              context: {
                types: ITEM_TYPES,
                itemTypes: {
                  catalogue: opts.catalogue
                    ? { version: ITEM_TYPE_CATALOGUE_VERSION, types: ITEM_TYPES }
                    : null,
                  addTypes,
                },
              },
            },
      tabs: [],
      accountUserId: opts.account === undefined ? 'acct-1' : opts.account,
      selfParticipant: { id: 'o1' },
      getViewportCenter: () => ({ x: 10, y: 20 }),
      planTabs: { startElementTab },
      dropPaletteItem,
    };
    const onClose = vi.fn();
    render(<DescribePlanHost onClose={onClose} />);
    const props = dialog.props as unknown as ComponentProps<
      typeof import('./DescribePlanDialog').DescribePlanDialog
    >;
    return { props, addTypes, startElementTab, dropPaletteItem, onClose };
  };

  it('counts the dialog opened, and says who is asking', () => {
    const { props } = host();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PlanDescribe');
    expect(props.signedIn).toBe(true);
    expect(props.signInHref).toMatch(/^\/sign-in\//);
    expect(host({ account: null }).props.signedIn).toBe(false);
  });

  it('checks against the types the plan shows, and asks as this person', async () => {
    const { props } = host();
    expect(props.plan.catalogue?.types.map((t) => t.label)).toEqual(ITEM_TYPES.map((t) => t.label));
    expect(props.planTypes).toHaveLength(ITEM_TYPES.length);
    core.apiFetch.mockResolvedValueOnce(Response.json({ draft: draft() }));
    await props.draft('hiring');
    expect(core.apiHeaders).toHaveBeenCalledWith('o1', { body: true });
  });

  it('makes the plan: the new types, then the board filling the tab, then closes', () => {
    const { props, addTypes, startElementTab, dropPaletteItem, onClose } = host({
      catalogue: true,
    });
    expect(props.onMake(draft())).toBeNull();
    expect(addTypes.mock.calls[0]![0].map((t) => t.label)).toEqual(['Candidate']);
    expect(startElementTab).toHaveBeenCalledWith('board', expect.any(Function));
    const [kind, x, y, art] = dropPaletteItem.mock.calls[0]!;
    expect([kind, x, y]).toEqual(['plan-board', 10, 20]);
    expect(art.planBoard.title).toBe('Hiring');
    expect(art.planBoard.addTypes).toEqual([addTypes.mock.calls[0]![0][0]!.id, 'task']);
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'PlanDraft');
    expect(onClose).toHaveBeenCalled();
  });

  it('adds no types when the plan has them all', () => {
    const { props, addTypes, dropPaletteItem } = host();
    expect(props.onMake({ ...draft(), cardTypes: [draft().cardTypes[1]!] })).toBeNull();
    expect(addTypes).not.toHaveBeenCalled();
    expect(dropPaletteItem).toHaveBeenCalled();
  });

  it('makes nothing from a draft that does not read, or with no plan', () => {
    const { props, dropPaletteItem } = host();
    expect(props.onMake({ ...draft(), columns: [] })).toMatch(/column/);
    expect(dropPaletteItem).not.toHaveBeenCalled();
    expect(host({ plan: false }).props.onMake(draft())).toBe(DESCRIBE_PLAN_NOT_READY);
  });
});
