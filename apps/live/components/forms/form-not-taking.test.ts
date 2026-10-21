import { describe, expect, it } from 'vitest';
import type { FormLinkResponse } from '@liveplanner/api-schema';
import { FORM_NOT_TAKING, formNotTakingReason } from './form-not-taking';

// docs/specs/030-forms/forms.md "Hearing about responses", Not Taking Responses: why a published form takes no
// responses, first match wins; never for a form unpublished, a Draft or one taking responses.

const data = (over: Partial<FormLinkResponse> = {}): FormLinkResponse => ({
  link: { code: 'c', open: true, createdAt: 0 },
  responses: 0,
  unseen: 0,
  suspendedAt: null,
  canPublish: true,
  ...over,
});
const closed = (over: Partial<FormLinkResponse> = {}) =>
  data({ link: { code: 'c', open: false, createdAt: 0 }, ...over });
const reason = (
  link: FormLinkResponse | null,
  over: Partial<Parameters<typeof formNotTakingReason>[0]> = {},
) => formNotTakingReason({ link, problem: null, closedBy: null, full: false, ...over });

describe('formNotTakingReason', () => {
  it('says nothing while taking responses, unpublished or a Draft', () => {
    expect(reason(data())).toBeNull();
    expect(reason(data({ link: null }))).toBeNull();
    expect(reason(null)).toBeNull();
  });

  it('names each reason', () => {
    expect(reason(data({ link: null, suspendedAt: 1 }))).toBe('suspended');
    expect(reason(data(), { problem: 'board_missing' })).toBe('paused');
    expect(reason(closed())).toBe('switched_off');
    expect(reason(data(), { closedBy: 'closes_at' })).toBe('closes_at');
    expect(reason(data(), { closedBy: 'limit' })).toBe('limit');
    expect(reason(data(), { full: true })).toBe('full');
  });

  it('names the fix that unblocks the rest first', () => {
    // A broken destination before the switch: reopening waits on it.
    expect(reason(closed(), { problem: 'board_missing', closedBy: 'limit', full: true })).toBe(
      'paused',
    );
    expect(reason(closed(), { closedBy: 'limit', full: true })).toBe('switched_off');
    expect(reason(data(), { closedBy: 'closes_at', full: true })).toBe('closes_at');
  });

  it('sends each reason somewhere, with a telemetry token', () => {
    expect(FORM_NOT_TAKING.suspended.fix).toBe('share');
    expect(FORM_NOT_TAKING.paused.fix).toBe('destination');
    expect(FORM_NOT_TAKING.switched_off.fix).toBe('share');
    expect(FORM_NOT_TAKING.closes_at.fix).toBe('settings');
    expect(FORM_NOT_TAKING.limit.fix).toBe('settings');
    expect(FORM_NOT_TAKING.full.fix).toBe('responses');
    for (const { telemetry, text } of Object.values(FORM_NOT_TAKING)) {
      expect(telemetry).toMatch(/^NotTaking[A-Za-z]+$/);
      expect(text).not.toMatch(/—/);
    }
  });
});
