// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tag } from '@livedesign/api-schema';
import { DesignTagChips, DesignTagDots, TagChip, chipsFloor } from './TagChip';
import { deleteTagMessage } from './TagActionsMenu';

// docs/specs/013-workspace/tags.md "Where tags show".

afterEach(cleanup);

const tag = (id: string, name: string): Tag => ({ id, name, colour: 'blue', createdAt: 1 });
const tags = [tag('a', 'Alpha'), tag('b', 'Beta'), tag('c', 'Gamma'), tag('d', 'Delta')];

describe('DesignTagChips', () => {
  it('shows two chips, then +N naming the rest', () => {
    render(<DesignTagChips tags={tags} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByText('Gamma')).toBeNull();
    expect(screen.getByLabelText('2 more tags: Gamma, Delta').textContent).toBe('+2');
  });

  it('shows nothing for no tags', () => {
    const { container } = render(<DesignTagChips tags={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('opens the tag, never the row under it', () => {
    const onOpenTag = vi.fn();
    const onRow = vi.fn();
    render(
      <a href="#doc" onClick={onRow}>
        <DesignTagChips tags={tags.slice(0, 1)} onOpenTag={onOpenTag} />
      </a>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tag Alpha' }));
    expect(onOpenTag).toHaveBeenCalledWith('a');
    expect(onRow).not.toHaveBeenCalled();
  });
});

// A squeezed row truncates its chips' names rather than drawing them over the pills beside them.
describe('DesignTagChips in a squeezed row', () => {
  it('floors the group at every chip, gap and +N it holds', () => {
    expect(chipsFloor(1, false)).toBe('3rem');
    expect(chipsFloor(2, false)).toBe('6.25rem');
    expect(chipsFloor(2, true)).toBe('8.5rem');
    render(<DesignTagChips tags={tags} />);
    const group = document.querySelector<HTMLElement>('[data-tag-chips]')!;
    expect(group.style.minWidth).toBe('8.5rem');
    expect(group.className).toContain('shrink-[0.5]');
    expect(group.className).not.toContain('min-w-0');
  });

  it('lets each chip shrink to its own floor, never below', () => {
    render(<DesignTagChips tags={tags.slice(0, 1)} onOpenTag={() => {}} />);
    const button = screen.getByRole('button', { name: 'Tag Alpha' });
    expect(button.className).not.toContain('shrink-0');
    expect(button.parentElement!.className).toContain('min-w-12');
  });

  it('hides on a phone when the row shows dots there', () => {
    render(<DesignTagChips tags={tags} hiddenOnPhone />);
    const group = document.querySelector<HTMLElement>('[data-tag-chips]')!;
    expect(group.className).toContain('hidden sm:inline-flex');
  });
});

describe('TagChip', () => {
  it('keeps its size on its own', () => {
    render(<TagChip tag={tags[0]!} onOpen={() => {}} />);
    const button = screen.getByRole('button', { name: 'Tag Alpha' });
    expect(button.className).toContain('shrink-0');
    expect(button.parentElement!.className).toContain('shrink-0');
  });

  it('is plain text without a way to open', () => {
    render(<TagChip tag={tags[0]!} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Alpha')).toBeTruthy();
  });
});

describe('DesignTagDots', () => {
  it('draws up to three dots, named together', () => {
    const { container } = render(<DesignTagDots tags={tags} />);
    expect(screen.getByRole('img', { name: 'Tags: Alpha, Beta, Gamma, Delta' })).toBeTruthy();
    expect(container.querySelectorAll('[role="img"] > span')).toHaveLength(3);
  });
});

describe('deleteTagMessage', () => {
  it('names how many designs the tag comes off', () => {
    expect(deleteTagMessage('Design', 4)).toBe(
      'Delete the tag Design? It comes off its 4 designs. The designs stay.',
    );
    expect(deleteTagMessage('Design', 1)).toBe(
      'Delete the tag Design? It comes off its one design. The designs stay.',
    );
    expect(deleteTagMessage('Design', 0)).toBe("Delete the tag Design? It isn't on any designs.");
  });
});

describe('designCountLabel', () => {
  it('counts one and many', async () => {
    const { designCountLabel } = await import('./tag-copy');
    expect(designCountLabel(1)).toBe('1 design');
    expect(designCountLabel(3)).toBe('3 designs');
  });
});
