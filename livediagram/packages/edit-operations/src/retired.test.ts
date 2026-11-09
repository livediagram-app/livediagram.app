import { describe, expect, it } from 'vitest';
import { createShape, NEW_BUTTON_MODE, retiredKindRefusal, type Tab } from '@livediagram/document';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, refused } from './fixtures/outcomes';
import { run } from './fixtures/run';
import { applyReplace } from './replace';

// Retired elements (docs/specs/009-elements/retired-elements.md "Nothing new"): the Spaces and Avatar pieces moved to
// livehuddle. An agent can still move, resize or delete one a board already has, but never make one.
const withChair = (): Tab => {
  const tab = checkoutFlow();
  return { ...tab, elements: [...tab.elements, { ...createShape('chair', 900, 900), id: 'ch' }] };
};

describe('retired pieces in edit operations', () => {
  it('refuses to add a retired kind, saying where it went', () => {
    const rejection = refused(run('add sofa label=Lounge'));
    expect(rejection.details).toEqual([`kind="sofa": ${retiredKindRefusal('sofa')}`]);
  });

  it('refuses to turn an element into a retired kind, or a button into an Avatar one', () => {
    const turned = refused(run('set n3 shape=rug'));
    expect(turned.code).toBe('invalid_result');
    expect(turned.hint).toContain('livehuddle');
    expect(refused(run('add mode-button id=go mode=avatar')).details[0]).toContain('Avatar mode');
  });

  it('moves and relabels a retired piece the board already has', () => {
    const tab = withChair();
    const moved = applied(run('move ch by=20,0', tab));
    expect(moved.tab.elements.find((el) => el.id === 'ch')).toMatchObject({ x: 920 });
    applied(run('set ch label="Old seat"', tab));
  });
});

describe('retired pieces in a replace', () => {
  const options = { tabId: 'new-tab', name: 'Fresh', makeId: fixedIds() };

  it('keeps a retired piece the tab already holds', () => {
    const tab = withChair();
    applied(applyReplace(tab, { elements: tab.elements, layout: 'preserve' }, options));
  });

  it('refuses a new one', () => {
    const tab = checkoutFlow();
    const sofa = { ...createShape('sofa', 0, 0), id: 'new-sofa' };
    const rejection = refused(
      applyReplace(tab, { elements: [...tab.elements, sofa], layout: 'preserve' }, options),
    );
    expect(rejection.details).toEqual([`new-sofa: ${retiredKindRefusal('sofa')}`]);
  });

  it('gives a new Selection Mode button with no mode the new default', () => {
    const tab = checkoutFlow();
    const { mode: _drop, ...button } = { ...createShape('mode-button', 0, 0), id: 'btn' };
    const out = applied(
      applyReplace(tab, { elements: [...tab.elements, button], layout: 'preserve' }, options),
    );
    expect(out.tab.elements.find((el) => el.id === 'btn')).toMatchObject({ mode: NEW_BUTTON_MODE });
  });
});
