import { describe, expect, it } from 'vitest';
import { commitTag, commitTagInput, tagPreview } from './tag-draft';

// The publish dialog's tag field (docs/specs/025-community/community.md "Tags").

describe('commitTag', () => {
  it('normalises what is typed before it becomes a chip', () => {
    expect(commitTag([], '  Cloud_Native AWS! ')).toEqual({
      tags: ['cloud-native-aws'],
      rejected: null,
    });
  });

  it('ignores a blank draft', () => {
    expect(commitTag(['a1'], '   ')).toEqual({ tags: ['a1'], rejected: null });
  });

  it('rejects a draft that normalises to too little', () => {
    expect(commitTag([], '!!x')).toEqual({ tags: [], rejected: 'invalid' });
  });

  it('rejects a duplicate after normalising', () => {
    expect(commitTag(['kanban'], 'KANBAN')).toEqual({ tags: ['kanban'], rejected: 'duplicate' });
  });

  it('holds at five', () => {
    const five = ['aa', 'bb', 'cc', 'dd', 'ee'];
    expect(commitTag(five, 'ff')).toEqual({ tags: five, rejected: 'full' });
  });
});

describe('commitTagInput', () => {
  it('commits each piece before the last comma and keeps the rest as the draft', () => {
    expect(commitTagInput([], 'aws, Event Storming,ddd')).toEqual({
      tags: ['aws', 'event-storming'],
      draft: 'ddd',
      rejected: null,
    });
  });

  it('reports the first rejection and keeps the good pieces', () => {
    expect(commitTagInput(['aws'], 'AWS,x,retro,')).toEqual({
      tags: ['aws', 'retro'],
      draft: '',
      rejected: 'duplicate',
    });
  });
});

describe('tagPreview', () => {
  it('shows what a draft will be stored as, or null', () => {
    expect(tagPreview('My Tag')).toBe('my-tag');
    expect(tagPreview('x')).toBeNull();
    expect(tagPreview('  ')).toBeNull();
  });
});
