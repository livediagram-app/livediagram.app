'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

// A context menu is a transient overlay: if something inside it throws while
// rendering, the right outcome is that the MENU goes away, not the editor.
// The editor has no app-level error boundary, so without this a single bad
// render in the tab / canvas menu unmounted the whole page (the "page
// crashes when I open the tab menu" report). The boundary swallows the
// fault, logs it for the console, and asks the owner to close the menu, so
// the next open starts from a clean mount.
export class MenuErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Context menu failed to render; closing it.', error, info.componentStack);
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
