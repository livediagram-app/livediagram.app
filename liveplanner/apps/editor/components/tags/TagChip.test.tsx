// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tag } from '@liveplanner/api-schema';
import { ProjectTagChips, ProjectTagDots, TagChip, chipsFloor } from './TagChip';
import { deleteTagMessage } from './TagActionsMenu';

// docs/specs/013-workspace/tags.md "Where tags show".

afterEach(cleanup);

const tag = (id: string, name: string): Tag => ({ id, name, colour: 'blue', createdAt: 1 });
const tags = [tag('a', 'Alpha'), tag('b', 'Beta'), tag('c', 'Gamma'), tag('d', 'Delta')];

describe('ProjectTagChips', () => {
  it('shows two chips, then +N naming the rest', () => {
    render(<ProjectTagChips tags={tags} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByText('Gamma')).toBeNull();
    expect(screen.getByLabelText('2 more tags: Gamma, Delta').textContent).toBe('+2');
  });

  it('shows nothing for no tags', () => {
    const { container } = render(<ProjectTagChips tags={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('opens the tag, never the row under it', () => {
    const onOpenTag = vi.fn();
    const onRow = vi.fn();
    render(
      <a href="#doc" onClick={onRow}>
        <ProjectTagChips tags={tags.slice(0, 1)} onOpenTag={onOpenTag} />
      </a>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tag Alpha' }));
    expect(onOpenTag).toHaveBeenCalledWith('a');
    expect(onRow).not.toHaveBeenCalled();
  });
});

// A squeezed row truncates its chips' names rather than drawing them over the pills beside them.
describe('ProjectTagChips in a squeezed row', () => {
  it('floors the group at every chip, gap and +N it holds', () => {
    expect(chipsFloor(1, false)).toBe('3rem');
    expect(chipsFloor(2, false)).toBe('6.25rem');
    expect(chipsFloor(2, true)).toBe('8.5rem');
    render(<ProjectTagChips tags={tags} />);
    const group = document.querySelector<HTMLElement>('[data-tag-chips]')!;
    expect(group.style.minWidth).toBe('8.5rem');
    expect(group.className).toContain('shrink-[0.5]');
    expect(group.className).not.toContain('min-w-0');
  });

  it('lets each chip shrink to its own floor, never below', () => {
    render(<ProjectTagChips tags={tags.slice(0, 1)} onOpenTag={() => {}} />);
    const button = screen.getByRole('button', { name: 'Tag Alpha' });
    expect(button.className).not.toContain('shrink-0');
    expect(button.parentElement!.className).toContain('min-w-12');
  });

  it('hides on a phone when the row shows dots there', () => {
    render(<ProjectTagChips tags={tags} hiddenOnPhone />);
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

describe('ProjectTagDots', () => {
  it('draws up to three dots, named together', () => {
    const { container } = render(<ProjectTagDots tags={tags} />);
    expect(screen.getByRole('img', { name: 'Tags: Alpha, Beta, Gamma, Delta' })).toBeTruthy();
    expect(container.querySelectorAll('[role="img"] > span')).toHaveLength(3);
  });
});

describe('deleteTagMessage', () => {
  it('names how many projects the tag comes off', () => {
    expect(deleteTagMessage('Design', 4)).toBe(
      'Delete the tag Design? It comes off its 4 plans. The plans stay.',
    );
    expect(deleteTagMessage('Design', 1)).toBe(
      'Delete the tag Design? It comes off its one plan. The plans stay.',
    );
    expect(deleteTagMessage('Design', 0)).toBe("Delete the tag Design? It isn't on any plans.");
  });
});

describe('projectCountLabel', () => {
  it('counts one and many', async () => {
    const { projectCountLabel } = await import('./tag-copy');
    expect(projectCountLabel(1)).toBe('1 plan');
    expect(projectCountLabel(3)).toBe('3 plans');
  });
});
