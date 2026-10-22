import { describe, expect, it } from 'vitest';
import type { FormLinkResponse } from '@livedesign/api-schema';
import { formMetricShown } from './form-metric-shown';

// What a figure from a form shows (docs/specs/026-plan/plan-tabs.md "Form Metrics").

const NOW = Date.UTC(2026, 9, 15, 12);
const form = { heading: 'RSVP' };
const link = (over: Partial<FormLinkResponse> = {}): FormLinkResponse => ({
  link: { code: 'abc', open: true } as FormLinkResponse['link'],
  responses: 42,
  unseen: 3,
  suspendedAt: null,
  canPublish: true,
  ...over,
});
const shown = (
  metric: Parameters<typeof formMetricShown>[0],
  over: Partial<Parameters<typeof formMetricShown>[1]> = {},
) => formMetricShown(metric, { form, link: link(), offline: false, now: NOW, ...over });

describe('formMetricShown', () => {
  it('counts responses and the new ones', () => {
    expect(shown('responses')).toEqual({ hero: '42', line: 'responses so far' });
    expect(shown('new').hero).toBe('3');
    expect(shown('new', { link: link({ unseen: 0 }) }).line).toBe(
      'nothing new since you last looked',
    );
  });

  it('says whether it takes responses', () => {
    expect(shown('status')).toMatchObject({ hero: 'Accepting', tone: 'green' });
    expect(
      shown('status', {
        link: link({ link: { code: 'abc', open: false } as FormLinkResponse['link'] }),
      }),
    ).toMatchObject({ hero: 'Closed', tone: 'amber' });
    expect(shown('status', { link: link({ link: null }) })).toMatchObject({
      hero: 'Not Published',
    });
    expect(shown('status', { link: link({ link: null, suspendedAt: 1 }) })).toMatchObject({
      hero: 'Suspended',
      tone: 'red',
    });
    expect(shown('status', { offline: true }).hero).toBe('Draft');
    // Switched on, but past its Close On or at its Response Limit: closed to respondents.
    expect(shown('status', { form: { ...form, closesAt: NOW - 1 } }).hero).toBe('Closed');
    expect(shown('status', { form: { ...form, limit: 42 } }).hero).toBe('Closed');
    expect(shown('status', { form: { ...form, limit: 43 } }).hero).toBe('Accepting');
  });

  it('measures against the limit, when there is one', () => {
    expect(shown('limit', { form: { ...form, limit: 100 } })).toMatchObject({
      hero: '42 / 100',
      line: '58 to go',
      share: 0.42,
    });
    expect(shown('limit', { form: { ...form, limit: 40 } })).toMatchObject({
      line: 'The limit is reached',
      share: 1,
    });
    expect(shown('limit').hero).toBe('No limit');
  });

  it('counts down to closing', () => {
    expect(shown('closes').hero).toBe('No date');
    expect(shown('closes', { form: { ...form, closesAt: NOW + 3 * 86400000 } }).hero).toBe(
      '3 days',
    );
    expect(shown('closes', { form: { ...form, closesAt: NOW + 3600000 } }).hero).toBe('Today');
    expect(shown('closes', { form: { ...form, closesAt: NOW - 1 } }).hero).toBe('Closed');
  });

  it('gives a link card its line', () => {
    expect(shown('link')).toEqual({ hero: null, line: 'Anyone with the link can fill it in' });
    expect(shown('link', { link: link({ link: null }) }).line).toBe('Publish it from Share Form');
  });
});
