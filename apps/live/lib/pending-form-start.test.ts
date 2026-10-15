// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasPendingFormStart,
  markPendingFormStart,
  takePendingFormStart,
} from './pending-form-start';

// A form template's starter waits for the editor (docs/specs/030-forms/forms.md "Starting a form").

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('pending form start', () => {
  it('holds the starter for its tab until it is taken, once', () => {
    markPendingFormStart('t1', 'rsvp');
    expect(hasPendingFormStart('t1')).toBe(true);
    expect(hasPendingFormStart('t2')).toBe(false);
    expect(takePendingFormStart('t1')).toBe('rsvp');
    expect(takePendingFormStart('t1')).toBeNull();
    expect(hasPendingFormStart('t1')).toBe(false);
  });

  it('survives the page load /new hands over with', () => {
    sessionStorage.setItem('livediagram:pending-form-start:t3', 'feedback');
    expect(hasPendingFormStart('t3')).toBe(true);
    expect(takePendingFormStart('t3')).toBe('feedback');
  });

  it('keeps a memory copy when storage is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    markPendingFormStart('t4', 'contact');
    expect(hasPendingFormStart('t4')).toBe(true);
    expect(takePendingFormStart('t4')).toBe('contact');
    expect(hasPendingFormStart('t5')).toBe(false);
  });
});
