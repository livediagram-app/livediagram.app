'use client';

// The element-menu sections for the Behaviour elements that carry settings:
// the Session button (docs/specs/012-collaboration/session-button.md) and the Picker
// (docs/specs/012-collaboration/picker.md).
//
// Their own file for the same reason PortalMenuSection has one: each is a
// small form (a tool picker plus its one setting, a source plus a list), and
// none of it belongs in the data-shape sections beside charts and rails.

import {
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  PICKER_MAX_OPTIONS,
  type PickerSource,
  type SessionButtonConfig,
  type ShapeElement,
} from '@liveplanner/project';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { SessionElementSettings } from '@/components/canvas/SessionElementSettings';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { PickerIcon } from '@/components/palette/palette-icons';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';

const fieldClass =
  'mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const labelClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-400';

// A textarea of one-per-line entries, committed on blur: the picker's options.
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
  const joined = lines.join('\n');
  // Follows the element's lines when they change, adjusted during render. Compared as text: callers
  // pass a fresh `[]` while the element has none, and that must not wipe an uncommitted draft.
  const [draft, setDraft] = useFollowingDraft(joined);
  const commit = () => {
    const next = draft
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, max);
    setDraft(next.join('\n'));
    if (next.join('\n') !== joined) onCommit(next);
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
      <p className="pb-1 pt-1 text-[10px] text-slate-500 dark:text-slate-400">One per line.</p>
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
  // with a Timer / Vote tile grid, which was a second way to choose
  // something the palette already asks you once: it offers a tile per tool
  // (docs/specs/012-collaboration/session-button.md), so the button lands as the thing you picked. Wanting a
  // different one is wanting a different element — drag it out — and the grid
  // cost every session button three tiles of height to re-ask a settled
  // question.
  return (
    // A side PANEL, not an inline accordion. The body is the Session Studio's
    // own (see SessionElementSettings), which is 286px wide, and the context
    // menu is narrower than that — inline, its fields ran off the right-hand
    // edge and were simply cut off.
    <MenuFlyoutSection title="Session" icon={<ToolsMenuGlyph />} panel {...sectionProps}>
      <SessionElementSettings config={{ ...config, tool }} onChange={onSetSession} />
    </MenuFlyoutSection>
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
          label="People Here"
          active={source === 'participants'}
          onClick={() => onSetPickerSource('participants')}
        />
        <MenuTile
          icon={<PickerIcon />}
          label="A List"
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
