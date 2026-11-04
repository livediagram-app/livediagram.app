'use client';

// One tab tile's preview, kept to itself (docs/specs/026-plan/plan-overview.md "Tabs"): a preview that throws as it
// draws shows "Couldn't load preview" in its own tile, and the rest of the Overview carries on.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { errorNameToken, errorTypeToken } from '@liveplanner/api-schema';

type Props = { fallback: ReactNode; children: ReactNode };

export class PreviewBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('A tab preview failed to render.', error, info.componentStack);
    try {
      track('Error', 'Client', errorTypeToken('Render', 'Overview', errorNameToken(error)));
    } catch {
      // Telemetry must never throw from inside an error boundary.
    }
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
