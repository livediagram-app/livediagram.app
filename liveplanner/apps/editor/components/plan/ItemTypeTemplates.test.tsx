// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CARD_TEMPLATES_MAX,
  ITEM_TYPES,
  type CardTemplate,
  type ItemTypeDef,
} from '@liveplanner/items';
import { ItemTypeEditor } from './ItemTypeEditor';

// docs/specs/026-plan/item-types.md "Editing a type": the Templates tab, where an Editor adds, renames, edits, moves
// and removes a type's card templates as part of the type's draft.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  color: '#dc2626',
  glyph: 'task',
  fields: ['title', 'status', 'description', 'checklist', 'labels', 'due', 'f-browser', 'f-score'],
  custom: [
    { id: 'f-browser', label: 'Browser', kind: 'text' },
    { id: 'f-score', label: 'Score', kind: 'calculated', calculation: 'childCount' },
  ],
};
const REPORT: CardTemplate = {
  id: 'tp-bug-report',
  name: 'Bug Report',
  fields: { title: 'Bug', 'f-browser': 'Firefox' },
};
const RELEASE: CardTemplate = { id: 'tp-release', name: 'Release', fields: {} };

function open(type: ItemTypeDef, extra: Record<string, unknown> = {}, others: ItemTypeDef[] = []) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { types: [type], items: new Map(), statusNames: new Map(), ...extra });
  const onSave = vi.fn();
  render(
    <ItemTypeEditor
      type={type}
      types={[type, ...others]}
      itemCount={0}
      onSave={onSave}
      onDelete={() => {}}
      onClose={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('tab', { name: /^Templates/ }));
  return onSave;
}
const save = (onSave: ReturnType<typeof vi.fn>) => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  return onSave.mock.lastCall![0] as ItemTypeDef;
};
const nameField = () => screen.getByLabelText<HTMLInputElement>('Name');
const templatesTab = () => screen.getByRole('tab', { name: /Templates/ });

describe('the Templates tab', () => {
  it('starts empty with a way to add one, which is chosen with its name selected', () => {
    const onSave = open(BUG);
    expect(screen.getByText('No Templates Yet')).toBeTruthy();
    expect(
      screen.getByText(
        'A template fills in a new Bug card: its title, description, checklist, labels and fields.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New Template' }));
    expect(nameField().value).toBe('New Template');
    expect(document.activeElement).toBe(nameField());
    expect(
      within(screen.getByRole('list', { name: 'Templates' }))
        .getByRole('button', { name: 'New Template' })
        .getAttribute('aria-current'),
    ).toBe('true');
    // Its id is made from its name at Save.
    fireEvent.change(nameField(), { target: { value: 'Crash Report' } });
    expect(save(onSave).templates).toEqual([
      { id: 'tp-crash-report', name: 'Crash Report', fields: {} },
    ]);
  });

  it('shows the card’s own fields a template holds, never the rest', () => {
    open({ ...BUG, templates: [REPORT] });
    const panel = screen.getByRole('tabpanel');
    for (const name of ['Title', 'Description', 'Checklist', 'Fields']) {
      expect(within(panel).getByText(name)).toBeTruthy();
    }
    expect(within(panel).getByLabelText('Browser')).toBeTruthy();
    expect(within(panel).queryByText('Due')).toBeNull();
    expect(within(panel).queryByText('Score')).toBeNull();
    expect(within(panel).getByLabelText<HTMLTextAreaElement>('Title').placeholder).toBe('New bug');
    expect(
      within(panel).getByText(
        'A card started from it takes its state and place from where it is made.',
      ),
    ).toBeTruthy();
  });

  it('writes the title and a custom field into the template, saved with the type', () => {
    const onSave = open({ ...BUG, templates: [REPORT] });
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Crash' } });
    fireEvent.blur(title);
    const browser = screen.getByLabelText('Browser');
    fireEvent.change(browser, { target: { value: 'Safari' } });
    fireEvent.blur(browser);
    expect(save(onSave).templates).toEqual([
      { ...REPORT, fields: { title: 'Crash', 'f-browser': 'Safari' } },
    ]);
  });

  it('clears the title when it is emptied, so a card takes the type’s', () => {
    const onSave = open({ ...BUG, templates: [REPORT] });
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: '' } });
    fireEvent.blur(title);
    expect(save(onSave).templates![0]!.fields).toEqual({ 'f-browser': 'Firefox' });
  });

  it('chooses, moves and removes templates from each row’s menu', () => {
    const onSave = open({ ...BUG, templates: [REPORT, RELEASE] });
    const list = screen.getByRole('list', { name: 'Templates' });
    fireEvent.click(within(list).getByRole('button', { name: 'Release' }));
    expect(nameField().value).toBe('Release');
    fireEvent.click(within(list).getByRole('button', { name: 'More for Release' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Up' }));
    expect(
      within(list)
        .getAllByRole('button', { name: /^(Bug Report|Release)$/ })
        .map((b) => b.textContent),
    ).toEqual(['Release', 'Bug Report']);
    fireEvent.click(within(list).getByRole('button', { name: 'More for Release' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    // The next one is chosen.
    expect(nameField().value).toBe('Bug Report');
    expect(save(onSave).templates).toEqual([REPORT]);
  });

  it('moves down too, and removing one not chosen keeps the choice', () => {
    const onSave = open({ ...BUG, templates: [REPORT, RELEASE] });
    const list = screen.getByRole('list', { name: 'Templates' });
    fireEvent.click(within(list).getByRole('button', { name: 'More for Bug Report' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Down' }));
    fireEvent.click(within(list).getByRole('button', { name: 'More for Release' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(nameField().value).toBe('Bug Report');
    // The last one removed leaves the type with none.
    fireEvent.click(within(list).getByRole('button', { name: 'More for Bug Report' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(screen.getByText('No Templates Yet')).toBeTruthy();
    expect(save(onSave).templates).toBeUndefined();
  });

  it('stops Save on a blank or clashing name, said under it, over the editor and by the tab', () => {
    open({ ...BUG, templates: [REPORT, RELEASE] });
    fireEvent.change(nameField(), { target: { value: ' ' } });
    expect(screen.getByText('Give the template a name.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Give every template a name.');
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    expect(within(templatesTab()).getByRole('img', { name: 'Needs attention' })).toBeTruthy();
    fireEvent.change(nameField(), { target: { value: 'release' } });
    expect(screen.getByText('Another template has this name.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Two templates have the same name.');
    // The list never shows a blank row.
    fireEvent.change(nameField(), { target: { value: '' } });
    expect(
      within(screen.getByRole('list', { name: 'Templates' })).getByRole('button', {
        name: 'Untitled',
      }),
    ).toBeTruthy();
  });

  it('says a template past 16 KB, and the plan’s templates past 128 KB', () => {
    const big = { ...RELEASE, fields: { description: 'x'.repeat(17_000) } };
    open({ ...BUG, templates: [big] });
    expect(screen.getByRole('alert').textContent).toBe(
      'Release holds more than 16 KB: shorten it.',
    );
    cleanup();
    const heavy = (n: number): CardTemplate => ({
      id: `tp-h${n}`,
      name: `H${n}`,
      fields: { description: 'y'.repeat(9_500) },
    });
    const other: ItemTypeDef = {
      ...ITEM_TYPES[2],
      fields: [...ITEM_TYPES[2].fields],
      templates: Array.from({ length: 10 }, (_, i) => heavy(i)),
    };
    const third: ItemTypeDef = {
      ...ITEM_TYPES[3],
      fields: [...ITEM_TYPES[3].fields],
      templates: Array.from({ length: 4 }, (_, i) => heavy(i)),
    };
    open({ ...BUG, templates: [REPORT] }, {}, [other, third]);
    expect(screen.getByRole('alert').textContent).toBe(
      'The plan’s card templates hold more than 128 KB: shorten or remove one.',
    );
  });

  it('says a stored template value past a card’s limit', () => {
    open({ ...BUG, templates: [{ ...REPORT, fields: { title: 'x'.repeat(600) } }] });
    expect(screen.getByRole('alert').textContent).toBe(
      'A template’s values break a card’s limits.',
    );
  });

  it('offers no New Template at the cap, and says why', () => {
    const full = Array.from({ length: CARD_TEMPLATES_MAX }, (_, i) => ({
      id: `tp-t${i}`,
      name: `T${i}`,
      fields: {},
    }));
    open({ ...BUG, templates: full });
    const add = screen.getByRole('button', { name: 'New Template' });
    expect(add.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText(`A card type holds up to ${CARD_TEMPLATES_MAX} templates.`),
    ).toBeTruthy();
  });

  it('gives a row its name as a tooltip only when the row cuts the name off', () => {
    open({ ...BUG, templates: [REPORT] });
    const row = () =>
      within(screen.getByRole('list', { name: 'Templates' })).getByRole('button', {
        name: 'Bug Report',
      });
    // jsdom lays nothing out, so the name fits: no tooltip wrapper.
    expect(row().parentElement!.className).not.toBe('contents');
    cleanup();
    const wide = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    const box = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(120);
    try {
      open({ ...BUG, templates: [REPORT] });
      expect(row().parentElement!.className).toBe('contents');
    } finally {
      wide.mockRestore();
      box.mockRestore();
    }
  });

  it('only reads for someone who may not change card types', () => {
    open({ ...BUG, templates: [REPORT] }, { canEdit: false });
    expect(screen.queryByRole('button', { name: 'New Template' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More for Bug Report' })).toBeNull();
    expect(nameField().disabled).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Title').disabled).toBe(true);
    cleanup();
    open(BUG, { canEdit: false });
    expect(screen.getByText('No Templates Yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Template' })).toBeNull();
  });
});
