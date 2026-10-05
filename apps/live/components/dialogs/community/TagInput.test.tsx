// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TagInput } from './TagInput';

// The publish dialog's tag field (docs/specs/025-community/community.md "Tags").

afterEach(cleanup);

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagInput tags={tags} onChange={setTags} />
      <output data-testid="tags">{tags.join(' ')}</output>
    </>
  );
}

const field = () => screen.getByLabelText('Tags') as HTMLInputElement;
const tags = () => screen.getByTestId('tags').textContent;

describe('TagInput', () => {
  it('adds a normalised chip on Enter and previews it while typing', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: 'Event Storming' } });
    expect(screen.getByText('Adds as #event-storming')).toBeTruthy();
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(tags()).toBe('event-storming');
    expect(field().value).toBe('');
  });

  it('commits on leaving the field, and lets focus go where it was going', () => {
    render(
      <>
        <Harness />
        <button type="button">Next</button>
      </>,
    );
    field().focus();
    fireEvent.change(field(), { target: { value: 'aws' } });
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.blur(field());
    expect(tags()).toBe('aws');
    expect(document.activeElement).toBe(next);
  });

  it('adds on a comma and keeps what follows it', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: 'aws,gc' } });
    expect(tags()).toBe('aws');
    expect(field().value).toBe('gc');
  });

  it('keeps a rejected draft and says why', () => {
    render(<Harness initial={['aws']} />);
    fireEvent.change(field(), { target: { value: 'AWS' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(tags()).toBe('aws');
    expect(field().value).toBe('AWS');
    expect(screen.getByText('That tag is already added.')).toBeTruthy();
  });

  it('takes the last chip back on Backspace in an empty field', () => {
    render(<Harness initial={['aws', 'retro']} />);
    fireEvent.keyDown(field(), { key: 'Backspace' });
    expect(tags()).toBe('aws');
  });

  it('removes a chip from its own button', () => {
    render(<Harness initial={['aws', 'retro']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag aws' }));
    expect(tags()).toBe('retro');
  });
});

describe('TagInput focus', () => {
  it('comes back to the field after a chip goes, and to the last chip while the field is full', () => {
    render(<Harness initial={['aws', 'retro']} />);
    const remove = screen.getByRole('button', { name: 'Remove tag aws' });
    remove.focus();
    fireEvent.click(remove);
    expect(document.activeElement).toBe(field());

    cleanup();
    render(<Harness initial={['a1', 'a2', 'a3', 'a4']} />);
    field().focus();
    fireEvent.change(field(), { target: { value: 'fifth' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(field().disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove tag fifth' }));
  });
});
