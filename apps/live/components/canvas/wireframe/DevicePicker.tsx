'use client';

// The device tiles (docs/specs/007-editor/wireframe-pages.md "Choosing the device"), grouped
// Phones, Tablets, Computers and Watch: each a miniature of its frame over its name and screen
// size. Shared by Choose a Device (adding a page, the first page's choice) and the Device popover
// and panel, where the page's own device is ringed. Arrow keys move between the tiles.
import { useRef, type KeyboardEvent } from 'react';
import {
  WIREFRAME_DEVICE_GROUPS,
  WIREFRAME_DEVICES,
  type WireframeDeviceId,
  type WireframeFrameLook,
  type WireframeFrameTheme,
} from '@liveplanner/document';
import { DeviceMiniature } from './DeviceMiniature';

const ORDER = WIREFRAME_DEVICE_GROUPS.flatMap((g) => g.devices);

export function DevicePicker({
  current,
  look,
  theme,
  onChoose,
  columns = 3,
  autoFocus = false,
}: {
  // The device ringed (the page's, or the last chosen).
  current?: WireframeDeviceId;
  look?: WireframeFrameLook;
  theme?: WireframeFrameTheme | undefined;
  onChoose: (device: WireframeDeviceId) => void;
  columns?: 3 | 4;
  // Focus the ringed tile on mount (Choose a Device).
  autoFocus?: boolean;
}) {
  const tiles = useRef(new Map<WireframeDeviceId, HTMLButtonElement>());
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (
      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns } as Record<
        string,
        number
      >
    )[e.key];
    if (step === undefined) return;
    const at = ORDER.findIndex((id) => tiles.current.get(id) === document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    tiles.current.get(ORDER[(at + step + ORDER.length) % ORDER.length]!)?.focus();
  };
  return (
    <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
      {WIREFRAME_DEVICE_GROUPS.map((group) => (
        <div key={group.deviceClass} role="group" aria-label={group.label}>
          <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {group.label}
          </p>
          <div className={`grid gap-1.5 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {group.devices.map((id) => {
              const info = WIREFRAME_DEVICES[id];
              const chosen = id === current;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={chosen}
                  data-device-tile={id}
                  ref={(el) => {
                    if (el) tiles.current.set(id, el);
                    else tiles.current.delete(id);
                    if (el && chosen && autoFocus && !el.dataset.focused) {
                      el.dataset.focused = '';
                      el.focus({ preventScroll: true });
                    }
                  }}
                  onClick={() => onChoose(id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 text-center transition hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-400 dark:hover:bg-brand-500/10 ${
                    chosen
                      ? 'border-brand-400 bg-brand-50/60 ring-2 ring-brand-400/40 dark:border-brand-400 dark:bg-brand-500/15'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <span className="flex h-14 w-full items-center justify-center">
                    <DeviceMiniature
                      device={id}
                      look={look}
                      theme={theme}
                      landscape={!!info.landscape}
                      width={64}
                      height={52}
                    />
                  </span>
                  <span className="block w-full truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {info.short ?? info.label}
                  </span>
                  <span className="block text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                    {/* As it is held: the iPhone Duo opened, 890 x 626. */}
                    {info.landscape
                      ? `${info.screen.height} x ${info.screen.width}`
                      : `${info.screen.width} x ${info.screen.height}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
