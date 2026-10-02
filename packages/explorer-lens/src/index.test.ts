import { describe, expect, it } from 'vitest';
import * as lens from './index';

describe('the public surface', () => {
  it('exposes the parse, write, match, suggest, view-model, URL and telemetry functions', () => {
    const names = [
      'parseLens',
      'serialiseLens',
      'setDimension',
      'removeTerm',
      'applyLens',
      'matchesLens',
      'documentSubject',
      'sharedSubject',
      'suggestTokens',
      'acceptSuggestion',
      'lensChips',
      'lensPills',
      'issueMessage',
      'announceResults',
      'readLensQuery',
      'withLensQuery',
      'carryLensQuery',
      'selectedFacets',
    ];
    expect(names.filter((name) => typeof lens[name as keyof typeof lens] !== 'function')).toEqual(
      [],
    );
  });
});
