// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HINT_CLOSE_GRACE_MS,
  HINT_LONG_PRESS_MS,
  HINT_TOUCH_COMPAT_MS,
  HINT_TOUCH_LINGER_MS,
  PREVIEW_OPEN_DELAY_MS,
  PREVIEW_WARMUP_MS,
  TOOLTIP_OPEN_DELAY_MS,
  type HintKind,
} from './hint-constants';
import { resetHintRegistry } from './hint-registry';
import { resetTouches } from './input-modality';
import { useHint } from './useHint';

function Harness({
  kind,
  text,
  onClick,
  stopPresses,
  pressWithText,
}: {
  kind: HintKind;
  text?: string;
  onClick?: () => void;
  stopPresses?: boolean;
  pressWithText?: boolean;
}) {
  const { open, source, attach, triggerProps, surfaceProps } = useHint(kind, { pressWithText });
  return (
    <>
      <span data-testid="wrapper" ref={attach} {...triggerProps}>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={onClick}
          onPointerDown={stopPresses ? (e) => e.stopPropagation() : undefined}
          onPointerUp={stopPresses ? (e) => e.stopPropagation() : undefined}
        >
          {text ?? <svg aria-hidden="true" />}
        </button>
      </span>
      {open ? (
        <div role="tooltip" data-source={source ?? ''} {...surfaceProps}>
          Zoom in
        </div>
      ) : null}
    </>
  );
}

const wrapper = () => screen.getByTestId('wrapper');
const button = () => screen.getByRole('button');
const tip = () => screen.queryByRole('tooltip');
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const mouse = { pointerType: 'mouse' };
const touch = { pointerType: 'touch' };

// jsdom has no keyboard-modality heuristic; say which focus is visible.
function focusVisible(visible: boolean) {
  const original = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    if (selector === ':focus-visible') return visible;
    return original.call(this, selector);
  });
}

beforeEach(() => {
  resetTouches();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetHintRegistry();
});

describe('useHint, tooltip on pointer', () => {
  it('opens after the delay, not before', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS - 1);
    expect(tip()).toBeNull();
    advance(1);
    expect(tip()).not.toBeNull();
  });

  it('never opens when the pointer leaves first', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS / 2);
    fireEvent.pointerLeave(wrapper(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS * 2);
    expect(tip()).toBeNull();
  });

  it('ignores a touch hover', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerEnter(wrapper(), touch);
    advance(TOOLTIP_OPEN_DELAY_MS * 2);
    expect(tip()).toBeNull();
  });
});

describe('useHint, hover card on pointer', () => {
  it('opens at once', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    expect(tip()).not.toBeNull();
  });
});

describe('useHint, preview on pointer', () => {
  it('opens after the longer preview delay, not before', () => {
    render(<Harness kind="preview" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    advance(PREVIEW_OPEN_DELAY_MS - 1);
    expect(tip()).toBeNull();
    advance(1);
    expect(tip()).not.toBeNull();
  });

  it('opens the next preview at once while warm, and waits again once cool', () => {
    render(
      <>
        <Harness kind="preview" />
      </>,
    );
    fireEvent.pointerEnter(wrapper(), mouse);
    advance(PREVIEW_OPEN_DELAY_MS);
    fireEvent.pointerLeave(wrapper(), mouse);
    advance(HINT_CLOSE_GRACE_MS);
    expect(tip()).toBeNull();
    fireEvent.pointerEnter(wrapper(), mouse);
    expect(tip()).not.toBeNull();
    fireEvent.pointerLeave(wrapper(), mouse);
    advance(HINT_CLOSE_GRACE_MS + PREVIEW_WARMUP_MS);
    fireEvent.pointerEnter(wrapper(), mouse);
    expect(tip()).toBeNull();
    advance(PREVIEW_OPEN_DELAY_MS);
    expect(tip()).not.toBeNull();
  });

  it('opens at once on keyboard-visible focus', () => {
    focusVisible(true);
    render(<Harness kind="preview" />);
    fireEvent.focus(button());
    expect(tip()).not.toBeNull();
  });
});

describe('useHint, the mouse echo of a tap', () => {
  // A tap closes a dialog; the browser then sends mouse events to the control now under the finger.
  it('opens nothing on a mouse pointerenter right after a touch', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerDown(document.body, touch);
    fireEvent.pointerUp(document.body, touch);
    fireEvent.pointerEnter(wrapper(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS + 100);
    expect(tip()).toBeNull();
  });

  it('opens on a mouse once the touch is long past', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerDown(document.body, touch);
    advance(HINT_TOUCH_COMPAT_MS + 1);
    fireEvent.pointerEnter(wrapper(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS);
    expect(tip()).not.toBeNull();
  });
});

describe('useHint, keyboard focus', () => {
  it('opens a tooltip at once on keyboard-visible focus', () => {
    focusVisible(true);
    render(<Harness kind="tooltip" />);
    fireEvent.focus(button());
    expect(tip()?.dataset.source).toBe('focus');
  });

  it('opens nothing on focus that is not keyboard-visible', () => {
    focusVisible(false);
    render(<Harness kind="hover-card" />);
    fireEvent.focus(button());
    expect(tip()).toBeNull();
  });

  it('stays open while focused, even after the pointer leaves', () => {
    focusVisible(true);
    render(<Harness kind="tooltip" />);
    fireEvent.focus(button());
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerLeave(wrapper(), mouse);
    advance(HINT_CLOSE_GRACE_MS * 5);
    expect(tip()).not.toBeNull();
  });

  it('closes after the grace once focus leaves', () => {
    focusVisible(true);
    render(<Harness kind="tooltip" />);
    fireEvent.focus(button());
    fireEvent.blur(button());
    expect(tip()).not.toBeNull();
    advance(HINT_CLOSE_GRACE_MS);
    expect(tip()).toBeNull();
  });
});

describe('useHint, Escape', () => {
  it('dismisses and lets the keypress carry on', () => {
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(tip()).toBeNull();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
    window.removeEventListener('keydown', outer);
  });

  it('stays dismissed until the pointer leaves and returns', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.pointerMove(wrapper(), mouse);
    fireEvent.pointerEnter(wrapper(), mouse);
    expect(tip()).toBeNull();
    fireEvent.pointerLeave(wrapper(), mouse);
    fireEvent.pointerEnter(wrapper(), mouse);
    expect(tip()).not.toBeNull();
  });

  it('ignores other keys', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(tip()).not.toBeNull();
  });
});

describe('useHint, hoverable', () => {
  it('stays open when the pointer crosses onto the hint within the grace', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerLeave(wrapper(), mouse);
    advance(HINT_CLOSE_GRACE_MS - 1);
    fireEvent.pointerEnter(tip()!, mouse);
    advance(HINT_CLOSE_GRACE_MS * 5);
    expect(tip()).not.toBeNull();
  });

  it('closes after the grace once the pointer leaves the hint too', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerLeave(wrapper(), mouse);
    fireEvent.pointerEnter(tip()!, mouse);
    fireEvent.pointerLeave(tip()!, mouse);
    advance(HINT_CLOSE_GRACE_MS);
    expect(tip()).toBeNull();
  });

  it('closes after the grace when the pointer goes elsewhere', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerLeave(wrapper(), mouse);
    advance(HINT_CLOSE_GRACE_MS - 1);
    expect(tip()).not.toBeNull();
    advance(1);
    expect(tip()).toBeNull();
  });
});

describe('useHint, pressing', () => {
  it('closes an open hint', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerDown(button(), mouse);
    expect(tip()).toBeNull();
  });

  it('sees the press even when the control stops it from bubbling', () => {
    render(<Harness kind="hover-card" stopPresses />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerDown(button(), mouse);
    expect(tip()).toBeNull();
  });

  it('still long-presses a control that stops its presses from bubbling', () => {
    render(<Harness kind="tooltip" stopPresses />);
    fireEvent.pointerDown(button(), touch);
    advance(HINT_LONG_PRESS_MS);
    expect(tip()).not.toBeNull();
    fireEvent.pointerUp(button(), touch);
    advance(HINT_TOUCH_LINGER_MS);
    expect(tip()).toBeNull();
  });

  it('cancels a pending tooltip until the pointer leaves', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerDown(button(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS * 2);
    expect(tip()).toBeNull();
  });
});

describe('useHint, a pointer already resting on the trigger', () => {
  it('opens on the first move over a trigger that mounted under the pointer (no pointerenter came)', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerMove(button(), mouse);
    expect(tip()).not.toBeNull();
  });

  it('does nothing more on later moves once the pointer is known to be over it', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerMove(button(), mouse);
    fireEvent.pointerMove(button(), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS - 1);
    expect(tip()).toBeNull();
    advance(1);
    expect(tip()).not.toBeNull();
  });

  it('does not reopen from a move after a press dismissed it', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.pointerDown(button(), mouse);
    fireEvent.pointerMove(button(), mouse);
    expect(tip()).toBeNull();
  });

  it('ignores a touch move', () => {
    render(<Harness kind="hover-card" />);
    fireEvent.pointerMove(button(), touch);
    expect(tip()).toBeNull();
  });
});

describe('useHint, after a press', () => {
  it('shows again once the pointer has left and come back, though the control kept focus', () => {
    focusVisible(true);
    render(<Harness kind="hover-card" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    fireEvent.focus(button());
    fireEvent.pointerDown(button(), mouse);
    expect(tip()).toBeNull();
    fireEvent.pointerLeave(wrapper(), mouse);
    fireEvent.pointerEnter(wrapper(), mouse);
    expect(tip()).not.toBeNull();
  });

  it('shows again after the hint closed under the pointer (its surface sent no leave)', () => {
    render(
      <>
        <Harness kind="hover-card" />
        <Harness kind="hover-card" />
      </>,
    );
    const [first, second] = screen.getAllByTestId('wrapper') as [HTMLElement, HTMLElement];
    fireEvent.pointerEnter(first, mouse);
    // Onto the first hint's surface, then the second trigger takes the slot and closes it under the pointer.
    fireEvent.pointerLeave(first, mouse);
    fireEvent.pointerEnter(screen.getByRole('tooltip'), mouse);
    fireEvent.pointerEnter(second, mouse);
    fireEvent.pointerLeave(second, mouse);
    advance(HINT_CLOSE_GRACE_MS);
    // Back on the first trigger: pressed (dismissed), left and entered again.
    const firstButton = screen.getAllByRole('button')[0] as HTMLElement;
    fireEvent.pointerEnter(first, mouse);
    fireEvent.pointerDown(firstButton, mouse);
    expect(screen.queryAllByRole('tooltip')).toHaveLength(0);
    fireEvent.pointerLeave(first, mouse);
    fireEvent.pointerEnter(first, mouse);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });
});

describe('useHint, touch long press', () => {
  it('opens after the long press, eats the click that follows, and lingers after lift', () => {
    const onClick = vi.fn();
    render(<Harness kind="tooltip" onClick={onClick} />);
    fireEvent.pointerDown(button(), { ...touch, clientX: 10, clientY: 10 });
    advance(HINT_LONG_PRESS_MS);
    expect(tip()?.dataset.source).toBe('touch');
    fireEvent.pointerUp(button(), touch);
    fireEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
    advance(HINT_TOUCH_LINGER_MS - 1);
    expect(tip()).not.toBeNull();
    advance(1);
    expect(tip()).toBeNull();
  });

  it('lets a later tap through when the browser sent no click after the long press', () => {
    const onClick = vi.fn();
    render(<Harness kind="tooltip" onClick={onClick} />);
    fireEvent.pointerDown(button(), touch);
    advance(HINT_LONG_PRESS_MS);
    fireEvent.pointerUp(button(), touch);
    fireEvent.pointerDown(button(), touch);
    fireEvent.pointerUp(button(), touch);
    fireEvent.click(button());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is cancelled by a finger that moves past the slop', () => {
    render(<Harness kind="tooltip" />);
    fireEvent.pointerDown(button(), { ...touch, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(button(), { ...touch, clientX: 21, clientY: 10 });
    advance(HINT_LONG_PRESS_MS);
    expect(tip()).toBeNull();
  });

  it('never opens from a tap, and the tap clicks', () => {
    const onClick = vi.fn();
    render(<Harness kind="tooltip" onClick={onClick} />);
    fireEvent.pointerDown(button(), touch);
    advance(HINT_LONG_PRESS_MS - 1);
    fireEvent.pointerUp(button(), touch);
    fireEvent.click(button());
    advance(HINT_LONG_PRESS_MS);
    expect(tip()).toBeNull();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaves a control that shows its own words alone', () => {
    const onClick = vi.fn();
    render(<Harness kind="tooltip" text="Keep results" onClick={onClick} />);
    fireEvent.pointerDown(button(), touch);
    advance(HINT_LONG_PRESS_MS * 2);
    expect(tip()).toBeNull();
    fireEvent.click(button());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('opens on a control with words when asked to (a reaction chip), and eats the click', () => {
    const onClick = vi.fn();
    render(<Harness kind="hover-card" text="👍 2" onClick={onClick} pressWithText />);
    fireEvent.pointerDown(button(), touch);
    advance(HINT_LONG_PRESS_MS);
    expect(tip()?.dataset.source).toBe('touch');
    fireEvent.pointerUp(button(), touch);
    fireEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('useHint, surface events', () => {
  it('keeps presses on the hint from reaching the trigger ancestors', () => {
    const parent = vi.fn();
    render(
      <div onClick={parent} onPointerDown={parent} onMouseDown={parent} onContextMenu={parent}>
        <Harness kind="hover-card" />
      </div>,
    );
    fireEvent.pointerEnter(wrapper(), mouse);
    const surface = tip()!;
    fireEvent.pointerDown(surface, mouse);
    fireEvent.mouseDown(surface);
    fireEvent.click(surface);
    fireEvent.contextMenu(surface);
    expect(parent).not.toHaveBeenCalled();
  });
});

describe('useHint, lifecycle', () => {
  it('clears its timers on unmount', () => {
    const { unmount } = render(<Harness kind="tooltip" />);
    fireEvent.pointerEnter(wrapper(), mouse);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes when another hint opens', () => {
    render(
      <>
        <Harness kind="hover-card" />
        <Harness kind="hover-card" />
      </>,
    );
    const [first, second] = screen.getAllByTestId('wrapper') as [HTMLElement, HTMLElement];
    fireEvent.pointerEnter(first, mouse);
    fireEvent.pointerEnter(second, mouse);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });
});
