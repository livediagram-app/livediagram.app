// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type CustomFieldDef, type Item, type ItemTypeDef } from '@liveplanner/items';
import { CustomFieldEditor } from './CustomFieldEditor';
import { CUSTOM_KIND_LABELS } from './ItemTypeFieldForms';
import { KIND_DESCRIPTIONS, categoryOfKind } from './add-field-kinds';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';

// The Pull Request field (docs/specs/026-plan/github-pull-requests.md "The Pull Request field"): the card panel's
// address box for each share role (an Editor and a Participant edit it, a Viewer reads it and still opens it on
// GitHub), its place in Add Field, and the card face's short name.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const PR: CustomFieldDef = { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' };
const CANONICAL = 'https://github.com/acme/web/pull/42';

const ROLES = [
  { role: 'Editor', disabled: false },
  { role: 'Participant', disabled: false },
  { role: 'Viewer', disabled: true },
] as const;

function panel(value: unknown, disabled = false) {
  const onSave = vi.fn();
  render(
    <CustomFieldEditor
      id="f"
      field={PR}
      value={value as never}
      disabled={disabled}
      onSave={onSave}
    />,
  );
  const input = document.querySelector<HTMLInputElement>('input[type=url]')!;
  return { onSave, input };
}

describe('a Pull Request in the card panel', () => {
  it('saves any address of a pull request as its canonical one', () => {
    const { onSave, input } = panel(undefined);
    expect(input.placeholder).toBe('https://github.com/owner/repo/pull/123');
    expect(input.inputMode).toBe('url');
    fireEvent.blur(input, { target: { value: ' github.com/acme/web/pull/42/files ' } });
    expect(onSave).toHaveBeenLastCalledWith(CANONICAL);
  });

  it('puts back a paste that names no pull request, saves nothing for the same one, and clears', () => {
    const { onSave, input } = panel(CANONICAL);
    fireEvent.blur(input, { target: { value: 'https://example.com/pull/1' } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input, { target: { value: 'http://www.github.com/acme/web/pull/42' } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input, { target: { value: CANONICAL } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input, { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('opens the pull request on GitHub in a new tab, with no referrer', () => {
    panel(CANONICAL);
    const open = screen.getByRole('link', {
      name: 'Open acme/web#42 on GitHub (opens in a new tab)',
    });
    expect(open.getAttribute('href')).toBe(CANONICAL);
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('has no Open button while it holds no pull request', () => {
    panel('not an address');
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('the Open link', () => {
  it.each(['javascript:alert(1)', 'https://example.com/acme/web/pull/42', 'data:text/html,x'])(
    'is not offered for %s',
    (value) => {
      panel(value);
      expect(screen.queryByRole('link')).toBeNull();
    },
  );
});

describe.each(ROLES)('for a $role', ({ disabled }) => {
  it(disabled ? 'reads it and still opens it' : 'edits it', () => {
    const { input } = panel(CANONICAL, disabled);
    expect(input.disabled).toBe(disabled);
    expect(screen.getByRole('link', { name: /^Open acme\/web#42 on GitHub/ })).toBeTruthy();
  });
});

describe('Add Field', () => {
  it('offers Pull Request after Link, under Links and Images, in the spec’s words', () => {
    expect(CUSTOM_KIND_LABELS.pullrequest).toBe('Pull Request');
    expect(KIND_DESCRIPTIONS.pullrequest).toBe('A GitHub pull request, with its state');
    const links = categoryOfKind('pullrequest');
    expect(links.label).toBe('Links and Images');
    expect(links.kinds.indexOf('pullrequest')).toBe(links.kinds.indexOf('link') + 1);
  });
});

describe('the card face', () => {
  it('reads the pull request by its short name', () => {
    const by = { id: 'p', name: 'Sam', color: '#000000' };
    const task: ItemTypeDef = {
      ...ITEM_TYPES[0],
      id: 'task',
      fields: ['title', 'status', 'f-pr'],
      custom: [PR],
      display: { detailed: { body: ['f-pr'] } },
    };
    const item: Item = {
      id: 'c',
      type: 'task',
      key: 1,
      rank: 'i',
      fields: { title: 'Ship it', 'f-pr': CANONICAL },
      rev: 1,
      createdAt: 0,
      updatedAt: 0,
      createdBy: by,
      updatedBy: by,
    };
    render(
      <PlanCardFace item={item} palette={planPalette('light')} fields={[]} typeOverride={task} />,
    );
    expect(screen.getByText('Pull Request: acme/web#42')).toBeTruthy();
  });
});
