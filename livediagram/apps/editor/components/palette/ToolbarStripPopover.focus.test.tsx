// @vitest-environment jsdom
// docs/specs/007-editor/toolbar-layout.md "Search": Escape closes a strip popover and hands the focus back to the
// button that opened it; a press elsewhere leaves focus where the press put it. Escape out of Search dropped focus on
// the page.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStripPopover } from './ToolbarStripPopover';

afterEach(() => {
  document.body.innerHTML = '';
});

function setup() {
  const root = document.createElement('div');
  const button = document.createElement('button');
  button.setAttribute('data-test-button', '');
  const popover = document.createElement('div');
  popover.setAttribute('data-test-popover', '');
  const field = document.createElement('input');
  popover.append(field);
  const canvas = document.createElement('button');
  root.append(button, popover, canvas);
  document.body.append(root);
  const hook = renderHook(() =>
    useStripPopover({ current: root }, '[data-test-popover], [data-test-button]'),
  );
  act(() => hook.result.current.openFrom(button));
  field.focus();
  return { hook, button, field, canvas };
}

describe('a strip popover’s focus', () => {
  it('goes back to its button on Escape', () => {
    const { hook, button } = setup();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(hook.result.current.open).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('stays where a press outside put it', () => {
    const { hook, canvas } = setup();
    canvas.focus();
    act(() => {
      canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(hook.result.current.open).toBe(false);
    expect(document.activeElement).toBe(canvas);
  });
});
