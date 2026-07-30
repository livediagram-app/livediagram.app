'use client';

// The element-menu sections for the Behaviour elements that carry settings:
// the Session button (spec/105) and the Picker (spec/107). The Reveal zone
// (spec/106) has no settings — only the two reveal actions — so it lives here
// too rather than growing a third file for four rows.
//
// Their own file for the same reason PortalMenuSection has one: each is a
// small form (a tool picker plus its one setting, a source plus a list), and
// none of it belongs in the data-shape sections beside charts and rails.

import { useEffect, useState } from 'react';
import {
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_VOTE_DOTS,
  PICKER_MAX_OPTIONS,
  SESSION_POLL_MAX_OPTIONS,
  SESSION_TOOLS,
  TIMER_MINUTES_RANGE,
  VOTE_DOTS_RANGE,
  type PickerSource,
  type SessionButtonConfig,
  type SessionTool,
  type ShapeElement,
} from '@livediagram/diagram';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import {
  PickerIcon,
  PollIcon,
  RevealIcon,
  TimerIcon,
  VoteIcon,
} from '@/components/palette/palette-icons';

const TOOL_ICON: Record<SessionTool, React.ReactNode> = {
  timer: <TimerIcon />,
  vote: <VoteIcon />,
  poll: <PollIcon />,
};
const TOOL_LABEL: Record<SessionTool, string> = { timer: 'Timer', vote: 'Vote', poll: 'Poll' };

const fieldClass =
  'mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const labelClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-400';

// A number field that commits on blur / Enter and clamps to the tool's range,
// so a typed 0 or 999 lands as the nearest legal value rather than being
// rejected or silently kept.
function NumberRow({
  label,
  value,
  range,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  range: { min: number; max: number };
  suffix: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isFinite(parsed) ? Math.min(range.max, Math.max(range.min, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <div className="px-3 pt-2">
      <label className={labelClass}>
        {label}
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={range.min}
            max={range.max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              e.stopPropagation();
            }}
            className={`${fieldClass} w-20`}
          />
          <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{suffix}</span>
        </span>
      </label>
    </div>
  );
}

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
  // Each tool's setting is kept when you switch away and back, so trying Poll
  // and returning to Timer doesn't cost you the question you typed.
  const patch = (next: Partial<SessionButtonConfig>) => onSetSession({ ...config, tool, ...next });

  return (
    <MenuAccordionSection title="Session" icon={<ToolsMenuGlyph />} {...sectionProps}>
      <p className="px-3 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Starts for everyone
      </p>
      <MenuTileGrid cols={3}>
        {SESSION_TOOLS.map((option) => (
          <MenuTile
            key={option}
            icon={TOOL_ICON[option]}
            label={TOOL_LABEL[option]}
            active={tool === option}
            onClick={() => patch({ tool: option })}
          />
        ))}
      </MenuTileGrid>
      {tool === 'timer' ? (
        <NumberRow
          label="Length"
          value={config?.minutes ?? DEFAULT_TIMER_MINUTES}
          range={TIMER_MINUTES_RANGE}
          suffix="minutes"
          onCommit={(minutes) => patch({ minutes })}
        />
      ) : null}
      {tool === 'vote' ? (
        <NumberRow
          label="Dots each"
          value={config?.dots ?? DEFAULT_VOTE_DOTS}
          range={VOTE_DOTS_RANGE}
          suffix="per person"
          onCommit={(dots) => patch({ dots })}
        />
      ) : null}
      {tool === 'poll' ? (
        <>
          <div className="px-3 pt-2">
            <label className={labelClass}>
              Question
              <input
                value={config?.question ?? ''}
                onChange={(e) => patch({ question: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Quick question"
                className={fieldClass}
              />
            </label>
          </div>
          <LinesRow
            label="Answers"
            hint={'Yes\nNo'}
            lines={config?.options ?? []}
            max={SESSION_POLL_MAX_OPTIONS}
            onCommit={(options) => patch({ options })}
          />
        </>
      ) : null}
    </MenuAccordionSection>
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
