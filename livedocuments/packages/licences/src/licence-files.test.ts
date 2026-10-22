import { describe, expect, it } from 'vitest';

import { isLicenceFile, normaliseText, textHash } from './licence-files.ts';

describe('isLicenceFile', () => {
  it.each([
    'LICENSE',
    'LICENCE',
    'license',
    'LICENSE.md',
    'license.txt',
    'LICENSE-MIT',
    'LICENSE_APACHE',
    'COPYING',
    'NOTICE',
    'NOTICE.txt',
    'COPYRIGHT',
    'ThirdPartyNotices.txt',
    'THIRD-PARTY-NOTICES',
  ])('accepts %s', (name) => {
    expect(isLicenceFile(name)).toBe(true);
  });

  it.each(['README.md', 'package.json', 'licenses.json.bak2', 'LICENSES', 'noticeboard.js'])(
    'rejects %s',
    (name) => {
      expect(isLicenceFile(name)).toBe(false);
    },
  );
});

describe('normaliseText', () => {
  it('drops a BOM, unifies line ends and ends on one newline', () => {
    expect(normaliseText('\uFEFFa\r\nb\rc  \n\n\n')).toBe('a\nb\nc\n');
  });

  it('keeps leading indentation and inner blank lines', () => {
    expect(normaliseText('  a\n\n  b')).toBe('  a\n\n  b\n');
  });

  it('is empty for blank text', () => {
    expect(normaliseText(' \r\n\t')).toBe('');
  });
});

describe('textHash', () => {
  it('is 16 hex characters of the sha256', () => {
    expect(textHash('MIT\n')).toMatch(/^[0-9a-f]{16}$/);
    expect(textHash('MIT\n')).toBe(textHash('MIT\n'));
    expect(textHash('MIT\n')).not.toBe(textHash('ISC\n'));
  });
});
