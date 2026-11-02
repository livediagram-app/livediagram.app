// @vitest-environment jsdom

// The image export's live preview (docs/specs/007-editor/editor-app.md): to a screen reader it is
// one named picture. Bare, the injected SVG was named by every word on the tab.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageExportPanel } from './ImageExportPanel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

describe('ImageExportPanel', () => {
  it('names its preview as one picture', () => {
    render(
      <ImageExportPanel
        label="PNG"
        busy={false}
        error={null}
        hasHiddenLayers={false}
        pageExport={false}
        renderPreview={() => '<svg><text>Every word on the tab</text></svg>'}
        previewReady
        onExport={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const shown = screen.getByRole('img', { name: 'The tab as it will download' });
    expect(shown.getAttribute('data-testid')).toBe('export-preview');
    expect(shown.querySelector('svg')).toBeTruthy();
  });
});
