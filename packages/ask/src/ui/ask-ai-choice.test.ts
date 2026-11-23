// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_AI_CHOICE_KEY, askAiChoiceStore, useAskAiChoice } from './ask-ai-choice';

beforeEach(() => {
  localStorage.clear();
  askAiChoiceStore.reset();
});
afterEach(() => vi.restoreAllMocks());

describe('which AI answers, as the person chose', () => {
  it('is the key until they pick built-in AI, kept in this browser', () => {
    const { result } = renderHook(() => useAskAiChoice());
    expect(result.current).toBe('key');
    act(() => askAiChoiceStore.set('built-in'));
    expect(result.current).toBe('built-in');
    expect(localStorage.getItem(ASK_AI_CHOICE_KEY)).toBe('built-in');
    askAiChoiceStore.reset();
    expect(askAiChoiceStore.get()).toBe('built-in');
    // The same choice again tells nobody.
    const heard = vi.fn();
    const stop = askAiChoiceStore.subscribe(heard);
    askAiChoiceStore.set('built-in');
    expect(heard).not.toHaveBeenCalled();
    askAiChoiceStore.set('key');
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    askAiChoiceStore.set('built-in');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('reads an unknown value, and storage that throws, as the key', () => {
    localStorage.setItem(ASK_AI_CHOICE_KEY, 'nonsense');
    expect(askAiChoiceStore.get()).toBe('key');
    askAiChoiceStore.reset();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(askAiChoiceStore.get()).toBe('key');
    // A private window keeps the choice for this tab alone.
    askAiChoiceStore.set('built-in');
    expect(askAiChoiceStore.get()).toBe('built-in');
  });
});
