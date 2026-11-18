// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { defaultCatalogue, type ItemTypeDef } from '@liveplanner/items';
import { ItemTypePrefixField, useTypePrefixDraft, type TypePrefixDraft } from './ItemTypePrefix';

// docs/specs/026-plan/item-types.md "Card number prefixes": the type editor's Prefix, beside Name.
afterEach(cleanup);

const types = defaultCatalogue().types;
const task = types.find((t) => t.id === 'task')!;
const seen: { draft?: TypePrefixDraft } = {};

function Field({ type, label, next = 12 }: { type?: ItemTypeDef; label: string; next?: number }) {
  const draft = useTypePrefixDraft(
    type ?? { ...task, id: '', label: '' },
    type,
    types,
    label,
    next,
  );
  useEffect(() => {
    seen.draft = draft;
  });
  return <ItemTypePrefixField id="p" draft={draft} />;
}
const input = () => screen.getByLabelText<HTMLInputElement>('Prefix');
const type = (value: string) => fireEvent.change(input(), { target: { value } });

describe('the Prefix field', () => {
  it('opens a saved type on the prefix its cards show, and previews a card', () => {
    render(<Field type={task} label="Task" />);
    expect(input().value).toBe('T');
    expect(screen.getByText('T-12')).toBeTruthy();
    expect(seen.draft!.stored).toBe('T');
    expect(seen.draft!.problem).toBeNull();
  });

  it('starts a new type empty, its placeholder and stored prefix the one its name makes', () => {
    render(<Field label="Work Item" />);
    expect(input().value).toBe('');
    expect(input().placeholder).toBe('WI');
    expect(screen.getByText('WI-12')).toBeTruthy();
    expect(seen.draft!.stored).toBe('WI');
  });

  it('previews the plan’s real next number, never a made-up one', () => {
    render(<Field type={task} label="Task" next={101} />);
    expect(screen.getByText('T-101')).toBeTruthy();
    expect(screen.queryByText('T-12')).toBeNull();
  });

  it('steps a new type’s made prefix round the plan’s', () => {
    render(<Field label="Theme" />);
    expect(input().placeholder).toBe('TH');
  });

  it('stores what is typed upper case', () => {
    render(<Field type={task} label="Task" />);
    type('tk');
    expect(seen.draft!.stored).toBe('TK');
    expect(screen.getByText('TK-12')).toBeTruthy();
  });

  it('refuses a prefix another type has, naming it', () => {
    render(<Field type={task} label="Task" />);
    type('p');
    expect(seen.draft!.problem).toBe("P is already Project's prefix. Pick another.");
    expect(screen.getByText('Project has it')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('refuses one that is not a prefix', () => {
    render(<Field type={task} label="Task" />);
    type('1x');
    expect(seen.draft!.problem).toBe(
      'A prefix is 1 to 6 letters and digits, starting with a letter.',
    );
    expect(screen.getByText('Letters and digits')).toBeTruthy();
  });

  it('lets a saved type’s emptied field go back to its made prefix', () => {
    render(<Field type={{ ...task, prefix: 'TK' }} label="Task" />);
    type('');
    expect(seen.draft!.stored).toBeUndefined();
    expect(seen.draft!.problem).toBeNull();
  });
});
