// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { STATUS_STALE_MS } from '@livediagram/api-schema';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { SuppressElementIndicators } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { ServiceStatusBadge } from '@/components/canvas/ServiceStatusBadge';
import { createServiceStatusStore, ServiceStatusContext } from '@/lib/service-status-store';

// docs/specs/009-elements/live-status.md "The badge": a bound shape's state, for every role, Present included.

const URL_A = 'https://status.example.com/';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function storeAt(t: { now: number }, statuses: unknown) {
  const store = createServiceStatusStore(() => t.now, 1000);
  store.receive(statuses);
  return store;
}

const pill = (root: ParentNode) => root.querySelector<HTMLElement>('[data-service-status]');

describe('ServiceStatusBadge', () => {
  it.each([
    ['up', 'Up'],
    ['degraded', 'Degraded'],
    ['down', 'Down'],
    ['unknown', 'Unknown'],
  ])('shows %s as %s', (state, word) => {
    const store = storeAt({ now: 10 }, { [URL_A]: { state, checkedAt: 10 } });
    const { container } = render(
      <ServiceStatusContext.Provider value={store}>
        <ServiceStatusBadge url={URL_A} />
      </ServiceStatusContext.Provider>,
    );
    expect(pill(container)?.dataset.serviceStatus).toBe(state);
    expect(pill(container)?.getAttribute('aria-label')).toBe(`Live status: ${word}`);
    expect(container.textContent).toContain(word);
  });

  it('turns Unknown once the state is stale, as the clock moves', () => {
    vi.useFakeTimers();
    const t = { now: 0 };
    const store = storeAt(t, { [URL_A]: { state: 'up', checkedAt: 0 } });
    const { container } = render(
      <ServiceStatusContext.Provider value={store}>
        <ServiceStatusBadge url={URL_A} />
      </ServiceStatusContext.Provider>,
    );
    expect(pill(container)?.dataset.serviceStatus).toBe('up');
    t.now = STATUS_STALE_MS + 1;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(pill(container)?.dataset.serviceStatus).toBe('unknown');
  });

  it('draws nothing before a check, without a room, or at an overview zoom', () => {
    const store = storeAt(
      { now: 0 },
      { 'https://other.example.com/': { state: 'up', checkedAt: 0 } },
    );
    expect(
      pill(
        render(
          <ServiceStatusContext.Provider value={store}>
            <ServiceStatusBadge url={URL_A} />
          </ServiceStatusContext.Provider>,
        ).container,
      ),
    ).toBeNull();
    expect(pill(render(<ServiceStatusBadge url={URL_A} />).container)).toBeNull();
    const checked = storeAt({ now: 0 }, { [URL_A]: { state: 'up', checkedAt: 0 } });
    expect(
      pill(
        render(
          <CanvasZoomProvider zoom={0.2}>
            <ServiceStatusContext.Provider value={checked}>
              <ServiceStatusBadge url={URL_A} />
            </ServiceStatusContext.Provider>
          </CanvasZoomProvider>,
        ).container,
      ),
    ).toBeNull();
  });
});

describe('on a shape', () => {
  function shapeView(element: BoxedElement, suppress = false) {
    const store = storeAt({ now: 0 }, { [URL_A]: { state: 'down', checkedAt: 0 } });
    const view = (
      <BoxedElementView
        element={element}
        isSelected={false}
        isEditing={false}
        isPaintMode={false}
        showHandles={false}
        showAnchors={false}
        onBeginDrag={vi.fn()}
        onBeginEdit={vi.fn()}
        onCommitLabel={vi.fn()}
        onCommitTable={vi.fn()}
        onCancelEdit={vi.fn()}
        onFollowLink={vi.fn()}
        onOpenComments={vi.fn()}
        onOpenAction={vi.fn()}
        onOpenNote={vi.fn()}
        isoDepth={0}
        onSetPageHeading={vi.fn()}
        onContextSelect={vi.fn()}
        tabLocked={false}
        tabSummaries={[]}
        // A Viewer's canvas: the badge reads, it never edits.
        readOnly
        remoteSelectors={[]}
      />
    );
    return render(
      <ServiceStatusContext.Provider value={store}>
        {/* A presented slide hides the element indicators, never the live state. */}
        <SuppressElementIndicators when={suppress}>{view}</SuppressElementIndicators>
      </ServiceStatusContext.Provider>,
    ).container;
  }

  const bound = { ...createShape('square', 0, 0), statusUrl: URL_A } as BoxedElement;

  it("shows a bound shape's state to a Viewer, and in Present", () => {
    expect(pill(shapeView(bound))?.dataset.serviceStatus).toBe('down');
    cleanup();
    expect(pill(shapeView(bound, true))?.dataset.serviceStatus).toBe('down');
  });

  it('shows nothing on an unbound shape or a self-drawing one', () => {
    expect(pill(shapeView(createShape('square', 0, 0) as BoxedElement))).toBeNull();
    cleanup();
    expect(pill(shapeView({ ...bound, shape: 'progress-bar' } as BoxedElement))).toBeNull();
  });
});
