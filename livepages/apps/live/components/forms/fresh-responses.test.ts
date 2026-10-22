// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { FROM_FORM_FIELD } from '@livepages/forms';
import {
  FRESH_OPENED_MAX,
  FRESH_RESPONSE_MS,
  isFreshResponse,
  markResponseOpened,
  resetFreshResponses,
} from './fresh-responses';

// docs/specs/030-forms/forms.md "Hearing about responses": a response's card is New for a week, until opened here.
const card = (id: string, extra: Record<string, unknown> = { [FROM_FORM_FIELD]: 'tab:3' }) => ({
  id,
  fields: extra as never,
  createdAt: 1_000,
});

beforeEach(() => {
  localStorage.clear();
  resetFreshResponses();
});

describe('a fresh response', () => {
  it('is a form response less than a week old and not opened', () => {
    expect(isFreshResponse(card('a'), 2_000)).toBe(true);
    expect(isFreshResponse(card('a', {}), 2_000)).toBe(false);
    expect(isFreshResponse(card('a'), 1_000 + FRESH_RESPONSE_MS + 1)).toBe(false);
  });

  it('stops being New once opened, and remembers across loads', () => {
    markResponseOpened(card('a'));
    expect(isFreshResponse(card('a'), 2_000)).toBe(false);
    resetFreshResponses();
    expect(isFreshResponse(card('a'), 2_000)).toBe(false);
    expect(isFreshResponse(card('b'), 2_000)).toBe(true);
  });

  it('ignores cards no form made, and keeps the newest ids only', () => {
    markResponseOpened(card('x', {}));
    expect(JSON.parse(localStorage.getItem('livepages:form-responses-opened') ?? '[]')).toEqual(
      [],
    );
    for (let i = 0; i <= FRESH_OPENED_MAX; i += 1) markResponseOpened(card(`c${i}`));
    markResponseOpened(card('c1'));
    const kept: unknown = JSON.parse(
      localStorage.getItem('livepages:form-responses-opened') ?? '[]',
    );
    expect(kept).toHaveLength(FRESH_OPENED_MAX);
    expect(kept).not.toContain('c0');
  });

  it('survives storage that throws', () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      resetFreshResponses();
      expect(isFreshResponse(card('a'), 2_000)).toBe(true);
    } finally {
      Storage.prototype.getItem = real;
    }
  });
});
