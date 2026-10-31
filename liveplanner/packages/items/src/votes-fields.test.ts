import { describe, expect, it } from 'vitest';
import { tallyFieldOn, votesFieldsAcross, votesFieldsOf } from './comments-votes-fields';
import { validateFields } from './fields';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { canBeRequired } from './required-fields';
import { defaultCatalogue, detailFieldsOf, tabsOf } from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';

// docs/specs/026-plan/item-types.md "Comments and Votes fields" and docs/specs/012-collaboration/session-tools.md
// "Count In": a type's Votes fields, the one a tally lands in, and what a vote can count in.

const type = (fields: string[], custom: ItemTypeDef['custom'] = []) => ({ fields, custom });
const PRIORITY = { id: 'f-pri', label: 'Priority Vote', kind: 'votes' as const };
const RISK = { id: 'f-risk', label: 'Risk Vote', kind: 'votes' as const };

describe('Votes fields', () => {
  it('lists a type’s Votes fields in its order, the built-in among them', () => {
    expect(votesFieldsOf(type(['title', 'f-pri', 'votes'], [PRIORITY]))).toEqual([
      'f-pri',
      'votes',
    ]);
    // A field taken off the type is not offered.
    expect(votesFieldsOf(type(['title'], [PRIORITY]))).toEqual([]);
  });

  it('lands a tally in the vote’s field while the type offers it, else in the built-in', () => {
    const t = type(['votes', 'f-pri'], [PRIORITY]);
    expect(tallyFieldOn(t, 'f-pri')).toBe('f-pri');
    expect(tallyFieldOn(t, undefined)).toBe('votes');
    expect(tallyFieldOn(t, 'f-risk')).toBe('votes');
    expect(tallyFieldOn(type(['title']), 'f-pri')).toBe('votes');
  });

  it('offers the built-in first, then each type’s own once', () => {
    expect(
      votesFieldsAcross([
        type(['f-pri', 'votes'], [PRIORITY]),
        type(['f-risk', 'f-pri'], [RISK, PRIORITY]),
      ]),
    ).toEqual(['votes', 'f-pri', 'f-risk']);
    expect(votesFieldsAcross([type(['votes'])])).toEqual(['votes']);
    expect(votesFieldsAcross([])).toEqual(['votes']);
  });

  it('keeps a Votes field on the card, never in the panel’s Details or a tab', () => {
    const t: ItemTypeDef = {
      ...ITEM_TYPES[1],
      fields: ['title', 'status', 'votes', 'f-pri', 'due'],
      custom: [PRIORITY],
      tabs: [{ id: 't-more', label: 'More', fields: ['f-pri', 'due'] }],
    };
    expect(tabsOf(t)[0]!.fields).toEqual(['due']);
    expect(detailFieldsOf(t)).toEqual(['status']);
  });

  it('is added by change_card_types as any kind is', () => {
    const changed = applyCardTypeChanges(
      defaultCatalogue(),
      [
        {
          op: 'add',
          name: 'Review',
          custom: [
            { name: 'Priority Vote', kind: 'votes' },
            { name: 'Design Review', kind: 'Comments' },
          ],
        },
      ],
      [],
    );
    if (!changed.ok) throw new Error(changed.message);
    expect(changed.catalogue!.types.at(-1)!.custom).toMatchObject([
      { label: 'Priority Vote', kind: 'votes' },
      { label: 'Design Review', kind: 'comments' },
    ]);
  });

  it('never takes a Votes value from a write, and is never required', () => {
    expect(validateFields({ 'f-pri': { p1: 2 } }, 'patch')).toMatchObject({
      ok: false,
      error: 'field_value_invalid',
      field: 'f-pri',
    });
    expect(validateFields({ votes: { p1: 2 } }, 'patch')).toMatchObject({
      ok: false,
      error: 'votes_read_only',
    });
    // A card made again carries them across, as it carries the built-in's; nothing else that looks like them.
    expect(validateFields({ title: 'A', 'f-pri': { p1: 2 } }, 'create')).toEqual({
      ok: true,
      fields: { title: 'A', 'f-pri': { p1: 2 } },
    });
    for (const bad of [{}, { p1: 0 }, { p1: 'x' }])
      expect(validateFields({ title: 'A', 'f-pri': bad }, 'create')).toMatchObject({ ok: false });
    expect(canBeRequired('votes')).toBe(false);
    expect(canBeRequired('comments')).toBe(false);
  });
});
