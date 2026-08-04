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
import { REACTION_EMOJI, REACTION_LABEL, REACTIONS, type Reaction } from '@livediagram/diagram';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';

type Row = 'gender' | 'clothing' | 'hair' | 'size' | 'behaviour' | 'reactions';

// A disclosure holding one-shot ACTIONS rather than a setting's options, so
// it looks like the ToolOptionRows above it without pretending one of its
// entries is "current".
function ActionRow({
  label,
  open,
  onToggle,
  items,
  onPick,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  items: { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span className="text-slate-400">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open ? (
        <div className="mb-1 mt-0.5 flex flex-wrap gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.id)}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AvatarPanel({
  config,
  onChange,
  onRandomise,
  onReaction,
  onBurst,
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
  // Throw one of the Reaction Pad's bursts around the character (spec/135).
  // Absent where the canvas has no burst surface behind it.
  onBurst?: (reaction: Reaction) => void;
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
        {/* Two lists of actions, both behind a disclosure like the settings
            above them. BEHAVIOUR is what the character does with its body —
            jumping jacks, a wave, a spin. REACTIONS is the same five bursts
            the Reaction Pad throws (spec/135), fired around the character
            instead of around a pad.
            They were one flat row called "Reactions" holding only the poses,
            which named the wrong thing and left no room for the bursts. */}
        <div className="mt-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <ActionRow
            label="Behaviour"
            open={openRow === 'behaviour'}
            onToggle={() => toggle('behaviour')}
            items={AVATAR_REACTIONS.map((r) => ({ id: r.id, label: r.label }))}
            onPick={(id) => onReaction(id as AvatarReactionKind)}
          />
          <ActionRow
            label="Reactions"
            open={openRow === 'reactions'}
            onToggle={() => toggle('reactions')}
            items={REACTIONS.map((r) => ({
              id: r,
              label: `${REACTION_EMOJI[r]} ${REACTION_LABEL[r]}`,
            }))}
            onPick={(id) => onBurst?.(id as Reaction)}
          />
        </div>
      </div>
    </ModePanel>
  );
}
