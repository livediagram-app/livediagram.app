import { describe, expect, it } from 'vitest';
import { publishFieldErrors, publishServerFieldError } from './publish-field-errors';

const valid = {
  title: 'Team Birthday Card',
  description: 'A card the whole team signs, with a page of sticky messages.',
  category: 'infographics',
  tags: ['birthday'],
};

describe('publishFieldErrors', () => {
  it('is empty for a valid draft', () => {
    expect(publishFieldErrors(valid)).toEqual({});
  });

  it('says how many characters the description still needs', () => {
    expect(publishFieldErrors({ ...valid, description: 'Too short.' })).toEqual({
      description: 'Add 10 more characters (at least 20).',
    });
    expect(publishFieldErrors({ ...valid, description: 'x'.repeat(19) }).description).toBe(
      'Add 1 more character (at least 20).',
    );
    expect(publishFieldErrors({ ...valid, description: '   ' }).description).toBe(
      'Describe your board in at least 20 characters.',
    );
  });

  it('marks every failing field at once', () => {
    expect(publishFieldErrors({ title: '', description: '', category: null, tags: ['!'] })).toEqual(
      {
        title: 'Give your board a title.',
        description: 'Describe your board in at least 20 characters.',
        category: 'Choose the category that fits best.',
        tags: 'Tags are 2 to 24 letters, numbers or hyphens, up to 5 of them.',
      },
    );
    expect(publishFieldErrors({ ...valid, title: 'ab' }).title).toBe('Use at least 3 characters.');
  });
});

describe('publishServerFieldError', () => {
  it('words a worker field refusal like the dialog, and ignores the rest', () => {
    expect(
      publishServerFieldError('invalid_description', { ...valid, description: 'short' }),
    ).toEqual({
      field: 'description',
      message: 'Add 15 more characters (at least 20).',
    });
    expect(publishServerFieldError('empty_document', valid)).toBeNull();
  });
});
