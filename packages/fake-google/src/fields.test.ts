import { describe, expect, it } from 'vitest';
import { parseFields, pickFields } from './fields';

describe('fields', () => {
  it('keeps only the requested fields, nested and across arrays', () => {
    const tree = parseFields('nextPageToken,changes(fileId,file(id,parents))');
    expect(
      pickFields(
        {
          nextPageToken: 'n',
          kind: 'drive#changeList',
          changes: [{ fileId: 'a', time: 't', file: { id: 'a', name: 'x', parents: ['p'] } }],
        },
        tree,
      ),
    ).toEqual({
      nextPageToken: 'n',
      changes: [{ fileId: 'a', file: { id: 'a', parents: ['p'] } }],
    });
  });

  it('treats * as everything', () => {
    expect(pickFields({ a: 1, b: 2 }, parseFields('*'))).toEqual({ a: 1, b: 2 });
  });

  it('refuses an unbalanced spec', () => {
    expect(() => parseFields('files(id')).toThrow();
    expect(() => parseFields('id)')).toThrow();
  });
});
