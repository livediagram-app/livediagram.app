// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import {
  askNameCard,
  closeNameCard,
  nameCardAsked,
  nameChoiceViews,
  resetNameCardForTests,
  useNameCardAsked,
} from './name-card';

// liveworkspace/docs/specs/011-workbench/first-edit.md "A visitor's name": the card opens only from Change Name.

afterEach(() => resetNameCardForTests());

describe('the name card store', () => {
  it('opens on Change Name and closes on an answer, telling its readers each time', () => {
    const { result } = renderHook(() => useNameCardAsked());
    expect(result.current).toBe(false);
    act(() => askNameCard());
    expect(result.current).toBe(true);
    expect(nameCardAsked()).toBe(true);
    act(() => closeNameCard());
    expect(result.current).toBe(false);
  });

  it('ignores a second press or a close with nothing open', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useNameCardAsked();
    });
    const first = renders;
    act(() => closeNameCard());
    expect(renders).toBe(first);
    act(() => askNameCard());
    const asked = renders;
    act(() => askNameCard());
    expect(renders).toBe(asked);
  });
});

describe('the name card on the server', () => {
  it('is closed in the prerendered page, whatever a press said', () => {
    askNameCard();
    const Probe = () => createElement('span', null, String(useNameCardAsked()));
    expect(renderToString(createElement(Probe))).toBe('<span>false</span>');
  });
});

describe('nameChoiceViews', () => {
  it('shows the tray for an offered name, and the card only once asked', () => {
    expect(nameChoiceViews(true, false)).toEqual({ card: false, tray: true });
    expect(nameChoiceViews(true, true)).toEqual({ card: true, tray: false });
  });

  it('shows neither when nothing is offered (an owner, a confirmed name, an embed)', () => {
    expect(nameChoiceViews(false, false)).toEqual({ card: false, tray: false });
    expect(nameChoiceViews(false, true)).toEqual({ card: false, tray: false });
  });
});
