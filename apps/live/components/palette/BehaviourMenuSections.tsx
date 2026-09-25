'use client';

// The element-menu sections for the Behaviour elements that carry settings:
// the Session button (spec/105), the Picker (spec/107) and the Reaction pad
// (spec/135). The Reveal zone
// (spec/106) has no settings — only the two reveal actions — so it lives here
// too rather than growing a third file for four rows.
//
// Their own file for the same reason PortalMenuSection has one: each is a
// small form (a tool picker plus its one setting, a source plus a list), and
// none of it belongs in the data-shape sections beside charts and rails.

import { useEffect, useState } from 'react';
import {
  REACTION_DEFAULT,
  REACTION_EMOJI,
  REACTION_HINT,
  REACTION_LABEL,
  REACTIONS,
  type Reaction,
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  PICKER_MAX_OPTIONS,
  type PickerSource,
  type SessionButtonConfig,
  type ShapeElement,
} from '@livediagram/diagram';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { SessionElementSettings } from '@/components/canvas/SessionElementSettings';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { PickerIcon, RevealIcon } from '@/components/palette/palette-icons';

const fieldClass =
  'mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const labelClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-400';

// A textarea of one-per-line entries, committed on blur. Used by both the
// poll's answers and the picker's options — the same shape of list, so the
// same control rather than two spellings of it.
function LinesRow({
  label,
  hint,
  lines,
  max,
  onCommit,
}: {
  label: string;
  hint: string;
  lines: string[];
  max: number;
  onCommit: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState(lines.join('\n'));
  useEffect(() => setDraft(lines.join('\n')), [lines]);
  const commit = () => {
    const next = draft
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, max);
    setDraft(next.join('\n'));
    if (next.join('\n') !== lines.join('\n')) onCommit(next);
  };
  return (
    <div className="px-3 pt-2">
      <label className={labelClass}>
        {label}
        <textarea
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={hint}
          className={`${fieldClass} resize-none`}
        />
      </label>
      <p className="pb-1 pt-1 text-[10px] text-slate-400 dark:text-slate-500">One per line.</p>
    </div>
  );
}

export function SessionMenuSection({
  element,
  onSetSession,
  sectionProps,
}: {
  element: ShapeElement;
  onSetSession: (config: SessionButtonConfig) => void;
  sectionProps: { open: boolean; onToggle: () => void };
}) {
  const config = element.session;
  const tool = config?.tool ?? DEFAULT_SESSION_TOOL;

  // This section is the button's SETTINGS, not a tool picker. It used to lead
  // with a Timer / Vote / Poll tile grid, which was a second way to choose
  // something the palette already asks you once: it offers a tile per tool
  // (spec/105), so the button lands as the thing you picked. Wanting a
  // different one is wanting a different element — drag it out — and the grid
  // cost every session button three tiles of height to re-ask a settled
  // question.
  return (
    // A side PANEL, not an inline accordion. The body is the Session Studio's
    // own (see SessionElementSettings), which is 286px wide, and the context
    // menu is narrower than that — inline, a poll's answer tiles and its
    // choice fields ran off the right-hand edge and were simply cut off. The
    // Studio itself is reached the same way, as the tab menu's Collaborate
    // flyout, so this also makes the two open alike.
    <MenuFlyoutSection title="Session" icon={<ToolsMenuGlyph />} panel {...sectionProps}>
      <SessionElementSettings config={{ ...config, tool }} onChange={onSetSession} />
    </MenuFlyoutSection>
  );
}

export function RevealMenuSection({
  element,
  onSetRevealed,
  sectionProps,
}: {
  element: ShapeElement;
  onSetRevealed: (revealed: boolean) => void;
  sectionProps: { open: boolean; onToggle: () => void };
}) {
  const revealed = element.revealed === true;
  return (
    <MenuAccordionSection title="Reveal" icon={<RevealIcon />} {...sectionProps}>
      <p className="px-3 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Anyone can click the cover to peek for themselves. This takes it off for
        <strong> everyone</strong>.
      </p>
      <MenuTileGrid cols={2}>
        <MenuTile
          icon={<RevealIcon />}
          label="Reveal for all"
          active={revealed}
          onClick={() => onSetRevealed(true)}
        />
        <MenuTile
          icon={<ToolsMenuGlyph />}
          label="Hide for all"
          active={!revealed}
          onClick={() => onSetRevealed(false)}
        />
      </MenuTileGrid>
    </MenuAccordionSection>
  );
}

// Reaction pad (spec/135): which burst the pad throws.
//
// A tile grid rather than a dropdown, because the five reactions differ in
// FEELING rather than in name — the glyph is the thing being chosen, and a
// list of five words hides exactly the part the user is picking on. The hints
// spell out what each one is FOR, since "confetti or fireworks?" is a real
// question and both answers look like celebration.
export function ReactionMenuSection({
  element,
  onSetReaction,
  sectionProps,
}: {
  element: ShapeElement;
  onSetReaction: (reaction: Reaction) => void;
  sectionProps: { open: boolean; onToggle: () => void };
}) {
  const current = element.reaction ?? REACTION_DEFAULT;
  return (
    <MenuAccordionSection
      title="Reaction"
      icon={<span className="text-[13px] leading-none">{REACTION_EMOJI[current]}</span>}
      {...sectionProps}
    >
      <MenuTileGrid cols={3}>
        {REACTIONS.map((reaction) => (
          <MenuTile
            key={reaction}
            icon={<span className="text-[15px] leading-none">{REACTION_EMOJI[reaction]}</span>}
            label={REACTION_LABEL[reaction]}
            active={reaction === current}
            onClick={() => onSetReaction(reaction)}
          />
        ))}
      </MenuTileGrid>
      <p className="px-3 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        {REACTION_HINT[current]}. Press the pad, or walk a character onto it in Avatar mode.
      </p>
    </MenuAccordionSection>
  );
}

export function PickerMenuSection({
  element,
  onSetPickerSource,
  onSetPickerOptions,
  sectionProps,
}: {
  element: ShapeElement;
  onSetPickerSource: (source: PickerSource) => void;
  onSetPickerOptions: (options: string[]) => void;
  sectionProps: { open: boolean; onToggle: () => void };
}) {
  const source = element.pickerSource ?? DEFAULT_PICKER_SOURCE;
  return (
    <MenuAccordionSection title="Picker" icon={<PickerIcon />} {...sectionProps}>
      <p className="px-3 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Picks from
      </p>
      <MenuTileGrid cols={2}>
        <MenuTile
          icon={<ToolsMenuGlyph />}
          label="People here"
          active={source === 'participants'}
          onClick={() => onSetPickerSource('participants')}
        />
        <MenuTile
          icon={<PickerIcon />}
          label="A list"
          active={source === 'options'}
          onClick={() => onSetPickerSource('options')}
        />
      </MenuTileGrid>
      {source === 'options' ? (
        <LinesRow
          label="Options"
          hint={'Alice\nBob\nCarol'}
          lines={element.pickerOptions ?? []}
          max={PICKER_MAX_OPTIONS}
          onCommit={onSetPickerOptions}
        />
      ) : null}
    </MenuAccordionSection>
  );
}
