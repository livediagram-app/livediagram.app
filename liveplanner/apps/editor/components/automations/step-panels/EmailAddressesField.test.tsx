// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Typed-in addresses": Send Email's address chips.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { EmailAddressesField } from './EmailAddressesField';

afterEach(cleanup);

let latest: string[] = [];
function Field({ initial = [] as string[], invalid = false }) {
  const [addresses, setAddresses] = useState(initial);
  return (
    <EmailAddressesField
      addresses={addresses}
      invalid={invalid}
      onChange={(next) => {
        latest = next;
        setAddresses(next);
      }}
    />
  );
}
const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Addresses' });
const type = (value: string) => fireEvent.change(input(), { target: { value } });

describe('EmailAddressesField', () => {
  it('makes a chip on Enter, kept lower case', () => {
    render(<Field />);
    type('Ana@Example.com');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(latest).toEqual(['ana@example.com']);
    expect(input().value).toBe('');
  });

  it('makes a chip at a comma, keeping what follows it in the field', () => {
    render(<Field initial={['ana@example.com']} />);
    type('bo@example.org');
    type('bo@example.org,');
    expect(latest).toEqual(['ana@example.com', 'bo@example.org']);
    type('cy@x.io');
    type('cy@x.io; d');
    expect(latest).toEqual(['ana@example.com', 'bo@example.org', 'cy@x.io']);
    expect(input().value).toBe('d');
  });

  it('splits a paste of several into chips at once, each once', () => {
    render(<Field />);
    fireEvent.paste(input(), {
      clipboardData: { getData: () => 'a@x.com, b@x.com\nc@x.com\r\na@x.com' },
    });
    expect(latest).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
    expect(input().value).toBe('');
  });

  it('flags an address that is not one, for the eye and a screen reader', () => {
    render(<Field />);
    type('ana@example, ok@example.com,');
    expect(latest).toEqual(['ana@example', 'ok@example.com']);
    expect(screen.getByText('ana@example isn’t an email address.')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelectorAll('[data-invalid-chip]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove ana@example' }));
    expect(latest).toEqual(['ok@example.com']);
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });

  it('takes at most 10, then stops taking more', () => {
    render(<Field />);
    type(`${Array.from({ length: 12 }, (_, i) => `p${i}@x.com`).join(' ')} `);
    expect(latest).toHaveLength(10);
    expect(input().disabled).toBe(true);
    expect(input().placeholder).toBe('That is all 10');
  });

  it('adds what is typed on leaving the field, and marks a refused list', () => {
    render(<Field invalid />);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    type('jo@x.com');
    fireEvent.blur(input());
    expect(latest).toEqual(['jo@x.com']);
  });
});
