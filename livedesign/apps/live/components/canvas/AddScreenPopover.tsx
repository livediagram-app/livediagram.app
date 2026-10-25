'use client';

// Choose a Device (docs/specs/007-editor/pages-mode.md "A screen of another device"): what a
// wireframe tab's Add a Screen of Another Device opens. Every page of a tab is one kind ("One kind
// a tab"), so there is no choosing a kind; a wireframe tab may still hold screens of any devices.
// A compact list, a row per device under its family, the device last chosen in this browser ringed
// and focused first. Up and Down move between the rows, Enter or a press chooses, Escape or an
// outside press closes. On a phone it is a bottom sheet.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  WIREFRAME_DEVICE_GROUPS,
  WIREFRAME_DEVICES,
  type WireframeDeviceId,
} from '@livedesign/design';
import { useClickOutside, useEscape, Portal } from '@livedesign/ui';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import { lastWireframeDevice, rememberWireframeDevice } from '@/lib/wireframe-device-memory';
import { DeviceMiniature } from './wireframe/DeviceMiniature';

const WIDTH = 300;
const GAP = 10;

const ROW =
  'group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

// Up and Down between the rows of a list, wrapping; Home and End to its ends.
function moveBetweenRows(e: KeyboardEvent<HTMLElement>) {
  const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-add-row]')];
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  const to =
    e.key === 'ArrowDown'
      ? at + 1
      : e.key === 'ArrowUp'
        ? at - 1
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? rows.length - 1
            : null;
  if (to === null) return;
  e.preventDefault();
  rows[(to + rows.length) % rows.length]?.focus();
}

export function AddScreenPopover({
  getAnchor,
  onAddDevice,
  onClose,
}: {
  // The button the popover hangs from.
  getAnchor: () => HTMLElement | null;
  onAddDevice: (device: WireframeDeviceId) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const mobile = useIsMobileViewport();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Placed beside the button (right of it while there is room, else left), level with it and kept
  // inside the window.
  useLayoutEffect(() => {
    const a = getAnchor()?.getBoundingClientRect();
    if (!a) return;
    const h = box.current?.offsetHeight ?? 0;
    const right = a.right + GAP + WIDTH + EDGE <= window.innerWidth;
    const left = right ? a.right + GAP : Math.max(EDGE, a.left - GAP - WIDTH);
    const top = Math.max(
      EDGE,
      Math.min(a.top + a.height / 2 - h / 2, window.innerHeight - h - EDGE),
    );
    setPos({ left, top });
  }, [getAnchor]);
  // Focus the remembered device, else the first.
  useLayoutEffect(() => {
    const first =
      box.current?.querySelector<HTMLButtonElement>('[data-add-row][aria-current="true"]') ??
      box.current?.querySelector<HTMLButtonElement>('[data-add-row]');
    first?.focus({ preventScroll: true });
  }, []);
  useClickOutside(box, () => onClose(false), true, '[data-add-page-trigger]');
  useEscape(() => onClose(true), { capture: true, stopPropagation: true });

  const chooseDevice = (device: WireframeDeviceId) => {
    rememberWireframeDevice(device);
    onClose(false);
    onAddDevice(device);
  };
  const remembered = lastWireframeDevice();

  const body = (
    <div className="flex flex-col" data-add-page-devices="">
      <p className="px-2 pb-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
        Choose a Device
      </p>
      <div role="group" aria-label="Choose a Device" onKeyDown={moveBetweenRows}>
        {WIREFRAME_DEVICE_GROUPS.map((group) => (
          <div key={group.deviceClass} className="pt-1.5 first:pt-0">
            <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {group.label}
            </p>
            {group.devices.map((id) => {
              const info = WIREFRAME_DEVICES[id];
              const size = info.landscape
                ? `${info.screen.height} x ${info.screen.width}`
                : `${info.screen.width} x ${info.screen.height}`;
              return (
                <button
                  key={id}
                  type="button"
                  data-add-row=""
                  data-device-row={id}
                  aria-current={id === remembered}
                  onClick={() => chooseDevice(id)}
                  className={`${ROW} ${id === remembered ? 'bg-brand-50/70 ring-1 ring-brand-300 dark:bg-brand-500/10 dark:ring-brand-400/40' : ''}`}
                >
                  <span className="flex h-8 w-10 shrink-0 items-center justify-center">
                    <DeviceMiniature
                      device={id}
                      landscape={!!info.landscape}
                      width={40}
                      height={32}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                    {info.label}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {size}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <BottomSheet
        ref={box}
        role="dialog"
        aria-label="Choose a Device"
        data-menu-surface=""
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 pb-3">{body}</div>
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label="Choose a Device"
        data-add-page-popover=""
        // Floating UI: the canvas leaves its presses alone, and an open Contents popover counts
        // them as inside it (MovablePanel).
        data-floating-panel=""
        data-menu-surface=""
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] animate-fade-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width: WIDTH,
          maxHeight: `calc(100vh - ${2 * EDGE}px)`,
        }}
      >
        {body}
      </div>
    </Portal>
  );
}
