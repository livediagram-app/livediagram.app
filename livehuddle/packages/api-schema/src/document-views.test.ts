import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_VIEW_NAMES,
  isTabViewName,
  isViewDoor,
  LINT_VIEW_NAME,
  TAB_VIEW_NAMES,
  VIEW_NAMES,
  VIEW_PARAMETERS,
  VIEW_QUERY,
  VIEW_REQUIRED,
} from './document-views';

describe('document view names', () => {
  it('serves every view but diff through one api door each, the lint on the tab door', () => {
    const served = [...DOCUMENT_VIEW_NAMES, ...TAB_VIEW_NAMES, LINT_VIEW_NAME];
    expect(new Set(served).size).toBe(served.length);
    expect(VIEW_NAMES.filter((v) => !served.includes(v as never))).toEqual(['diff']);
  });

  it('tells tab views and doors apart from anything else', () => {
    expect(isTabViewName('outline')).toBe(true);
    expect(isTabViewName('overview')).toBe(false);
    expect(isTabViewName('diff')).toBe(false);
    expect(isViewDoor('mcp')).toBe(true);
    expect(isViewDoor('web')).toBe(false);
  });
});

describe('view parameters', () => {
  it('lets every served view take view, json, budget and door', () => {
    for (const parameters of Object.values(VIEW_PARAMETERS)) {
      expect(parameters).toEqual(expect.arrayContaining(['view', 'json', 'budget', 'door']));
    }
  });

  it('names only real query parameters, required ones included', () => {
    const names = Object.keys(VIEW_QUERY);
    for (const [view, parameters] of Object.entries(VIEW_PARAMETERS)) {
      for (const p of parameters) expect(names).toContain(p);
      const required = VIEW_REQUIRED[view as keyof typeof VIEW_REQUIRED];
      if (required) expect(parameters).toContain(required);
    }
  });

  it('keeps each query parameter named as itself', () => {
    for (const [key, name] of Object.entries(VIEW_QUERY)) expect(name).toBe(key);
  });
});
