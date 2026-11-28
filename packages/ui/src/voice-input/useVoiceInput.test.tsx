// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSpeech, installFakeSpeech, lastSpeech, removeFakeSpeech } from './fake-speech';
import { useVoiceInput, type VoiceInputOptions } from './useVoiceInput';

// voice-input.md "How it behaves": the hook over a fake recognizer, the host's field value held in a variable the
// way a host's state would hold it.
function host(initial = '', extra: Partial<VoiceInputOptions> = {}) {
  let value = initial;
  const onText = vi.fn((next: string) => {
    value = next;
  });
  const view = renderHook((props: Partial<VoiceInputOptions>) =>
    useVoiceInput({ value, onText, ...extra, ...props }),
  );
  const rerender = (props: Partial<VoiceInputOptions> = {}) => view.rerender({ value, ...props });
  return {
    view,
    onText,
    rerender,
    get value() {
      return value;
    },
    set value(v: string) {
      value = v;
    },
  };
}

beforeEach(() => installFakeSpeech('webkitSpeechRecognition'));
afterEach(() => removeFakeSpeech());

describe('useVoiceInput', () => {
  it('is unsupported where the browser has no speech recognition', () => {
    removeFakeSpeech();
    const h = host();
    expect(h.view.result.current.supported).toBe(false);
    act(() => h.view.result.current.toggle());
    expect(FakeSpeech.made).toHaveLength(0);
    expect(h.view.result.current.listening).toBe(false);
  });

  it('finds the unprefixed constructor too', () => {
    removeFakeSpeech();
    installFakeSpeech('SpeechRecognition');
    expect(host().view.result.current.supported).toBe(true);
  });

  it('listens in the page language, with live results', () => {
    document.documentElement.lang = 'en-GB';
    const h = host();
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    expect(r.started).toBe(true);
    expect(r.lang).toBe('en-GB');
    expect(r.interimResults).toBe(true);
    expect(r.continuous).toBe(true);
    expect(h.view.result.current.listening).toBe(true);
    expect(h.view.result.current.status).toBe('Listening');
    expect(h.view.result.current.placeholder('Ask')).toBe('Listening…');
    document.documentElement.lang = '';
  });

  it('writes interim words, then replaces them with the final ones, after the words already there', () => {
    const h = host('Plan');
    act(() => h.view.result.current.toggle());
    act(() => lastSpeech().hear(['a launch', false]));
    expect(h.onText).toHaveBeenLastCalledWith('Plan a launch');
    h.rerender();
    act(() => lastSpeech().hear(['a launch', true], [' with three', false]));
    expect(h.onText).toHaveBeenLastCalledWith('Plan a launch with three');
    h.rerender();
    // Safari's pieces come without the space between them.
    act(() => lastSpeech().hear(['a launch', true], ['lanes', true]));
    expect(h.onText).toHaveBeenLastCalledWith('Plan a launch lanes');
    expect(h.view.result.current.placeholder('Ask')).toBe('Ask');
  });

  it('keeps to the field limit and skips empty pieces', () => {
    const h = host('', { max: 5 });
    act(() => h.view.result.current.toggle());
    act(() => lastSpeech().hear(['', false], ['hello world', false]));
    expect(h.onText).toHaveBeenLastCalledWith('hello');
  });

  it('a second press stops and keeps the last words, then puts the caret at the end', () => {
    const field: RefObject<HTMLTextAreaElement | null> = createRef<HTMLTextAreaElement>();
    const el = document.createElement('textarea');
    document.body.append(el);
    field.current = el;
    const h = host('', { field });
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    act(() => h.view.result.current.toggle());
    expect(r.stopped).toBe(true);
    expect(h.view.result.current.listening).toBe(false);
    expect(h.view.result.current.status).toBe('Stopped listening');
    act(() => r.hear(['done', true]));
    expect(h.onText).toHaveBeenLastCalledWith('done');
    el.value = 'done';
    act(() => r.end());
    expect(document.activeElement).toBe(el);
    expect(el.selectionStart).toBe(4);
    el.remove();
  });

  it('a press while the last session is still ending listens afresh', () => {
    const h = host();
    act(() => h.view.result.current.toggle());
    const first = lastSpeech();
    act(() => h.view.result.current.stop());
    act(() => h.view.result.current.toggle());
    expect(first.aborted).toBe(true);
    expect(FakeSpeech.made).toHaveLength(2);
    expect(h.view.result.current.listening).toBe(true);
    // The first one's end is not heard any more.
    act(() => first.end());
    expect(h.view.result.current.listening).toBe(true);
  });

  it('ends by itself after silence', () => {
    const h = host();
    act(() => h.view.result.current.toggle());
    act(() => lastSpeech().end());
    expect(h.view.result.current.listening).toBe(false);
  });

  it('Escape stops it and nothing behind it hears the key', () => {
    const h = host();
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(r.stopped).toBe(true);
    expect(behind).not.toHaveBeenCalled();
    expect(h.view.result.current.listening).toBe(false);
    document.removeEventListener('keydown', behind);
  });

  it('typing or sending stops it without writing over the field', () => {
    const h = host('');
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    act(() => r.hear(['hello', false]));
    h.rerender();
    expect(r.aborted).toBe(false);
    h.value = '';
    h.rerender();
    expect(r.aborted).toBe(true);
    expect(h.view.result.current.listening).toBe(false);
    expect(r.onresult).toBeNull();
  });

  it('a result after the field changed under it stops instead of writing', () => {
    const h = host('');
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    const onresult = r.onresult!;
    h.value = 'typed';
    // The result lands before the effect that would stop it has run.
    h.view.rerender({ value: 'typed', onText: h.onText });
    act(() =>
      onresult({
        results: Object.assign([{ isFinal: false, 0: { transcript: 'x' } }], { length: 1 }),
      }),
    );
    expect(h.onText).not.toHaveBeenCalled();
  });

  it('a busy field stops it and disables it', () => {
    const h = host();
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    h.rerender({ disabled: true });
    expect(r.aborted).toBe(true);
    expect(h.view.result.current.disabled).toBe(true);
  });

  it('a blocked microphone leaves the denied note, cleared by the next try', () => {
    const h = host();
    act(() => h.view.result.current.toggle());
    act(() => lastSpeech().fail('not-allowed'));
    act(() => lastSpeech().end());
    expect(h.view.result.current.note).toBe('denied');
    act(() => h.view.result.current.toggle());
    expect(h.view.result.current.note).toBeNull();
  });

  it('an abort says nothing', () => {
    const h = host();
    act(() => h.view.result.current.toggle());
    act(() => lastSpeech().fail('aborted'));
    expect(h.view.result.current.note).toBeNull();
  });

  it('a start the browser refuses says it failed', () => {
    FakeSpeech.failStart = true;
    const h = host();
    act(() => h.view.result.current.toggle());
    expect(h.view.result.current.listening).toBe(false);
    expect(h.view.result.current.note).toBe('failed');
  });

  it('lets the microphone go on unmount', () => {
    const h = host();
    act(() => h.view.result.current.toggle());
    const r = lastSpeech();
    h.view.unmount();
    expect(r.aborted).toBe(true);
  });

  it('unmounting while idle does nothing', () => {
    const h = host();
    h.view.unmount();
    expect(FakeSpeech.made).toHaveLength(0);
  });

  it('stop and cancel are safe when idle', () => {
    const h = host();
    act(() => h.view.result.current.stop());
    h.rerender({ disabled: true });
    expect(h.view.result.current.listening).toBe(false);
  });
});
