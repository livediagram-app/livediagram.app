'use client';

import type { ElementDelta, NoticeNote, ShapeElement } from '@livehuddle/document';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { participantKey } from '@/lib/identity';
import { track } from '@/lib/telemetry';

type SigningEditor = {
  participating: boolean;
  adderKey: string | null;
  selfParticipant: Parameters<typeof participantKey>[0];
};

/**
 * The key a change to the room's answers is signed with (a note, an arcade score): a Participant's adder key, which
 * the room checks; an Editor's adder key, or its participant key without one. Null outside an editor.
 */
export function signingKeyOf(editor: SigningEditor | null): string | null {
  if (!editor) return null;
  return editor.participating
    ? editor.adderKey
    : (editor.adderKey ?? participantKey(editor.selfParticipant));
}

// Who may pin and unpin a note on a piece that holds notes (a Notice Board, docs/specs/009-elements/social-pieces.md;
// a Calendar Wall, team-pieces.md), and the one way a change is sent: a delta, never a whole-element update. An Editor
// or a Participant pins and unpins its own, an Editor unpins any, a Viewer reads. A Participant signs with its adder
// key, which the room checks; an Editor with it, or its participant key. Read only by an open popover or reader, so
// the pieces on the canvas never re-render with the editor's context.
export function useNoteSigner(
  element: ShapeElement,
  telemetryType: 'Notice-board' | 'Calendar-wall',
) {
  const editor = useOptionalEditorContext();
  const level = editor?.can.level ?? 'view';
  const isEditor = level === 'edit';
  const myKey = signingKeyOf(editor);
  const mayPin = !!editor && (isEditor || (level === 'participate' && !!myKey));
  return {
    editor,
    myKey,
    mayPin,
    mayUnpin: (note: NoticeNote) => !!editor && (isEditor || (mayPin && note.by === myKey)),
    authorName: (editor?.selfParticipant.name || 'Someone').slice(0, 60),
    send: (delta: ElementDelta) => {
      editor?.applyElementDelta(element.id, delta);
      track('Element', 'Changed', telemetryType);
    },
  };
}
