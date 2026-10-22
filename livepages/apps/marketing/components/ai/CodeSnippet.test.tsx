// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeSnippet } from './CodeSnippet';

describe('CodeSnippet', () => {
  it('keeps a command’s prompt out of its text, so a copy of the block pastes as a command', () => {
    const { container } = render(<CodeSnippet lang="bash" code="claude mcp add livepages" />);
    expect(container.querySelector('pre')!.textContent).toBe('claude mcp add livepages');
  });
});
