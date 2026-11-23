// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type Element } from '@livehuddle/document';
import { setSendSource } from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  onSendToPlan,
  setSendHere,
  type SendRequest,
} from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';

// Send to Plan from one sticky (docs/specs/013-workspace/send-to-plan.md "Who sees it"): read on the Space is enough,
// so an Editor, a Participant and a Viewer each send a sticky from its selection toolbar; a Participant's or a
// Viewer's toolbar holds that button alone.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let heard: SendRequest[] = [];
let stop: () => void = () => {};
const up = () => {
  setSendSource('S', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'livehuddle', tabId: 't1' });
};
beforeEach(() => {
  heard = [];
  stop = onSendToPlan((r) => heard.push(r));
});
afterEach(() => {
  cleanup();
  stop();
  setSendSource(null);
  setSendHere(null);
});

const worded = { ...createSticky(100, 100), label: 'Book the venue' } as Element;
const blank = createSticky(300, 100);

function show(el: Element, readOnly: boolean) {
  const props = {
    elements: [el],
    readOnly,
    takePart: false,
    canvasTool: 'select',
    onBeginEdit: vi.fn(),
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  store.setSelectedId(el.id);
  render(
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(1)}>
        <CanvasSelectionToolbars
          props={props}
          selectionInput={{ elements: [el], editingId: null, isPaintMode: false, readOnly }}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
}

const sendButton = () => screen.queryByRole('button', { name: 'Send to Plan' });
const toolbar = () => screen.queryByTestId('selection-popover');

describe('Send to Plan on one sticky', () => {
  it('is on every role’s toolbar; a read-only one holds it alone', () => {
    up();
    for (const readOnly of [false, true]) {
      heard = [];
      show(worded, readOnly);
      fireEvent.click(sendButton()!);
      expect(heard[0]).toMatchObject({
        noun: 'sticky',
        places: [
          expect.objectContaining({
            app: 'livehuddle',
            itemId: 'S',
            tabId: 't1',
            elementId: worded.id,
            text: 'Book the venue',
          }),
        ],
      });
      const buttons = toolbar()!.querySelectorAll('button');
      if (readOnly) expect(buttons).toHaveLength(1);
      else expect(buttons.length).toBeGreaterThan(1);
      cleanup();
    }
  });

  it('gives a read-only session no toolbar while it may not send, or on a sticky with no words', () => {
    show(worded, true);
    expect(toolbar()).toBeNull();
    cleanup();
    up();
    show(blank, true);
    expect(toolbar()).toBeNull();
    expect(sendButton()).toBeNull();
  });
});
