'use client';

// Editing in Real 3D (docs/specs/008-canvas/3d-view.md "Editing in 3D"): a press on a piece's model selects that
// piece. The pieces' own drawings, which take presses flat, stand hidden in the scene and are not where their models
// show, so a press is traced into the scene and handed to the piece's element as if it had landed on its drawing;
// everything after (select, drag, menu, double click) runs as it does flat.

import { useEffect, type Ref } from 'react';
import { real3DPieceAt } from '@/lib/real-3d/real-3d-pick';

const HANDED = new WeakSet<Event>();
/** Presses on the editor's own controls (handles, toolbars, buttons, inputs) are left alone. */
const CONTROLS =
  'button, input, textarea, select, a, [role="toolbar"], [role="menu"], [data-selection-grips] *';

export function useScenePresses(on: boolean, mainRef: Ref<HTMLElement>): void {
  useEffect(() => {
    const main = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (!on || !main) return undefined;
    const handOn = (make: (e: MouseEvent, host: Element) => Event) => (e: Event) => {
      if (HANDED.has(e) || !(e instanceof MouseEvent)) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest(CONTROLS)) return;
      const id = real3DPieceAt(e.clientX, e.clientY);
      if (!id) return;
      if (target.closest('[data-element-id]')?.getAttribute('data-element-id') === id) return;
      const host = main.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
      if (!host) return;
      e.stopPropagation();
      e.preventDefault();
      const next = make(e, host);
      HANDED.add(next);
      host.dispatchEvent(next);
    };
    const mouseInit = (e: MouseEvent): MouseEventInit => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      detail: e.detail,
    });
    const down = handOn((e) => {
      const p = e as PointerEvent;
      return new PointerEvent('pointerdown', {
        ...mouseInit(e),
        pointerId: p.pointerId,
        pointerType: p.pointerType,
        isPrimary: p.isPrimary,
      });
    });
    const up = handOn((e) => {
      const p = e as PointerEvent;
      return new PointerEvent('pointerup', {
        ...mouseInit(e),
        pointerId: p.pointerId,
        pointerType: p.pointerType,
        isPrimary: p.isPrimary,
      });
    });
    const dbl = handOn((e) => new MouseEvent('dblclick', mouseInit(e)));
    const menu = handOn((e) => new MouseEvent('contextmenu', mouseInit(e)));
    main.addEventListener('pointerdown', down, true);
    main.addEventListener('pointerup', up, true);
    main.addEventListener('dblclick', dbl, true);
    main.addEventListener('contextmenu', menu, true);
    return () => {
      main.removeEventListener('pointerdown', down, true);
      main.removeEventListener('pointerup', up, true);
      main.removeEventListener('dblclick', dbl, true);
      main.removeEventListener('contextmenu', menu, true);
    };
  }, [on, mainRef]);
}
