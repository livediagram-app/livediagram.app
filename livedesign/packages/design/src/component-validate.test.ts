import { describe, expect, it } from 'vitest';
import {
  componentWithinBytes,
  isValidComponentPatch,
  isValidDesignComponent,
} from './component-validate';
import { isComponentOverride, isComponentOverrides } from './component-fields';
import { MAX_COMPONENT_OVERRIDES } from './components';
import { box, instanceOf, navMain } from './components.test.fixtures';
import { isValidElement, isValidTab } from './validate';

describe('isValidDesignComponent', () => {
  it('accepts a main and refuses each broken part', () => {
    const main = navMain();
    expect(isValidDesignComponent(main)).toBe(true);
    expect(isValidDesignComponent({ ...main, archived: true })).toBe(true);
    expect(isValidDesignComponent(null)).toBe(false);
    expect(isValidDesignComponent({ ...main, id: 'a/b' })).toBe(false);
    expect(isValidDesignComponent({ ...main, name: '  ' })).toBe(false);
    expect(isValidDesignComponent({ ...main, width: 0 })).toBe(false);
    expect(isValidDesignComponent({ ...main, height: Number.NaN })).toBe(false);
    expect(isValidDesignComponent({ ...main, updatedAt: 'x' })).toBe(false);
    expect(isValidDesignComponent({ ...main, archived: 'yes' })).toBe(false);
    expect(isValidDesignComponent({ ...main, elements: 'x' })).toBe(false);
    expect(isValidDesignComponent({ ...main, elements: [instanceOf(main)] })).toBe(false);
    expect(isValidDesignComponent({ ...main, elements: [box('a', 0, 0), box('a', 1, 1)] })).toBe(
      false,
    );
    expect(
      isValidDesignComponent({
        ...main,
        elements: [box('a', 0, 0, 1, 1, { componentMember: { instanceId: 'i', elementId: 'a' } })],
      }),
    ).toBe(false);
    expect(componentWithinBytes(main)).toBe(true);
    expect(componentWithinBytes({ ...main, name: 'x'.repeat(300_000) })).toBe(false);
  });
});

describe('isValidComponentPatch', () => {
  it('accepts known keys of the right shape only', () => {
    expect(
      isValidComponentPatch({
        name: 'A',
        archived: false,
        upsert: [box('a', 0, 0)],
        remove: ['b'],
        order: ['a'],
      }),
    ).toBe(true);
    expect(isValidComponentPatch(null)).toBe(false);
    expect(isValidComponentPatch({ extra: 1 })).toBe(false);
    expect(isValidComponentPatch({ name: '' })).toBe(false);
    expect(isValidComponentPatch({ archived: 1 })).toBe(false);
    expect(isValidComponentPatch({ upsert: [{}] })).toBe(false);
    expect(isValidComponentPatch({ remove: [1] })).toBe(false);
    expect(isValidComponentPatch({ order: 'a' })).toBe(false);
  });
});

describe('instance and member fields on elements', () => {
  it('checks an instance and a member mark like any field', () => {
    const inst = instanceOf(navMain(), {
      componentOverrides: { brand: { label: 'Hi', fillColor: '#fff', iconId: 'home' } },
      componentEditBy: 'me',
    });
    expect(isValidElement(inst)).toBe(true);
    expect(isValidElement({ ...inst, componentId: '' })).toBe(false);
    expect(isValidElement({ ...inst, componentOverrides: { brand: { what: 1 } } })).toBe(false);
    expect(isValidElement({ ...inst, componentEditBy: '' })).toBe(false);
    expect(
      isValidElement(
        box('a', 0, 0, 1, 1, { componentMember: { instanceId: 'i', elementId: 'a' } }),
      ),
    ).toBe(true);
    expect(isValidElement(box('a', 0, 0, 1, 1, { componentMember: { instanceId: 'i' } }))).toBe(
      false,
    );
    expect(isValidTab({ id: 't', name: 'T', elements: [inst] })).toBe(true);
  });

  it('bounds overrides', () => {
    expect(isComponentOverride('x')).toBe(false);
    expect(isComponentOverride({ label: 1 })).toBe(false);
    expect(isComponentOverride({ iconId: 'x'.repeat(500) })).toBe(false);
    expect(isComponentOverride({ textColor: 'x'.repeat(65) })).toBe(false);
    expect(isComponentOverrides('x')).toBe(false);
    const many = Object.fromEntries(
      Array.from({ length: MAX_COMPONENT_OVERRIDES + 1 }, (_, i) => [`e${i}`, {}]),
    );
    expect(isComponentOverrides(many)).toBe(false);
    expect(isComponentOverrides({ '': {} })).toBe(false);
  });
});
