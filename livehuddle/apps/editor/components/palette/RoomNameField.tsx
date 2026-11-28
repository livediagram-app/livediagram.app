'use client';

// A Room's name field (docs/specs/009-elements/office.md "Room", "Room name field"): the label on the plate at the
// left of its back wall, typed here rather than on the canvas. In the room's settings dialog (the element menu's
// Room row) and at the top of the Quick Style panel while one room is selected.
//
// Typed locally and committed on blur or Enter, like the Portal's name: a commit per keystroke would push one history
// entry per letter. The commit is the canvas's own in-place rename (`commitLabel`), so it is one undoable step and
// trims as that does. An Editor's alone: the hosts pass `onRename` only where `roomNameEditable` holds.

import { useId } from 'react';
import type { Element, ShapeElement } from '@livehuddle/document';
import { TextInput } from '@liveworkspace/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { TextGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import type { EditorCapabilities } from '@/lib/editor-capabilities';

/** The longest name the field takes: one line on the plate, far past any real room's name. */
export const ROOM_NAME_MAX = 80;

/** Whether this session may rename this element as a Room: a room, and its words are the session's to write. */
export function roomNameEditable(can: Pick<EditorCapabilities, 'writeText'>, el: Element): boolean {
  return el.type === 'shape' && el.shape === 'room' && can.writeText(el);
}

export function RoomNameField({
  room,
  onRename,
}: {
  room: ShapeElement;
  onRename: (elementId: string, name: string) => void;
}) {
  const id = useId();
  const stored = room.label ?? '';
  // Replaced whenever the stored name changes (an undo, a peer's edit) or another room is shown.
  const [draft, setDraft] = useFollowingDraft(`${room.id}\u0000${stored}`, () => stored);
  const commit = () => {
    if (draft.trim() !== stored.trim()) onRename(room.id, draft);
  };
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="select-none px-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
      >
        Room name
      </label>
      <TextInput
        id={id}
        compact
        value={draft}
        maxLength={ROOM_NAME_MAX}
        placeholder="Room"
        autoComplete="off"
        spellCheck={false}
        data-room-name-field=""
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(stored);
          }
          // The menu, the dialog and the canvas listen for keys; typing a name must reach none of them.
          e.stopPropagation();
        }}
      />
    </div>
  );
}

/** The field as the room's first settings section, titled Name. */
export function RoomNameMenuSection({
  room,
  sectionProps,
  onRename,
}: {
  room: ShapeElement;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onRename: (elementId: string, name: string) => void;
}) {
  return (
    <MenuAccordionSection title="Name" icon={<TextGlyph />} {...sectionProps('room-name')}>
      <div className="px-3 pb-2.5 pt-1">
        <RoomNameField room={room} onRename={onRename} />
      </div>
    </MenuAccordionSection>
  );
}
