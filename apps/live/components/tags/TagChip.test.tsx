// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tag } from '@livediagram/api-schema';
import { DocumentTagChips, DocumentTagDots, TagChip } from './TagChip';
import { deleteTagMessage } from './TagActionsMenu';

// docs/specs/013-workspace/tags.md "Where tags show".

afterEach(cleanup);

const tag = (id: string, name: string): Tag => ({ id, name, colour: 'blue', createdAt: 1 });
const tags = [tag('a', 'Alpha'), tag('b', 'Beta'), tag('c', 'Gamma'), tag('d', 'Delta')];

describe('DocumentTagChips', () => {
  it('shows two chips, then +N naming the rest', () => {
    render(<DocumentTagChips tags={tags} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByText('Gamma')).toBeNull();
    expect(screen.getByLabelText('2 more tags: Gamma, Delta').textContent).toBe('+2');
  });

  it('shows nothing for no tags', () => {
    const { container } = render(<DocumentTagChips tags={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('opens the tag, never the row under it', () => {
    const onOpenTag = vi.fn();
    const onRow = vi.fn();
    render(
      <a href="#doc" onClick={onRow}>
        <DocumentTagChips tags={tags.slice(0, 1)} onOpenTag={onOpenTag} />
      </a>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tag Alpha' }));
    expect(onOpenTag).toHaveBeenCalledWith('a');
    expect(onRow).not.toHaveBeenCalled();
  });
});

describe('TagChip', () => {
  it('is plain text without a way to open', () => {
    render(<TagChip tag={tags[0]!} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Alpha')).toBeTruthy();
  });
});

describe('DocumentTagDots', () => {
  it('draws up to three dots, named together', () => {
    const { container } = render(<DocumentTagDots tags={tags} />);
    expect(screen.getByRole('img', { name: 'Tags: Alpha, Beta, Gamma, Delta' })).toBeTruthy();
    expect(container.querySelectorAll('[role="img"] > span')).toHaveLength(3);
  });
});

describe('deleteTagMessage', () => {
  it('names how many documents the tag comes off', () => {
    expect(deleteTagMessage('Design', 4)).toBe(
      'Delete the tag Design? It comes off its 4 documents. The documents stay.',
    );
    expect(deleteTagMessage('Design', 1)).toBe(
      'Delete the tag Design? It comes off its one document. The documents stay.',
    );
    expect(deleteTagMessage('Design', 0)).toBe("Delete the tag Design? It isn't on any documents.");
  });
});
