import { describe, expect, it } from 'vitest';
import {
  describeImportImageReport,
  emptyImportImageReport,
  importImageReportTotal,
} from './report';

describe('describeImportImageReport', () => {
  it('describes a clean import', () => {
    expect(describeImportImageReport({ imported: 1, deduped: 0, placeholders: {} })).toEqual({
      lines: ['1 image imported'],
      failures: [],
      hint: null,
    });
  });

  it('pluralises and lists failures in their fixed order with their sentences', () => {
    const d = describeImportImageReport({
      imported: 12,
      deduped: 3,
      placeholders: { 'upload-failed': 1, 'gallery-full': 2 },
    });
    expect(d.lines).toEqual([
      '12 images imported',
      '3 already in your gallery',
      '3 left as placeholders',
    ]);
    expect(d.failures).toEqual([
      {
        failure: 'gallery-full',
        count: 2,
        sentence: "Your image gallery is full. Free up space in the Explorer's Image Gallery.",
      },
      {
        failure: 'upload-failed',
        count: 1,
        sentence: "The upload didn't go through. Check your connection and try again.",
      },
    ]);
    expect(d.hint).toBe('Double-click a placeholder to add its image.');
  });

  it('says one placeholder in the singular', () => {
    expect(
      describeImportImageReport({ imported: 0, deduped: 0, placeholders: { 'missing-bytes': 1 } })
        .lines,
    ).toEqual(['1 left as a placeholder']);
  });
});

describe('report helpers', () => {
  it('starts empty and totals every element', () => {
    expect(emptyImportImageReport()).toEqual({ imported: 0, deduped: 0, placeholders: {} });
    expect(
      importImageReportTotal({
        imported: 2,
        deduped: 1,
        placeholders: { 'too-large': 2, unsupported: 1 },
      }),
    ).toBe(6);
  });
});
