'use client';

// The Avatar Panel (spec/101): the character sheet for Avatar mode. Present
// only while the mode is active — like the Poll / Vote panels, it joins and
// leaves its corner stack rather than sitting there — and it is one of the
// mobile / minimal-layout dock buttons, so a phone reaches it the same way it
// reaches Layers.
//
// Four choices: Gender, Clothing, Hair, Size. Deliberately NOT colour — the
// shirt takes the participant's presence colour so a character always matches
// its owner's cursor and name chip, which is what makes a room of walkers
// legible. Every pick writes through to per-browser storage (see
// lib/avatar-config), so the character persists across sessions.
//
// A live preview stands at the top, drawn by the SAME sprite the canvas uses,
// so what you build here is exactly what walks around.

import {
  AVATAR_CLOTHING,
  AVATAR_GENDERS,
  AVATAR_HAIR,
  AVATAR_SIZES,
  type AvatarConfig,
} from '@/lib/avatar-config';
import { AvatarSprite } from '@/components/canvas/avatar-sprite';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';

// One row of mutually-exclusive choices. A radiogroup rather than a select:
// there are never more than four, and seeing them all is the point when you're
// dressing a character.
function OptionRow<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1" role="radiogroup" aria-label={label}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(option.id)}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                active
                  ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AvatarPanel({
  config,
  onChange,
  shirt,
  position,
  onMoveTo,
  onReset,
  dock,
  mobileOpenOverride,
  mobileDockAnchor,
  forceDockMode,
  onMobileClose,
  stackBelowY,
}: {
  config: AvatarConfig;
  // One field at a time — the hook persists and reports each pick.
  onChange: <K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) => void;
  // The local participant's colour, so the preview wears the same shirt the
  // character on the canvas does.
  shirt?: string;
  position: { x: number; y: number } | null;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  dock?: MovablePanelDockProps;
  mobileOpenOverride?: boolean;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
  onMobileClose?: () => void;
  stackBelowY?: number;
}) {
  return (
    <MovablePanel
      title="Avatar"
      position={position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-56"
      onMoveTo={onMoveTo}
      onReset={onReset}
      stackBelowY={stackBelowY}
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
      {...dock}
    >
      <div className="flex flex-col gap-2.5 px-2 pb-2">
        {/* Live preview: the canvas sprite, standing, front-on, at a fixed
            scale so switching to Small / Tall doesn't resize the panel (the
            choice still shows — the figure inside changes). */}
        <div className="flex items-end justify-center rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <AvatarSprite
            facing="down"
            config={config}
            walking={false}
            stepFrame={0}
            lift={0}
            wave={null}
            shirt={shirt}
            scale={0.9}
          />
        </div>
        <OptionRow
          label="Gender"
          options={AVATAR_GENDERS}
          value={config.gender}
          onPick={(id) => onChange('gender', id)}
        />
        <OptionRow
          label="Clothing"
          options={AVATAR_CLOTHING}
          value={config.clothing}
          onPick={(id) => onChange('clothing', id)}
        />
        <OptionRow
          label="Hair"
          options={AVATAR_HAIR}
          value={config.hair}
          onPick={(id) => onChange('hair', id)}
        />
        <OptionRow
          label="Size"
          options={AVATAR_SIZES}
          value={config.size}
          onPick={(id) => onChange('size', id)}
        />
        <p className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          Your shirt takes your participant colour, and this character is remembered in this
          browser.
        </p>
      </div>
    </MovablePanel>
  );
}
