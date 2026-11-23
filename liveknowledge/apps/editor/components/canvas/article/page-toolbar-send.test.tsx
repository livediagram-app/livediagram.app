// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { ArticleBlock } from '@liveknowledge/document';
import { setSendSource } from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  onSendToPlan,
  setSendHere,
  type SendRequest,
} from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';
import { blocksToDoc } from '@/lib/article/article-convert';
import { selectionStateOf } from '@/lib/article/article-commands';
import {
  clearActiveArticle,
  setActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import { PageToolbar } from './PageToolbar';

// docs/specs/013-workspace/send-to-plan.md "What it sends", "Who sees it": the page toolbar's Send to Plan, for an
// Editor and a Participant (both write the text, so both have the toolbar), sending the words picked or the caret's
// paragraph, list item or checklist item, with the block as the place; never for a session that may not send (a
// Guest, Offline, an embed). A Viewer's way in, the pill under the words picked, is lib/article/article-sent.test.ts.
const BLOCKS = [
  { id: 'p1', type: 'paragraph', runs: [{ text: 'Ship the release notes' }] },
  { id: 't1', type: 'list', list: 'todo', runs: [{ text: 'Send the invites' }] },
  { id: 'e1', type: 'paragraph', runs: [] },
] as unknown as ArticleBlock[];

function caretIn(id: string): EditorState {
  const s = EditorState.create({ doc: blocksToDoc(BLOCKS) });
  let at = -1;
  s.doc.forEach((node, pos) => {
    if (node.attrs.id === id) at = pos + 1;
  });
  return s.apply(s.tr.setSelection(TextSelection.create(s.doc, at)));
}

function workOn(state: EditorState) {
  const handle = {
    flow: 'f1',
    state: () => state,
    selection: () => selectionStateOf(state),
    run: vi.fn(),
    can: () => true,
    flush: vi.fn(),
    focus: vi.fn(),
    insert: vi.fn(),
  } as unknown as ArticleEditorHandle;
  act(() =>
    setActiveArticle({ handle, pageId: 'p1', selection: selectionStateOf(state), focused: true }),
  );
}

let heard: SendRequest[] = [];
let stop: () => void = () => {};
const up = () => {
  setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'liveknowledge', tabId: 'tab1' });
};
beforeEach(() => {
  heard = [];
  stop = onSendToPlan((r) => heard.push(r));
});
afterEach(() => {
  act(() => clearActiveArticle('f1'));
  cleanup();
  stop();
  setSendSource(null);
  setSendHere(null);
});

const show = () =>
  render(
    <PageToolbar accent="#d97706" topRoomOf={() => 40} articlePages={[{ id: 'p1', flow: 'f1' }]} />,
  );
const sendButton = () =>
  document.querySelector<HTMLButtonElement>('button[aria-label="Send to Plan"]');

describe('the page toolbar: Send to Plan', () => {
  it("sends the caret's checklist item, naming its block as the place", () => {
    up();
    workOn(caretIn('t1'));
    show();
    fireEvent.click(sendButton()!);
    expect(heard[0]).toMatchObject({
      noun: 'words',
      places: [
        expect.objectContaining({
          app: 'liveknowledge',
          itemId: 'D',
          tabId: 'tab1',
          kind: 'text',
          elementId: 't1',
          text: 'Send the invites',
        }),
      ],
    });
  });

  it('is unavailable in an empty paragraph', () => {
    up();
    workOn(caretIn('e1'));
    show();
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('is not there while the session may not send', () => {
    workOn(caretIn('p1'));
    show();
    expect(document.querySelector('button[aria-label^="Bold"]')).not.toBeNull();
    expect(sendButton()).toBeNull();
  });
});
