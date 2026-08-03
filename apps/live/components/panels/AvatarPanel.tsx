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
import { AVATAR_REACTIONS, type AvatarReactionKind } from '@/lib/avatar-reactions';
import { AvatarSprite } from '@/components/canvas/avatar-sprite';
import { Tooltip } from '@/components/primitives/Tooltip';
// The same glyph the welcome flow's "shuffle a random name" button uses — same
// meaning (give me another random one), so it stays the same icon.
import { RefreshIcon } from '@/components/palette/template-picker-icons';
import { ToolOptionRow } from '@/components/panels/ToolOptionRow';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

type Row = 'gender' | 'clothing' | 'hair' | 'size';

export function AvatarPanel({
  config,
  onChange,
  onRandomise,
  onReaction,
  shirt,
  ...placement
}: {
  config: AvatarConfig;
  // One field at a time — the hook persists and reports each pick.
  onChange: <K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) => void;
  // Roll a whole new character (keeping the chosen size).
  onRandomise: () => void;
  // Make the character perform one of the reactions on the canvas.
  onReaction: (kind: AvatarReactionKind) => void;
  // The local participant's colour, so the preview wears the same shirt the
  // character on the canvas does.
  shirt?: string;
} & ModePanelProps) {
  // Single-open, and closed to start: the panel opens as a four-line summary of
  // the character, and you expand only the row you came to change.
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));

  return (
    <ModePanel title="Avatar" {...placement}>
      <div className="flex flex-col px-2 pb-2">
        {/* Cropped portrait: the canvas sprite standing front-on in a box that
            hugs it (see AvatarSprite's `portrait`), at a fixed scale so
            switching to Small / Tall doesn't resize the panel. */}
        <div className="relative mb-1 flex items-end justify-center rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
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
          {/* Dice-roll in the corner of the portrait: a whole new character in
              one click, for when you'd rather not walk the four rows. */}
          <Tooltip title="Randomise" description="Roll a new character. Your size choice is kept.">
            <button
              type="button"
              onClick={onRandomise}
              aria-label="Randomise avatar"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-brand-600 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-brand-300"
            >
              <RefreshIcon />
            </button>
          </Tooltip>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <ToolOptionRow
            label="Gender"
            options={AVATAR_GENDERS}
            value={config.gender}
            open={openRow === 'gender'}
            onToggle={() => toggle('gender')}
            onPick={(id) => onChange('gender', id)}
          />
          <ToolOptionRow
            label="Clothing"
            options={AVATAR_CLOTHING}
            value={config.clothing}
            open={openRow === 'clothing'}
            onToggle={() => toggle('clothing')}
            onPick={(id) => onChange('clothing', id)}
          />
          <ToolOptionRow
            label="Hair"
            options={AVATAR_HAIR}
            value={config.hair}
            open={openRow === 'hair'}
            onToggle={() => toggle('hair')}
            onPick={(id) => onChange('hair', id)}
          />
          <ToolOptionRow
            label="Size"
            options={AVATAR_SIZES}
            value={config.size}
            open={openRow === 'size'}
            onToggle={() => toggle('size')}
            onPick={(id) => onChange('size', id)}
          />
        </div>
        {/* Reactions are ACTIONS, not settings, so they sit outside the
            accordion: mid-presentation you want them one click away, not one
            click plus a disclosure. */}
        <div className="mt-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Reactions
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {AVATAR_REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() => onReaction(reaction.id)}
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
              >
                {reaction.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModePanel>
  );
}
