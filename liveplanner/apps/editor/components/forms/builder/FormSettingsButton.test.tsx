// @vitest-environment jsdom
// The form's cog (docs/specs/030-forms/forms.md "Responses Go To and Settings"): a press opens it on Responses Go To,
// or on the section its press asked for (Tab Style's Form Settings row, lib/settings-open-on.ts), once.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { requestOpenOn } from '@/lib/settings-open-on';
import { FormSettingsButton } from './FormSettingsButton';

afterEach(cleanup);

const cog = (onOpen: (section: string | null) => void) => {
  render(
    <FormSettingsButton
      tabs={[]}
      link={{} as FormLinkState}
      open={false}
      onOpen={onOpen}
      onClose={() => {}}
    />,
  );
  return screen.getByRole('button', { name: 'Form Settings' });
};

describe('the form cog', () => {
  it('opens on the section its press asked for, then as it always does', () => {
    const onOpen = vi.fn();
    const button = cog(onOpen);
    requestOpenOn('form', 'settings');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onOpen.mock.calls).toEqual([['settings'], [null]]);
  });

  it("leaves another cog's ask alone", () => {
    const onOpen = vi.fn();
    requestOpenOn('sheet', 'view');
    fireEvent.click(cog(onOpen));
    expect(onOpen).toHaveBeenCalledWith(null);
    requestOpenOn('sheet', null);
  });
});
