// @vitest-environment jsdom

// AI Context in the right rail (docs/specs/030-knowledgebase/insights.md "AI Context on a page"), from plain
// props, a share role at a time.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { knowledgeRights } from '@/lib/knowledge/knowledge-rights';
import { PageAiContext, aboutTokens, type PageAiContextProps } from './PageAiContext';

afterEach(cleanup);

const view = (props: Partial<PageAiContextProps> = {}) =>
  render(<PageAiContext inContext={false} tokens={1200} onSetContext={undefined} {...props} />);
const section = () => screen.getByRole('region', { name: 'AI Context' });

describe('AI Context', () => {
  it('lists no agents: they are Read This Week’s popover now', () => {
    view();
    expect(section().querySelector('[data-page-agent]')).toBeNull();
    expect(screen.getByText('Always in Context')).toBeTruthy();
  });

  it('shows no size before Page Health is read', () => {
    view({ tokens: undefined });
    expect(section().querySelector('[data-context-size]')).toBeNull();
  });
});

describe('Always in Context, a share role at a time', () => {
  const rightsOf = (editPages: boolean, offline = false) =>
    knowledgeRights({
      can: { editPages },
      isStructureReadOnly: false,
      offline,
    });

  it('as edit: a switch named Always in Context, described by the size, that sets it', () => {
    const set = vi.fn();
    expect(rightsOf(true).editFields).toBe(true);
    view({ onSetContext: set });
    const toggle = screen.getByRole('switch', { name: 'Always in Context' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-describedby')).toBe(
      section().querySelector('[data-context-size]')!.id,
    );
    expect(screen.getByText('About 1,200 tokens')).toBeTruthy();
    fireEvent.click(toggle);
    expect(set).toHaveBeenCalledWith(true);
    cleanup();
    view({ onSetContext: set, inContext: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Always in Context' }));
    expect(set).toHaveBeenLastCalledWith(false);
  });

  it.each([
    ['participate', false],
    ['view', false],
  ] as const)('as %s: words, no switch', (_role, editPages) => {
    expect(rightsOf(editPages).editFields).toBe(false);
    view({ onSetContext: undefined, inContext: true });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('Handed to Every Agent First')).toBeTruthy();
    cleanup();
    view({ onSetContext: undefined, inContext: false });
    expect(screen.getByText('Not Handed to Agents First')).toBeTruthy();
  });

  it('Offline: no Editor may set it', () => {
    expect(rightsOf(true, true).editFields).toBe(false);
  });
});

describe('the words', () => {
  it('counts asks and tokens in words', () => {
    expect(aboutTokens(1)).toBe('About 1 token');
    expect(aboutTokens(8000)).toBe('About 8,000 tokens');
  });
});
