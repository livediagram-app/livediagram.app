import { describe, expect, it } from 'vitest';
import {
  CHANGESET_PART_MAX_BYTES,
  CHANGESET_RELAY_MAX_BYTES,
  CHANGESET_RETENTION_DAYS,
  CHANGESET_SUMMARY_MAX,
  isChangesetId,
  parseChangesetSeen,
  revOfEtag,
  tabEtag,
} from './changesets';
import { MAX_TAB_BYTES } from './tab-size';
import { TRASH_RETENTION_DAYS } from './trash';

describe('changeset ids', () => {
  it('accepts cs_ and 10 lowercase Crockford base32 characters', () => {
    expect(isChangesetId('cs_8k2m4q7d1x')).toBe(true);
  });

  it('refuses other shapes', () => {
    for (const bad of [
      'cs_8k2m4q7d1',
      'cs_8k2m4q7d1xy',
      'CS_8k2m4q7d1x',
      'cs_8K2M4Q7D1X',
      'cs_8k2m4q7d1i',
      'cs_8k2m4q7d1u',
      8,
    ]) {
      expect(isChangesetId(bad)).toBe(false);
    }
  });
});

describe('X-Changeset-Seen', () => {
  it('reads a decimal revision', () => {
    expect(parseChangesetSeen('0')).toBe(0);
    expect(parseChangesetSeen('42')).toBe(42);
  });

  it('treats anything else as absent', () => {
    for (const bad of [null, '', '-1', '1.5', ' 4', '0x10', '99999999999999999']) {
      expect(parseChangesetSeen(bad)).toBeNull();
    }
  });
});

describe('the tab ETag', () => {
  it('is weak and carries the revision', () => {
    expect(tabEtag(41)).toBe('W/"41"');
    expect(revOfEtag(tabEtag(41))).toBe(41);
    expect(
      [null, '"41"', 'W/"x"', 'W/"99999999999999999"', 'W/"9999999999999999"'].map(revOfEtag),
    ).toEqual([null, null, null, null, null]);
  });
});

describe('limits', () => {
  it('keeps every part inside one D1 row and the relay inside the room frame', () => {
    expect(CHANGESET_PART_MAX_BYTES).toBe(MAX_TAB_BYTES);
    expect(CHANGESET_RELAY_MAX_BYTES).toBeLessThan(256 * 1024);
  });

  it('retains changesets as long as the Trash keeps a document, and caps the summary at 80', () => {
    expect(CHANGESET_RETENTION_DAYS).toBe(TRASH_RETENTION_DAYS);
    expect(CHANGESET_SUMMARY_MAX).toBe(80);
  });
});
