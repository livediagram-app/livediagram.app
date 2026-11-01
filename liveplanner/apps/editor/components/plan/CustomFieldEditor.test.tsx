// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomFieldDef } from '@liveplanner/items';
import { CustomFieldEditor } from './CustomFieldEditor';
import { CustomFieldForm } from './ItemTypeFieldForms';
import { CustomFieldPreview } from './CustomFieldKindParts';

// The Currency and Email kinds in the item panel and the type editor (docs/specs/026-plan/item-types.md "Custom
// field kinds").
afterEach(cleanup);

const VALUE: CustomFieldDef = { id: 'f-value', label: 'Value', kind: 'currency', currency: 'USD' };
const CONTACT: CustomFieldDef = { id: 'f-contact', label: 'Contact', kind: 'email' };

describe('CustomFieldEditor', () => {
  it('saves a currency amount to the penny, beside its code, and clears an empty one', () => {
    const onSave = vi.fn();
    render(
      <CustomFieldEditor id="v" field={VALUE} value={undefined} disabled={false} onSave={onSave} />,
    );
    expect(screen.getByText('USD')).toBeTruthy();
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '12.345' } });
    expect(onSave).toHaveBeenLastCalledWith(12.35);
    fireEvent.blur(input, { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  // Its label is not a <label for> (a press on the words must not tick it), so the box carries the name itself.
  it('names a Checkbox field by its label', () => {
    const onSave = vi.fn();
    render(
      <CustomFieldEditor
        id="k"
        field={{ id: 'f-signed', label: 'Signed Off', kind: 'checkbox' }}
        value={undefined}
        disabled={false}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Signed Off' }));
    expect(onSave).toHaveBeenLastCalledWith(true);
  });

  it('shows GBP for a currency field with no code', () => {
    render(
      <CustomFieldEditor
        id="v"
        field={{ ...VALUE, currency: undefined }}
        value={5}
        disabled={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('GBP')).toBeTruthy();
  });

  it('keeps only an email address, and links a saved one to mail', () => {
    const onSave = vi.fn();
    render(
      <CustomFieldEditor
        id="c"
        field={CONTACT}
        value="sam@acme.test"
        disabled={false}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole('link', { name: 'Email sam@acme.test' }).getAttribute('href')).toBe(
      'mailto:sam@acme.test',
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: 'not an address' } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input, { target: { value: ' jo@acme.test ' } });
    expect(onSave).toHaveBeenLastCalledWith('jo@acme.test');
  });
});

describe('the type editor', () => {
  it('offers a currency field its currency, GBP storing no code', () => {
    const onChange = vi.fn();
    render(<CustomFieldForm field={VALUE} onChange={onChange} />);
    const select = screen.getByLabelText('Currency') as HTMLSelectElement;
    expect(select.value).toBe('USD');
    fireEvent.change(select, { target: { value: 'EUR' } });
    expect(onChange).toHaveBeenLastCalledWith({ currency: 'EUR' });
    fireEvent.change(select, { target: { value: 'GBP' } });
    expect(onChange).toHaveBeenLastCalledWith({ currency: undefined });
  });

  it('keeps a field’s own uncommon currency in the list', () => {
    render(<CustomFieldForm field={{ ...VALUE, currency: 'NZD' }} onChange={vi.fn()} />);
    expect(screen.getByLabelText<HTMLSelectElement>('Currency').value).toBe('NZD');
  });

  it('previews each new kind with a sample value', () => {
    render(<CustomFieldPreview label="Value" kind="currency" options={[]} currency="USD" />);
    expect(screen.getByText(/12,500/)).toBeTruthy();
    cleanup();
    render(<CustomFieldPreview label="Contact" kind="email" options={[]} />);
    expect(screen.getByText('sam@example.com')).toBeTruthy();
    cleanup();
    // A Comments field previews its chip's count (item-types.md "Comments and Votes fields").
    const { container } = render(
      <CustomFieldPreview label="QA Notes" kind="comments" options={[]} />,
    );
    expect(container.textContent).toContain('2');
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
