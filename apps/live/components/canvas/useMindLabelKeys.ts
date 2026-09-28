import { useEffectEvent, useLayoutEffect, type KeyboardEvent, type RefObject } from 'react';
import { isMindNode, type Element } from '@livediagram/diagram';
import { useMindGrow } from '@/components/canvas/MindGrowContext';
import { insertTextAtCaret } from '@/components/rich-text/rich-text-dom';
import { claimMindHandoff } from '@/lib/mind-handoff';

// The mind node's keys inside its label editor (docs/specs/009-elements/mind-node.md "Keyboard").
//
// Split out of RichTextEditor because none of it applies to any other element,
// and the host only needs to hand over its key events.
//
// - On mount it claims the keystroke handoff: whatever was typed for this node
//   before its editor existed is typed in now (see lib/mind-handoff.ts).
// - Tab and Enter commit the label and grow the next node.
// - Escape commits rather than cancels, and removes a node that was left empty.
export function useMindLabelKeys(opts: {
  element: Element;
  initialLabel: string;
  editorRef: RefObject<HTMLDivElement | null>;
  syncFromDom: () => void;
  commitNow: () => void;
  handleCancel: () => void;
}): { onMindKeyDown: (e: KeyboardEvent) => boolean } {
  const { element, initialLabel, editorRef, syncFromDom, commitNow, handleCancel } = opts;
  const mind = useMindGrow();
  const active = !!mind && isMindNode(element);

  const leave = (how: 'child' | 'sibling' | 'escape') => {
    // Only from a real key press in this editor, so the label commit reads a
    // settled tab, never from the mount (see the claim below).
    if (!mind) return;
    if (how !== 'escape') {
      commitNow();
      mind.grow(element.id, how);
      return;
    }
    const typed = editorRef.current?.textContent ?? '';
    // An empty node that was empty when the edit began is the Tab pressed one
    // time too many: remove it and go back to its parent. Anything else is
    // kept, because Escape is how people stop typing, not how they undo.
    if (typed.trim() === '' && initialLabel.trim() === '' && mind.abandon(element.id)) {
      handleCancel();
      return;
    }
    commitNow();
  };

  // Runs after the session's own mount effect (declared after it in the host),
  // so the editor is already focused with its caret placed: what was typed for
  // this node appears the moment its editor does. A node whose typing already
  // ENDED (Tab / Enter / Escape pressed before this editor existed) is
  // finished by the handoff itself, so this editor just closes, without a
  // commit that could race the growth.
  const claim = useEffectEvent(() => {
    if (!active) return;
    const got = claimMindHandoff(element.id);
    if (!got) return;
    if (got.type === 'finished') {
      handleCancel();
      return;
    }
    if (got.text) {
      insertTextAtCaret(got.text);
      syncFromDom();
    }
  });
  useLayoutEffect(() => claim(), []);

  const onMindKeyDown = (e: KeyboardEvent): boolean => {
    if (!active) return false;
    // Shift+Enter still inserts a newline, so a multi-line label is not lost
    // to the shortcut.
    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      leave(e.key === 'Tab' ? 'child' : 'sibling');
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      leave('escape');
      return true;
    }
    return false;
  };

  return { onMindKeyDown };
}
