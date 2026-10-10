'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HINT_CLOSE_GRACE_MS,
  HINT_LONG_PRESS_MS,
  HINT_LONG_PRESS_SLOP_PX,
  HINT_TOUCH_LINGER_MS,
  PREVIEW_OPEN_DELAY_MS,
  TOOLTIP_OPEN_DELAY_MS,
  type HintKind,
} from './hint-constants';
import { claimHint, isHintWarm, releaseHint, type HintToken } from './hint-registry';
import { hasVisibleText } from './trigger-text';

export type HintOpenSource = 'pointer' | 'focus' | 'touch';

// Presses are heard in the capture phase: many canvas controls stop their
// pointer events from bubbling, and the hint must still see them.
export type HintTriggerProps = {
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerDownCapture: (e: React.PointerEvent) => void;
  onPointerMoveCapture: (e: React.PointerEvent) => void;
  onPointerUpCapture: (e: React.PointerEvent) => void;
  onPointerCancelCapture: (e: React.PointerEvent) => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
  onClickCapture: (e: React.MouseEvent) => void;
};

export type HintSurfaceProps = {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: (e: React.SyntheticEvent) => void;
  onMouseDown: (e: React.SyntheticEvent) => void;
  onClick: (e: React.SyntheticEvent) => void;
  onDoubleClick: (e: React.SyntheticEvent) => void;
  onContextMenu: (e: React.SyntheticEvent) => void;
};

export type HintState = {
  open: boolean;
  source: HintOpenSource | null;
  // Callback ref for the wrapper around the trigger.
  attach: (el: HTMLSpanElement | null) => void;
  // The element the hint describes and is placed against (D7).
  anchor: () => Element | null;
  triggerProps: HintTriggerProps;
  surfaceProps: HintSurfaceProps;
};

// How long a pointer rests before each kind opens: a hover card at once.
const OPEN_DELAY_MS: Record<HintKind, number> = {
  tooltip: TOOLTIP_OPEN_DELAY_MS,
  'hover-card': 0,
  preview: PREVIEW_OPEN_DELAY_MS,
};

type Timer = ReturnType<typeof setTimeout> | null;
type TimerName = 'openTimer' | 'closeTimer' | 'pressTimer' | 'lingerTimer';

// Everything pointer traffic touches. Kept out of React state so hovering
// re-renders nothing until the hint actually opens or closes.
type Machine = {
  wrapper: HTMLSpanElement | null;
  open: boolean;
  source: HintOpenSource | null;
  overTrigger: boolean;
  overSurface: boolean;
  focused: boolean;
  dismissed: boolean;
  suppressClick: boolean;
  pressStart: { x: number; y: number } | null;
} & Record<TimerName, Timer>;

const newMachine = (): Machine => ({
  wrapper: null,
  open: false,
  source: null,
  overTrigger: false,
  overSurface: false,
  focused: false,
  dismissed: false,
  suppressClick: false,
  pressStart: null,
  openTimer: null,
  closeTimer: null,
  pressTimer: null,
  lingerTimer: null,
});

function clearTimers(m: Machine, ...names: TimerName[]) {
  for (const name of names) {
    const timer = m[name];
    if (timer !== null) clearTimeout(timer);
    m[name] = null;
  }
}

// Keyboard focus shows the ring; programmatic and mouse focus do not. An
// engine without :focus-visible counts every focus as keyboard (D3).
function isFocusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

// A hint is hoverable, so it takes pointer events; React bubbles a portal's
// events to its React ancestors, so a press on the hint must stop here or it
// would reach the tile, row or canvas the trigger sits in.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// One hint's behaviour: when it opens, when it closes, and what a touch long
// press does. Transitions T1-T15 in
// docs/specs/004-interface-design/blueprints/tooltips-hover-cards-popovers.md.
export function useHint(kind: HintKind): HintState {
  const [source, setSource] = useState<HintOpenSource | null>(null);
  const [token] = useState<HintToken>(() => ({}));
  const machine = useRef<Machine>(newMachine());

  const close = useCallback(() => {
    const m = machine.current;
    clearTimers(m, 'openTimer', 'closeTimer', 'lingerTimer');
    if (!m.open) return;
    m.open = false;
    m.source = null;
    releaseHint(token, kind, Date.now());
    setSource(null);
  }, [kind, token]);

  const show = useCallback(
    (from: HintOpenSource) => {
      const m = machine.current;
      clearTimers(m, 'openTimer', 'closeTimer', 'lingerTimer');
      m.source = from;
      if (!m.open) {
        m.open = true;
        claimHint(token, close, kind);
      }
      setSource(from);
    },
    [close, kind, token],
  );

  // Nothing holds the hint any more: forget a dismissal and close after the
  // grace, which gives the pointer time to cross onto the hint (D1, D2).
  const settle = useCallback(() => {
    const m = machine.current;
    if (m.overTrigger || m.overSurface || m.focused) return;
    m.dismissed = false;
    clearTimers(m, 'openTimer', 'closeTimer');
    if (m.open) m.closeTimer = setTimeout(close, HINT_CLOSE_GRACE_MS);
  }, [close]);

  const endPress = useCallback(() => {
    const m = machine.current;
    clearTimers(m, 'pressTimer');
    m.pressStart = null;
    if (m.source !== 'touch') return;
    clearTimers(m, 'lingerTimer');
    m.lingerTimer = setTimeout(close, HINT_TOUCH_LINGER_MS);
  }, [close]);

  const attach = useCallback((el: HTMLSpanElement | null) => {
    machine.current.wrapper = el;
  }, []);

  const anchor = useCallback(() => {
    const wrapper = machine.current.wrapper;
    return wrapper?.firstElementChild ?? wrapper;
  }, []);

  const triggerProps: HintTriggerProps = {
    onPointerEnter: (e) => {
      if (e.pointerType === 'touch') return;
      const m = machine.current;
      m.overTrigger = true;
      clearTimers(m, 'closeTimer');
      if (m.open || m.dismissed || m.openTimer !== null) return;
      const delay = OPEN_DELAY_MS[kind];
      if (delay === 0 || isHintWarm(kind, Date.now())) show('pointer');
      else m.openTimer = setTimeout(() => show('pointer'), delay);
    },
    onPointerLeave: (e) => {
      if (e.pointerType === 'touch') return;
      const m = machine.current;
      m.overTrigger = false;
      clearTimers(m, 'openTimer');
      settle();
    },
    onPointerDownCapture: (e) => {
      const m = machine.current;
      if (e.pointerType !== 'touch') {
        m.dismissed = true;
        close();
        return;
      }
      m.suppressClick = false;
      clearTimers(m, 'pressTimer');
      const target = anchor();
      if (!target || hasVisibleText(target)) return;
      m.pressStart = { x: e.clientX, y: e.clientY };
      m.pressTimer = setTimeout(() => {
        m.pressTimer = null;
        m.suppressClick = true;
        show('touch');
      }, HINT_LONG_PRESS_MS);
    },
    onPointerMoveCapture: (e) => {
      const m = machine.current;
      if (e.pointerType !== 'touch' || m.pressTimer === null || !m.pressStart) return;
      const moved = Math.hypot(e.clientX - m.pressStart.x, e.clientY - m.pressStart.y);
      if (moved > HINT_LONG_PRESS_SLOP_PX) clearTimers(m, 'pressTimer');
    },
    onPointerUpCapture: (e) => {
      if (e.pointerType === 'touch') endPress();
    },
    onPointerCancelCapture: (e) => {
      if (e.pointerType === 'touch') endPress();
    },
    onFocus: (e) => {
      if (!isFocusVisible(e.target)) return;
      const m = machine.current;
      m.focused = true;
      if (!m.dismissed) show('focus');
    },
    onBlur: () => {
      machine.current.focused = false;
      settle();
    },
    onClickCapture: (e) => {
      const m = machine.current;
      if (!m.suppressClick) return;
      m.suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  const surfaceProps: HintSurfaceProps = {
    onPointerEnter: () => {
      const m = machine.current;
      m.overSurface = true;
      clearTimers(m, 'closeTimer');
    },
    onPointerLeave: () => {
      machine.current.overSurface = false;
      settle();
    },
    onPointerDown: stop,
    onMouseDown: stop,
    onClick: stop,
    onDoubleClick: stop,
    onContextMenu: stop,
  };

  const open = source !== null;

  // Escape dismisses without consuming the key: a menu or dialog listening
  // for it closes on the same press (spec).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      machine.current.dismissed = true;
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    const m = machine.current;
    return () => {
      clearTimers(m, 'openTimer', 'closeTimer', 'pressTimer', 'lingerTimer');
      if (m.open) releaseHint(token, kind, Date.now());
      m.open = false;
    };
  }, [kind, token]);

  return { open, source, attach, anchor, triggerProps, surfaceProps };
}
