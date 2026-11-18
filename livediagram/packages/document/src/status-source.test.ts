// A shape's live status binding (docs/specs/009-elements/live-status.md "The binding").
import { describe, expect, it } from 'vitest';
import type { Element, Tab } from './index';
import { isStatusUrl, statusUrlsOf, STATUS_URL_MAX } from './status-source';
import { elementValidationIssue, isValidElement } from './validate';

const box = { x: 0, y: 0, width: 120, height: 80 };
const shape = (id: string, statusUrl?: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  ...box,
  ...(statusUrl === undefined ? {} : { statusUrl }),
});
const tab = (elements: Element[]): Pick<Tab, 'elements'> => ({ elements });

const A = 'https://www.githubstatus.com/api/v2/status.json';
const B = 'https://api.example.com/healthz';
const C = 'https://status.example.org/';

describe('isStatusUrl', () => {
  it('takes a public https URL on a host name', () => {
    expect(isStatusUrl(A)).toBe(true);
    expect(isStatusUrl(`https://example.com/${'a'.repeat(STATUS_URL_MAX - 20)}`)).toBe(true);
  });

  it.each([
    ['not a string', 7],
    ['empty', ''],
    ['outer whitespace', ` ${A}`],
    ['too long', `https://example.com/${'a'.repeat(STATUS_URL_MAX)}`],
    ['plain http', 'http://example.com/health'],
    ['credentials', 'https://u:p@example.com/health'],
    ['an address', 'https://10.0.0.1/health'],
    ['an internal name', 'https://grafana.internal/health'],
    ['localhost', 'https://localhost/health'],
  ])('refuses %s', (_, value) => {
    expect(isStatusUrl(value)).toBe(false);
  });
});

describe('the statusUrl field check', () => {
  it('passes a bound shape and an unbound one', () => {
    expect(isValidElement(shape('a', A))).toBe(true);
    expect(isValidElement(shape('a'))).toBe(true);
  });

  it('names statusUrl when a shape is bound to a private address', () => {
    expect(elementValidationIssue(shape('a', 'https://192.168.1.1/'))).toMatchObject({
      field: 'statusUrl',
    });
  });
});

describe('statusUrlsOf', () => {
  it('lists each URL once, in tab then element order, skipping unbound shapes and other elements', () => {
    const sticky = { id: 's', type: 'sticky', ...box, statusUrl: C } as unknown as Element;
    const tabs = [tab([shape('1', B), shape('2'), sticky, shape('3', A)]), tab([shape('4', B)])];
    expect(statusUrlsOf(tabs, 25)).toEqual([B, A]);
  });

  it('stops at the cap', () => {
    const tabs = [tab([shape('1', A), shape('2', B)]), tab([shape('3', C)])];
    expect(statusUrlsOf(tabs, 2)).toEqual([A, B]);
    expect(statusUrlsOf(tabs, 0)).toEqual([]);
    expect(statusUrlsOf([], 25)).toEqual([]);
  });
});
