'use client';

// The Avatar Panel (spec/101): the character sheet for Avatar mode. Present
// only while the mode is active — like the Poll / Vote panels, it joins and
// leaves its corner stack rather than sitting there — and it is one of the
// mobile / minimal-layout dock buttons, so a phone reaches it the same way it
// reaches Layers. Same width as the Palette it stacks under.
//
// Four choices: Gender, Clothing, Hair, Size. Deliberately NOT colour — the
// shirt takes the participant's presence colour so a character always matches
// its owner's cursor and name chip, which is what makes a room of walkers
// legible. Every pick writes through to per-browser storage (see
// lib/avatar-config), so the character persists across sessions.
//
// Each choice is a single-open ACCORDION row (the shared AccordionSection) with
// the current value in the collapsed header: eight outfits and eight hairstyles
// laid out flat would be most of the canvas, and a collapsed row still tells you
// what you're wearing. A cropped portrait sits on top, drawn by the SAME sprite
// the canvas uses, so what you build here is exactly what walks around.

import { useState } from 'react';
import {
  AVATAR_CLOTHING,
  AVATAR_GENDERS,
  AVATAR_HAIR,
  AVATAR_SIZES,
  type AvatarConfig,
} from '@/lib/avatar-config';
import { AvatarSprite } from '@/components/canvas/avatar-sprite';
import { AccordionSection } from '@/components/primitives/AccordionSection';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';

// One accordion row of mutually-exclusive choices. A radiogroup rather than a
// select: seeing every option at once is the point when you're dressing a
// character, and they only cost space while the row is open.
function OptionSection<T extends string>({
  label,
  options,
  value,
  open,
  onToggle,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  open: boolean;
  onToggle: () => void;
  onPick: (id: T) => void;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <AccordionSection
      title={label}
      open={open}
      onToggle={onToggle}
      headerClassName="flex w-full items-center justify-between gap-2 py-1.5 text-left"
      titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
      chevronClassName="text-slate-400 dark:text-slate-500"
      bodyClassName="pb-2"
      // The value stays visible while collapsed, so the panel reads as a
      // summary of the character rather than four mystery rows.
      trailing={
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {current?.label}
        </span>
      }
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
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
    </AccordionSection>
  );
}

type Row = 'gender' | 'clothing' | 'hair' | 'size';

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
  // Single-open, and closed to start: the panel opens as a four-line summary of
  // the character, and you expand only the row you came to change.
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));

  return (
    <MovablePanel
      title="Avatar"
      position={position}
      defaultCorner="top-right-stacked"
      // Matches the Palette this stacks under, so the top-right column reads as
      // one edge rather than two.
      width="w-auto sm:w-64"
      onMoveTo={onMoveTo}
      onReset={onReset}
      stackBelowY={stackBelowY}
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
      {...dock}
    >
      <div className="flex flex-col px-2 pb-2">
        {/* Cropped portrait: the canvas sprite standing front-on in a box that
            hugs it (see AvatarSprite's `portrait`), at a fixed scale so
            switching to Small / Tall doesn't resize the panel. */}
        <div className="mb-1 flex items-end justify-center rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <AvatarSprite
            facing="down"
            config={config}
            walking={false}
            stepFrame={0}
            lift={0}
            wave={null}
            shirt={shirt}
            scale={1.4}
            portrait
          />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <OptionSection
            label="Gender"
            options={AVATAR_GENDERS}
            value={config.gender}
            open={openRow === 'gender'}
            onToggle={() => toggle('gender')}
            onPick={(id) => onChange('gender', id)}
          />
          <OptionSection
            label="Clothing"
            options={AVATAR_CLOTHING}
            value={config.clothing}
            open={openRow === 'clothing'}
            onToggle={() => toggle('clothing')}
            onPick={(id) => onChange('clothing', id)}
          />
          <OptionSection
            label="Hair"
            options={AVATAR_HAIR}
            value={config.hair}
            open={openRow === 'hair'}
            onToggle={() => toggle('hair')}
            onPick={(id) => onChange('hair', id)}
          />
          <OptionSection
            label="Size"
            options={AVATAR_SIZES}
            value={config.size}
            open={openRow === 'size'}
            onToggle={() => toggle('size')}
            onPick={(id) => onChange('size', id)}
          />
        </div>
      </div>
    </MovablePanel>
  );
}
