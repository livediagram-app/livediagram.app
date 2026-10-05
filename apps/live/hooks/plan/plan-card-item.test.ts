import { describe, expect, it } from 'vitest';
import { newCardItemWrite } from './plan-card-item';

describe('newCardItemWrite', () => {
  it('makes an item of the tile type with its new title, under the card id', () => {
    expect(newCardItemWrite('cardid1', 'bug')).toEqual({
      kind: 'create',
      creates: [{ id: 'cardid1', type: 'bug', fields: { title: 'New bug' } }],
    });
    expect(
      newCardItemWrite('cardid2', undefined).kind === 'create' &&
        newCardItemWrite('cardid2', 'zzz'),
    ).toMatchObject({
      creates: [{ type: 'task', fields: { title: 'New task' } }],
    });
  });
});
