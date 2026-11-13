// @vitest-environment jsdom
// docs/specs/026-plan/describe-a-plan.md: the dialog (the examples, the count, Ctrl / ⌘ Enter, busy while drafting,
// Cancel), a refusal said in the api's fixed words, the guest's sign-in nudge, Check Your Plan's edits with every
// problem said at its place and Make Plan held while one stands, a type the plan has kept read-only, and Back.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPES,
  PLAN_DRAFT_COLOURS,
  PLAN_DRAFT_OFF_TOPIC,
  type PlanDraft,
  type PlanDraftPlan,
  type PlanDraftRule,
} from '@liveplanner/items';
import type { PlanDraftResponse } from '@liveplanner/api-schema';
import {
  DESCRIBE_PLAN_EXAMPLES,
  DESCRIBE_PLAN_FAILED,
  DESCRIBE_PLAN_SIGN_IN,
  DescribePlanDialog,
} from './DescribePlanDialog';
import { PlanDraftRefusal } from './plan-draft-client';
import { STARTER_RULES_LEFT_OUT, STARTER_RULES_LINE } from './PlanDraftRules';

const drafted = (): PlanDraft => ({
  title: 'Hiring Pipeline',
  columns: ['Applied', 'Screen', 'Interview', 'Offer'],
  cardTypes: [
    {
      name: 'Candidate',
      color: PLAN_DRAFT_COLOURS[0]!,
      glyph: 'person',
      builtInFields: ['description', 'assignee', 'due'],
      fields: [
        { name: 'Role', kind: 'text' },
        { name: 'Salary Band', kind: 'choice', options: ['A', 'B'] },
      ],
    },
  ],
});

const EMPTY: PlanDraftPlan = { catalogue: null, statuses: [] };

function mount(
  opts: {
    signedIn?: boolean;
    draft?: (prompt: string) => Promise<PlanDraftResponse>;
    plan?: PlanDraftPlan;
    rulesMade?: boolean;
    onMake?: (d: PlanDraft) => string | null;
  } = {},
) {
  const draft = vi.fn(opts.draft ?? (async () => ({ draft: drafted() })));
  const onMake = vi.fn(opts.onMake ?? (() => null));
  const onClose = vi.fn();
  const plan = opts.plan ?? EMPTY;
  render(
    <DescribePlanDialog
      signedIn={opts.signedIn ?? true}
      signInHref="/sign-in/?redirect_url=%2Fp%2F1"
      draft={draft}
      plan={plan}
      planTypes={plan.catalogue?.types ?? []}
      rulesMade={opts.rulesMade ?? true}
      onMake={onMake}
      onClose={onClose}
    />,
  );
  return { draft, onMake, onClose };
}

const box = () => screen.getByRole('textbox', { name: 'Describe the plan' });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function toPreview(opts: Parameters<typeof mount>[0] = {}) {
  const m = mount(opts);
  fireEvent.change(box(), { target: { value: 'a hiring pipeline' } });
  fireEvent.click(button(/Draft Plan/));
  await screen.findByText('Check Your Plan');
  return m;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Describe a Plan: the words', () => {
  it('fills the box from an example, counts it, and drafts with Ctrl Enter', async () => {
    const { draft } = mount();
    expect(button(/Draft Plan/).hasAttribute('disabled')).toBe(true);
    fireEvent.click(button(DESCRIBE_PLAN_EXAMPLES[1]!.label));
    expect((box() as HTMLTextAreaElement).value).toBe(DESCRIBE_PLAN_EXAMPLES[1]!.text);
    expect(screen.getByText(`${DESCRIBE_PLAN_EXAMPLES[1]!.text.length} / 500`)).toBeTruthy();
    expect(screen.getByText('Uses AI: plans and forms share 10 drafts a day.')).toBeTruthy();
    fireEvent.keyDown(box(), { key: 'Enter', ctrlKey: true });
    expect(draft).toHaveBeenCalledWith(DESCRIBE_PLAN_EXAMPLES[1]!.text);
    await screen.findByText('Check Your Plan');
  });

  it('is busy while it drafts, the box read-only, and Cancel stops waiting', async () => {
    let answer: (r: PlanDraftResponse) => void = () => {};
    const { onClose } = mount({ draft: () => new Promise((r) => (answer = r)) });
    fireEvent.change(box(), { target: { value: 'plan' } });
    fireEvent.click(button(/Draft Plan/));
    expect(button(/Drafting…/).getAttribute('aria-busy')).toBe('true');
    expect((box() as HTMLTextAreaElement).readOnly).toBe(true);
    // A second press while busy asks nothing more.
    fireEvent.keyDown(box(), { key: 'Enter', metaKey: true });
    fireEvent.click(button('Cancel'));
    expect(onClose).toHaveBeenCalled();
    await act(async () => answer({ draft: drafted() }));
    expect(screen.queryByText('Check Your Plan')).toBeNull();
  });

  it('says a refusal in the api’s words, and any other failure in its own, the words kept', async () => {
    const { draft } = mount({
      draft: async () => {
        throw new PlanDraftRefusal(422, 'plan_draft_off_topic', PLAN_DRAFT_OFF_TOPIC);
      },
    });
    fireEvent.change(box(), { target: { value: 'tell me a story' } });
    fireEvent.click(button(/Draft Plan/));
    expect((await screen.findByRole('alert')).textContent).toBe(PLAN_DRAFT_OFF_TOPIC);
    expect((box() as HTMLTextAreaElement).value).toBe('tell me a story');
    expect(box().getAttribute('aria-invalid')).toBe('true');
    // Typing clears it.
    fireEvent.change(box(), { target: { value: 'a launch plan' } });
    expect(screen.queryByRole('alert')).toBeNull();
    draft.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(button(/Draft Plan/));
    expect((await screen.findByRole('alert')).textContent).toBe(DESCRIBE_PLAN_FAILED);
  });

  it('asks a guest to sign in, in the box’s place, and goes there', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { draft } = mount({ signedIn: false });
    expect(screen.getByText(DESCRIBE_PLAN_SIGN_IN)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Describe the plan' })).toBeNull();
    fireEvent.click(button('Sign In'));
    expect(assign).toHaveBeenCalledWith('/sign-in/?redirect_url=%2Fp%2F1');
    expect(draft).not.toHaveBeenCalled();
  });
});

describe('Describe a Plan: Check Your Plan', () => {
  it('shows the draft to change, and Make Plan hands up what was changed', async () => {
    const { onMake, onClose } = await toPreview();
    expect(screen.getByText('Drafted by AI.')).toBeTruthy();
    expect(screen.getByDisplayValue('Hiring Pipeline')).toBeTruthy();
    expect(screen.getByText('4 of 12')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Column 4' }), {
      target: { value: 'Hired' },
    });
    fireEvent.click(button('Add Column'));
    expect(screen.getByRole('textbox', { name: 'Column 5' })).toHaveProperty('value', 'New Column');
    fireEvent.click(button('Remove Applied'));
    fireEvent.click(button('Remove Due Date'));
    fireEvent.click(button('Make Plan'));
    expect(onMake).toHaveBeenCalledWith({
      ...drafted(),
      columns: ['Screen', 'Interview', 'Hired', 'New Column'],
      cardTypes: [{ ...drafted().cardTypes[0]!, builtInFields: ['description', 'assignee'] }],
    });
    // The host closes the dialog once it is made; it never closes itself.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says each problem at its place and holds Make Plan until it is fixed', async () => {
    const { onMake } = await toPreview();
    fireEvent.change(screen.getByRole('textbox', { name: 'Column 2' }), {
      target: { value: 'applied' },
    });
    // Both chips of the name are marked, and the words said once under the row.
    expect(screen.getAllByText('Two columns are called “Applied”.')).toHaveLength(1);
    for (const name of ['Column 1', 'Column 2'])
      expect(screen.getByRole('textbox', { name }).getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByRole('textbox', { name: 'Column 3' }), { target: { value: '' } });
    expect(screen.getByText('Give this column a name.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Column 3' }), {
      target: { value: 'Interview' },
    });
    fireEvent.change(screen.getByDisplayValue('Hiring Pipeline'), { target: { value: ' ' } });
    expect(screen.getByText('Give the board a name.')).toBeTruthy();
    expect(screen.getByText('Fix the 3 marked problems to make the plan.')).toBeTruthy();
    expect(button('Make Plan').hasAttribute('disabled')).toBe(true);
    fireEvent.click(button('Make Plan'));
    expect(onMake).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Column 2' }), {
      target: { value: 'Screen' },
    });
    expect(screen.getByText('Fix the marked problem to make the plan.')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'Hiring' } });
    expect(button('Make Plan').hasAttribute('disabled')).toBe(false);
  });

  it('edits fields: a name, a kind, a Choice’s options, Add Field and Remove', async () => {
    const { onMake } = await toPreview();
    const type = screen.getByRole('region', { name: 'Card type Candidate' });
    const role = within(type).getAllByRole('textbox', { name: 'Field name' })[0]!;
    fireEvent.change(role, { target: { value: '' } });
    expect(within(type).getByText('Give this field a name.')).toBeTruthy();
    fireEvent.change(role, { target: { value: 'Position' } });
    fireEvent.change(within(type).getByRole('combobox', { name: 'Kind of Position' }), {
      target: { value: 'multichoice' },
    });
    expect(within(type).getAllByRole('textbox', { name: 'Option 1' })[0]).toHaveProperty(
      'value',
      'Option 1',
    );
    fireEvent.click(within(type).getAllByRole('button', { name: 'Add Option' })[0]!);
    // Salary Band's options: one renamed, one removed, before it becomes a Number.
    fireEvent.change(within(type).getByDisplayValue('B'), { target: { value: 'C' } });
    fireEvent.click(within(type).getByRole('button', { name: 'Remove A' }));
    expect(within(type).queryByDisplayValue('A')).toBeNull();
    expect(within(type).getByDisplayValue('C')).toBeTruthy();
    fireEvent.change(within(type).getByRole('combobox', { name: 'Kind of Salary Band' }), {
      target: { value: 'number' },
    });
    fireEvent.click(within(type).getByRole('button', { name: 'Add Field' }));
    fireEvent.click(within(type).getByRole('button', { name: 'Remove New Field' }));
    fireEvent.change(within(type).getByRole('textbox', { name: 'Card type 1 name' }), {
      target: { value: 'Applicant' },
    });
    fireEvent.click(button('Make Plan'));
    expect(onMake.mock.calls[0]![0].cardTypes[0]).toMatchObject({
      name: 'Applicant',
      fields: [
        { name: 'Position', kind: 'multichoice', options: ['Option 1', 'Option 2'] },
        { name: 'Salary Band', kind: 'number' },
      ],
    });
    expect(onMake.mock.calls[0]![0].cardTypes[0]!.fields[1]).not.toHaveProperty('options');
  });

  it('adds and removes card types, asking for one when none is left', async () => {
    await toPreview();
    fireEvent.click(button('Add Card Type'));
    expect(screen.getByRole('region', { name: 'Card type New Type' })).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Card type New Type' })).getByText(
        'Add a field for anything else its cards should hold.',
      ),
    ).toBeTruthy();
    fireEvent.click(button('Remove New Type'));
    fireEvent.click(button('Remove Candidate'));
    expect(screen.getByText('Keep at least one card type.')).toBeTruthy();
    expect(button('Make Plan').hasAttribute('disabled')).toBe(true);
  });

  it('keeps a type the plan already has read-only, showing its own fields', async () => {
    const own = { ...ITEM_TYPES[1], label: 'Candidate', custom: [] };
    const plan: PlanDraftPlan = {
      catalogue: { version: ITEM_TYPE_CATALOGUE_VERSION, types: [own] },
      statuses: [],
    };
    await toPreview({ plan });
    const type = screen.getByRole('region', { name: 'Card type Candidate' });
    expect(within(type).getByText('Already in this plan: yours is kept as it is.')).toBeTruthy();
    expect(within(type).queryByRole('textbox')).toBeNull();
  });

  it('says why Make Plan could not make it, and Back returns to the words, kept', async () => {
    await toPreview({ onMake: () => 'This plan isn’t ready yet. Try again in a moment.' });
    fireEvent.click(button('Make Plan'));
    expect(screen.getByText('This plan isn’t ready yet. Try again in a moment.')).toBeTruthy();
    fireEvent.click(button('Back'));
    await waitFor(() => expect((box() as HTMLTextAreaElement).value).toBe('a hiring pipeline'));
  });
});

describe('Describe a Plan: Starter Rules', () => {
  const rule: PlanDraftRule = {
    name: 'Stamp Offer Date',
    on: true,
    trigger: { kind: 'card_moved', to: ['Offer'] },
    conditions: [],
    steps: [{ kind: 'set_field', field: 'Role', value: { text: 'Offered' } }],
  };
  const withRules = async (opts: Parameters<typeof mount>[0] = {}) =>
    toPreview({
      draft: async () => ({
        draft: {
          ...drafted(),
          rules: [
            rule,
            {
              ...rule,
              name: 'Flag New Cards',
              trigger: { kind: 'card_created' },
              steps: [{ kind: 'flag' }],
            },
          ],
        },
      }),
      ...opts,
    });

  it('lists each rule with its switch, name and sentence, and Make Plan hands up what was changed', async () => {
    const { onMake } = await withRules();
    const section = screen.getByRole('region', { name: 'Starter Rules' });
    expect(within(section).getByText(STARTER_RULES_LINE)).toBeTruthy();
    const first = within(section).getByRole('region', { name: 'Starter rule Stamp Offer Date' });
    expect(within(first).getByText('Offer')).toBeTruthy();
    fireEvent.click(within(first).getByRole('switch', { name: 'Make Stamp Offer Date on' }));
    fireEvent.change(within(first).getByRole('textbox', { name: 'Rule 1 name' }), {
      target: { value: 'Mark Offers' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Remove Flag New Cards' }));
    fireEvent.click(button('Make Plan'));
    expect(onMake.mock.calls[0]![0].rules).toEqual([{ ...rule, name: 'Mark Offers', on: false }]);
  });

  it('follows a column renamed into the rules, and says a rule whose column was removed', async () => {
    const { onMake } = await withRules();
    fireEvent.change(screen.getByRole('textbox', { name: 'Column 4' }), {
      target: { value: 'Offered' },
    });
    const first = screen.getByRole('region', { name: 'Starter rule Stamp Offer Date' });
    expect(within(first).getByText('Offered')).toBeTruthy();
    fireEvent.change(
      within(screen.getByRole('region', { name: 'Card type Candidate' })).getAllByRole('textbox', {
        name: 'Field name',
      })[0]!,
      {
        target: { value: 'Position' },
      },
    );
    fireEvent.click(button('Remove Offered'));
    expect(
      within(first).getByText('This rule names the column “Offered”, which this plan won’t have.'),
    ).toBeTruthy();
    expect(button('Make Plan').hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(first).getByRole('button', { name: 'Remove Stamp Offer Date' }));
    fireEvent.click(button('Make Plan'));
    expect(onMake.mock.calls[0]![0].rules).toHaveLength(1);
  });

  it('leaves the rules out on a plan where they can’t be made, never holding Make Plan for them', async () => {
    const { onMake } = await withRules({ rulesMade: false });
    const section = screen.getByRole('region', { name: 'Starter Rules' });
    expect(within(section).getByText(STARTER_RULES_LEFT_OUT)).toBeTruthy();
    expect(within(section).queryByRole('switch')).toBeNull();
    fireEvent.click(button('Remove Offer'));
    fireEvent.click(button('Make Plan'));
    expect(onMake.mock.calls[0]![0].rules).toEqual([]);
  });

  it('shows no section for a draft with no rules', async () => {
    await toPreview();
    expect(screen.queryByRole('region', { name: 'Starter Rules' })).toBeNull();
  });
});
