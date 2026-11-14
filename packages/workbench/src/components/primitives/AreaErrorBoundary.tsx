'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorNameToken, errorTypeToken } from '@liveworkspace/telemetry/error-tokens';
import { Button } from '@liveworkspace/ui';
import { browserNavigationDeps, recoverInBrowser } from '../../lib/stale-build-navigation';
import { isChunkLoadError } from '../../lib/stale-chunks';
import { getOnline } from '../../lib/online-status';

// A render crash in one part of the editor or Explorer used to unmount the
// whole page (the app has no route-level error boundary), and the telemetry
// for it was a bare `Uncaught` that said nothing about where. Wrapping each
// major area in one of these does both jobs: the fault stays inside the area
// that threw, and it is reported as `Error·Client·Render.<Area>.<ErrorName>`
// (docs/specs/017-telemetry/telemetry.md), which is the "which part of the UI broke" signal a minified
// stack can't give.
//
// Two fallbacks, chosen by what the area is:
//   - 'none' for transient overlays (dialogs, popovers, menus, search): the
//     overlay simply disappears, and the owner's `onError` can close it so
//     the next open mounts clean.
//   - 'panel' for layout areas (canvas, header, tab bar, Explorer panes): a
//     small notice in the area's place with a Try Again that remounts it,
//     so the rest of the page stays reachable instead of going blank.
//
// Code that has not loaded yet cannot come while the browser is offline (docs/specs/007-editor/load-recovery.md
// "Offline"): such a failure waits for the connection instead, and the area mounts again on its own once the
// browser is back online. A panel says so, with no Try Again (it could only fail again).

export type AreaErrorBoundaryDeps<Area extends string> = {
  /**
   * Each area's human name for the notice, so it reads as a place, not a component. Its keys are the editor's areas,
   * closed on purpose: the area is part of a public telemetry token.
   */
  labels: Readonly<Record<Area, string>> & { Menu: string };
  /** The editor's telemetry, for the `Error·Client·Render.<Area>.<ErrorName>` report. */
  track: (category: 'Error', action: 'Client', type: string) => void;
};

// Each editor binds it once, in its components/primitives/AreaErrorBoundary.tsx, with its areas and telemetry.
export function createAreaErrorBoundary<Area extends string>({
  labels,
  track,
}: AreaErrorBoundaryDeps<Area>) {
  type Props = {
    area: Area;
    fallback?: 'none' | 'panel';
    // Extra classes on the panel fallback, so it can take the area's slot
    // (e.g. `flex-1` in place of the canvas).
    fallbackClassName?: string;
    // Clears a failure when it changes (e.g. the route), so navigating away
    // from a broken Explorer section doesn't leave the notice behind.
    resetKey?: unknown;
    // Told what was thrown, so the owner can say why (a chunk from an earlier build, say).
    onError?: (error: unknown) => void;
    children: ReactNode;
  };

  type State = { failed: boolean; offline: boolean };

  class AreaErrorBoundary extends Component<Props, State> {
    override state: State = { failed: false, offline: false };

    static getDerivedStateFromError(error: unknown): State {
      return { failed: true, offline: isChunkLoadError(error) && !getOnline() };
    }

    override componentWillUnmount() {
      window.removeEventListener('online', this.retry);
    }

    override componentDidCatch(error: unknown, info: ErrorInfo) {
      console.error(`${this.props.area} failed to render.`, error, info.componentStack);
      try {
        track('Error', 'Client', errorTypeToken('Render', this.props.area, errorNameToken(error)));
      } catch {
        // Telemetry must never throw from inside an error boundary.
      }
      this.props.onError?.(error);
      // A chunk from an earlier build is gone: load the page in full instead (docs/specs/016-platform/stale-builds.md).
      if (isChunkLoadError(error)) void recoverInBrowser(error, browserNavigationDeps());
    }

    // A failure in the first render commits as a mount, so both lifecycles wait for the connection.
    override componentDidMount() {
      this.waitForOnline(false);
    }

    override componentDidUpdate(prev: Props, prevState: State) {
      this.waitForOnline(prevState.offline);
      if (this.state.failed && prev.resetKey !== this.props.resetKey) this.retry();
    }

    // Public only because the class is made in a factory (a private member cannot leave an anonymous class).
    waitForOnline(wasOffline: boolean) {
      if (this.state.offline === wasOffline) return;
      if (!this.state.offline) window.removeEventListener('online', this.retry);
      // Back online before this ran: no `online` event is coming.
      else if (getOnline()) this.retry();
      else window.addEventListener('online', this.retry);
    }

    readonly retry = () => this.setState({ failed: false, offline: false });

    override render() {
      if (!this.state.failed) return this.props.children;
      if (this.props.fallback !== 'panel') return null;
      return (
        <div
          role="alert"
          className={`flex flex-wrap items-center justify-center gap-3 p-4 text-sm text-slate-600 dark:text-slate-300 ${
            this.props.fallbackClassName ?? ''
          }`}
        >
          {this.state.offline ? (
            <span>
              You&apos;re offline, so {labels[this.props.area]} couldn&apos;t load. It comes back
              when you reconnect.
            </span>
          ) : (
            <>
              <span>Something went wrong in {labels[this.props.area]}.</span>
              <Button variant="secondary" size="xs" onClick={this.retry}>
                Try Again
              </Button>
            </>
          )}
        </div>
      );
    }
  }

  // A context menu is a transient overlay: if something inside it throws while
  // rendering, the right outcome is that the MENU goes away, not the editor.
  // Without this a single bad render in the tab / canvas menu unmounted the
  // whole page (the "page crashes when I open the tab menu" report). The
  // boundary swallows the fault, logs it, reports it as `Render.Menu.*`
  // (docs/specs/017-telemetry/telemetry.md), and asks the owner to close the menu, so the next open starts
  // from a clean mount.
  function MenuErrorBoundary({ onError, children }: { onError: () => void; children: ReactNode }) {
    return (
      <AreaErrorBoundary area={'Menu' as Area} onError={onError}>
        {children}
      </AreaErrorBoundary>
    );
  }

  return { AreaErrorBoundary, MenuErrorBoundary };
}
