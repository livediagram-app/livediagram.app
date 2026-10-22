// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refocusAfterField } from './refocus-after-field';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('refocusAfterField', () => {
  it('gives focus back to the control in the field’s place, without a focus ring', () => {
    // A renamed tab was left with the browser's focus ring drawn round it, a bubble over the tab.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const host = document.createElement('div');
    const field = document.createElement('input');
    const tab = document.createElement('button');
    host.append(tab, field);
    document.body.append(host);
    const focus = vi.spyOn(tab, 'focus');
    refocusAfterField(field);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });
  });

  it('leaves focus alone when something already has it', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const host = document.createElement('div');
    const field = document.createElement('input');
    const tab = document.createElement('button');
    const other = document.createElement('button');
    host.append(tab, field);
    document.body.append(host, other);
    other.focus();
    const focus = vi.spyOn(tab, 'focus');
    refocusAfterField(field);
    expect(focus).not.toHaveBeenCalled();
  });
});
