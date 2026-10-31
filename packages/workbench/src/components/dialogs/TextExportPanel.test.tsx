// @vitest-environment jsdom
// The text export view (JSON, Mermaid, Markdown). Its textarea had no name, so a screen reader met an
// unnamed edit box (axe "label") on the Export dialog's JSON view.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextExportPanel } from './TextExportPanel';

afterEach(cleanup);

describe('TextExportPanel', () => {
  it('names its text box for the format, and downloads what is in it', () => {
    const onDownload = vi.fn();
    render(
      <TextExportPanel
        formatTitle="JSON"
        initialText='{"a":1}'
        blurb="This tab as JSON."
        downloadLabel="Download .json"
        onDownload={onDownload}
        onCopied={() => {}}
        onBack={() => {}}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'JSON Text' });
    fireEvent.change(box, { target: { value: '{"a":2}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download .json' }));
    expect(onDownload).toHaveBeenCalledWith('{"a":2}');
  });
});
