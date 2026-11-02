// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormLinkResponse } from '@liveplanner/api-schema';
import type { FormLinkState } from '@/hooks/forms/useFormLink';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { FormStatusBar } from './FormStatusBar';

// docs/specs/030-forms/forms.md "Hearing about responses": a published form taking no responses shows an Editor the
// red Not Taking Responses after the count, saying why and opening where it is fixed; Participants and Viewers see
// the state pill alone.

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const state = (data: Partial<FormLinkResponse> | null): FormLinkState =>
  ({
    status: 'ready',
    link: data && {
      link: { code: 'c', open: false, createdAt: 0 },
      responses: 0,
      unseen: 0,
      suspendedAt: null,
      canPublish: true,
      ...data,
    },
  }) as unknown as FormLinkState;

const warning = () => screen.queryByText('Not Taking Responses');

describe('FormStatusBar, Not Taking Responses', () => {
  it('shows an Editor why, after the count, and opens Share Form for the switch', () => {
    const onNotTaking = vi.fn();
    render(
      <FormStatusBar
        link={state({})}
        problem={null}
        canEdit
        onFix={() => {}}
        onNotTaking={onNotTaking}
      />,
    );
    const button = screen.getByRole('button', { name: /^Not Taking Responses\. Accepting/ });
    // Right of the count, inside the same bar.
    const bar = button.closest('[data-form-status]')!;
    expect(bar.textContent.indexOf('responses')).toBeLessThan(
      bar.textContent.indexOf('Not Taking Responses'),
    );
    expect(button.className).toContain('text-red-700');
    expect(button.className).toContain('dark:text-red-300');
    fireEvent.click(button);
    expect(onNotTaking).toHaveBeenCalledWith('share');
    expect(track).toHaveBeenCalledWith('Form', 'Opened', 'NotTakingSwitchedOff');
  });

  it('opens Settings past Close On', () => {
    const onNotTaking = vi.fn();
    render(
      <FormStatusBar
        link={state({ link: { code: 'c', open: true, createdAt: 0 } })}
        problem={null}
        closedBy="closes_at"
        canEdit
        onFix={() => {}}
        onNotTaking={onNotTaking}
      />,
    );
    // The switch is on but the time has passed: it reads Closed and warns.
    expect(screen.getByText('Closed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Close On time has passed/ }));
    expect(onNotTaking).toHaveBeenCalledWith('settings');
  });

  it('warns of a suspended link too', () => {
    render(
      <FormStatusBar
        link={state({ link: null, suspendedAt: 5 })}
        problem={null}
        canEdit
        onFix={() => {}}
        onNotTaking={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /suspended after reports/ })).toBeTruthy();
  });

  it('only says, with nothing to open, for a full project with no responses tab', () => {
    render(
      <FormStatusBar
        link={state({ link: { code: 'c', open: true, createdAt: 0 } })}
        problem={null}
        full
        canEdit
        onFix={() => {}}
        onNotTaking={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Not Taking Responses/ })).toBeNull();
    expect(screen.getByRole('status', { name: /holds as many cards/ })).toBeTruthy();
  });

  it('says nothing while taking responses, unpublished, or to someone who may not edit', () => {
    const bar = (data: Partial<FormLinkResponse> | null, canEdit = true) =>
      render(
        <FormStatusBar
          link={state(data)}
          problem={null}
          canEdit={canEdit}
          onFix={() => {}}
          onNotTaking={vi.fn()}
        />,
      );
    bar({ link: { code: 'c', open: true, createdAt: 0 } });
    expect(warning()).toBeNull();
    cleanup();
    bar({ link: null });
    expect(warning()).toBeNull();
    cleanup();
    bar({}, false);
    expect(warning()).toBeNull();
    expect(screen.getByText('Closed')).toBeTruthy();
  });
});

describe('FormStatusBar, the count', () => {
  // docs/specs/004-interface-design/touch-targets.md: the count is a 20px line of text that opens the responses, so
  // on a touch screen its tap area reaches 44px tall.
  it("takes a finger's tap area when it opens the responses", () => {
    render(
      <FormStatusBar
        link={state({ responses: 3 })}
        problem={null}
        canEdit
        onFix={() => {}}
        onOpenResponses={() => {}}
      />,
    );
    const count = screen.getByRole('button', { name: /3 responses/ });
    expect(count.className.split(' ')).toEqual(
      expect.arrayContaining(['relative', 'touch-target-y']),
    );
  });
});
