import { describe, expect, it } from 'vitest';
import { dropRetiredDoorSwing } from './retired-door-swing';
import { migrateStoredTab } from './stored-tab';

const door = { id: 'd', type: 'shape', shape: 'door', x: 0, y: 0, width: 96, height: 24 };

describe('dropRetiredDoorSwing', () => {
  it('hands back the same tab when no door carries a swing', () => {
    const tab = { elements: [door] };
    expect(dropRetiredDoorSwing(tab)).toBe(tab);
    const bare = { name: 'T' };
    expect(dropRetiredDoorSwing(bare)).toBe(bare);
  });

  it('drops doorClosed, shut or open, so a door saved shut loads as an ordinary door', () => {
    const tab = {
      elements: [
        { ...door, doorClosed: true },
        { ...door, id: 'e', doorClosed: false },
      ],
    };
    const out = dropRetiredDoorSwing(tab);
    expect(out.elements).toEqual([door, { ...door, id: 'e' }]);
    expect(tab.elements[0]).toHaveProperty('doorClosed', true);
  });

  it('runs with the stored-tab migration', () => {
    const tab = { theme: 'default', elements: [{ ...door, doorClosed: true }] };
    const out = migrateStoredTab(tab as never) as { elements: object[] };
    expect(out.elements[0]).not.toHaveProperty('doorClosed');
  });
});
