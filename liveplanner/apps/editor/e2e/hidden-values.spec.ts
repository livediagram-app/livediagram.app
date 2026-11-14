import { defaultCatalogue, presetSetup, type ItemTypeDef } from '@liveplanner/items';
import { adoptGuest, dismissQuickTour, expect, mintGuest, seedPlan, test } from './fixtures';

// A card's Hidden tab, end to end (docs/specs/026-plan/item-types.md "The Hidden tab", Work Tracker 857): an Idea
// turned into a Work Item from its panel's type picker keeps its Solution, which the new Hidden tab shows From Idea;
// Copy To Field writes it into the Work Item's own field.

const IDEA: ItemTypeDef = {
  id: 'idea',
  label: 'Idea',
  newTitle: 'New idea',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'description', 'f-solution'],
  custom: [{ id: 'f-solution', label: 'Solution', kind: 'text' }],
};
const WORK: ItemTypeDef = {
  id: 'work',
  label: 'Work Item',
  newTitle: 'New work item',
  glyph: 'task',
  color: '#16a34a',
  fields: ['title', 'status', 'description', 'f-criteria'],
  custom: [{ id: 'f-criteria', label: 'Acceptance Criteria', kind: 'text' }],
};

// Every type: a board that names none takes them all.
const { addTypes: _brought, ...everyType } = presetSetup('kanban');

test('an Idea turned into a Work Item shows its Solution on the Hidden tab', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedPlan(page.request, owner, {
    id,
    name: 'Ideas',
    itemTypes: { ...defaultCatalogue(), types: [IDEA, WORK] },
    items: [
      {
        type: 'idea',
        fields: { title: 'Map fields', status: 'todo', 'f-solution': 'Map by name' },
        place: { status: 'todo' },
      },
    ],
    tabs: [
      {
        id: crypto.randomUUID(),
        name: 'Board',
        kind: 'board',
        elements: [
          {
            id: 'board',
            type: 'shape',
            shape: 'plan-board',
            x: 100,
            y: 100,
            width: 1100,
            height: 560,
            planBoard: everyType,
          },
        ],
      },
    ],
  });
  expect(seeded.ok(), `seed: ${seeded.status()}`).toBe(true);
  await adoptGuest(page.context(), owner);
  await page.addInitScript(() => {
    localStorage.setItem('liveplanner:v2:name-confirmed', '1');
    localStorage.setItem(
      'liveplanner:user-preferences:v1',
      JSON.stringify({ planTourSeen: true, planTourTracks: ['boards', 'sheets'] }),
    );
  });
  await page.goto(new URL(`/project/${id}`, baseURL).toString());
  await dismissQuickTour(page);

  const board = page.locator('[data-plan-board]').first();
  await board.locator('[data-plan-card]').filter({ hasText: 'Map fields' }).first().click();
  const panel = page.getByRole('dialog', { name: /^Item #/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('tab', { name: /^Hidden/ })).toHaveCount(0);

  await panel.getByLabel('Card Type').selectOption('work');
  const hidden = panel.getByRole('tab', { name: 'Hidden, 1 value' });
  await expect(hidden).toBeVisible();
  await hidden.click();
  const fromIdea = panel.getByRole('region', { name: 'From Idea' });
  await expect(fromIdea.getByText('Solution')).toBeVisible();
  await expect(fromIdea.locator('input').first()).toHaveValue('Map by name');

  // Copy To Field writes it into the Work Item's own field.
  await panel.getByRole('button', { name: 'Copy Solution to a field' }).click();
  await page.getByRole('menuitem', { name: 'Acceptance Criteria' }).click();
  // A Text field sits in Details, beside the tabs.
  await expect(panel.getByLabel('Acceptance Criteria')).toHaveValue('Map by name');
});
