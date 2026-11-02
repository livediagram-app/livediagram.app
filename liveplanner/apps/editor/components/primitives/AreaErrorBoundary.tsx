'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorNameToken, errorTypeToken } from '@liveplanner/api-schema';
import { Button } from '@liveplanner/ui';
import { track } from '@/lib/telemetry';
import {
  browserNavigationDeps,
  recoverInBrowser,
} from '@liveworkspace/workbench/lib/stale-build-navigation';
import { isChunkLoadError } from '@liveworkspace/workbench/lib/stale-chunks';
import { getOnline } from '@liveworkspace/workbench/lib/online-status';

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

// Closed on purpose: the area is part of a public telemetry token.
type ErrorArea =
  | 'Canvas'
  | 'Header'
  | 'TabBar'
  | 'TabDialogs'
  | 'Collaborators'
  | 'Search'
  | 'QuickStyle'
  | 'Modals'
  | 'Popovers'
  | 'ContextMenu'
  | 'ElementDialogs'
  | 'Tour'
  | 'Menu'
  | 'ExplorerSidebar'
  | 'ExplorerPane';

// Human names for the notice, so it reads as a place, not a component.
const AREA_LABEL: Record<ErrorArea, string> = {
  Canvas: 'the canvas',
  Header: 'the header',
  TabBar: 'the tab bar',
  TabDialogs: 'a tab dialog',
  Collaborators: 'the collaborators panel',
  Search: 'search',
  QuickStyle: 'the quick style panel',
  Modals: 'a dialog',
  Popovers: 'a popover',
  ContextMenu: 'the menu',
  ElementDialogs: 'an element dialog',
  Tour: 'the tour',
  Menu: 'the menu',
  ExplorerSidebar: 'the sidebar',
  ExplorerPane: 'this page',
};

type Props = {
  area: ErrorArea;
  fallback?: 'none' | 'panel';
  // Extra classes on the panel fallback, so it can take the area's slot
  // (e.g. `flex-1` in place of the canvas).
  fallbackClassName?: string;
  // Clears a failure when it changes (e.g. the route), so navigating away
  // from a broken Explorer section doesn't leave the notice behind.
  resetKey?: unknown;
  onError?: () => void;
  children: ReactNode;
};

type State = { failed: boolean; offline: boolean };

export class AreaErrorBoundary extends Component<Props, State> {
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
    this.props.onError?.();
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

  private waitForOnline(wasOffline: boolean) {
    if (this.state.offline === wasOffline) return;
    if (!this.state.offline) window.removeEventListener('online', this.retry);
    // Back online before this ran: no `online` event is coming.
    else if (getOnline()) this.retry();
    else window.addEventListener('online', this.retry);
  }

  private readonly retry = () => this.setState({ failed: false, offline: false });

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
            You&apos;re offline, so {AREA_LABEL[this.props.area]} couldn&apos;t load. It comes back
            when you reconnect.
          </span>
        ) : (
          <>
            <span>Something went wrong in {AREA_LABEL[this.props.area]}.</span>
            <Button variant="secondary" size="xs" onClick={this.retry}>
              Try Again
            </Button>
          </>
        )}
      </div>
    );
  }
}
