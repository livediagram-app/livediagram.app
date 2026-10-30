import { describe, expect, it } from 'vitest';
import {
  attachmentCover,
  attachmentName,
  attachmentSizeText,
  attachmentsValue,
  itemAttachments,
  normaliseAttachments,
  withAttachmentsAdded,
  withCover,
  withoutAttachment,
  type ItemAttachment,
} from './attachments';
import { validateFields } from './fields';
import { ITEM_ATTACHMENTS_MAX, ITEM_ATTACHMENT_BYTES_MAX, ITEM_ATTACHMENT_NAME_MAX } from './limits';
import { resolveFields } from './plan-names';
import { ITEM_TYPES } from './item-types';
import { tabsOf } from './type-catalogue';

// docs/specs/026-plan/items.md "Attachments".

const pic = (id: string, extra: Partial<ItemAttachment> = {}): ItemAttachment => ({
  id,
  name: `${id}.png`,
  size: 2048,
  type: 'image/png',
  ...extra,
});

describe('an Attachments value', () => {
  it('keeps up to the cap of pictures, each once, at most one the cover', () => {
    expect(normaliseAttachments([pic('a'), pic('b', { cover: true })])).toEqual([
      pic('a'),
      pic('b', { cover: true }),
    ]);
    const full = Array.from({ length: ITEM_ATTACHMENTS_MAX }, (_, i) => pic(`p${i}`));
    expect(normaliseAttachments(full)).toHaveLength(ITEM_ATTACHMENTS_MAX);
    expect(normaliseAttachments([...full, pic('one-more')])).toBeUndefined();
    expect(normaliseAttachments([pic('a'), pic('a')])).toBeUndefined();
    expect(
      normaliseAttachments([pic('a', { cover: true }), pic('b', { cover: true })]),
    ).toBeUndefined();
  });

  it('refuses anything that is not a picture entry', () => {
    const bad: unknown[] = [
      'a',
      null,
      { ...pic('a'), id: '' },
      { ...pic('a'), id: 'x'.repeat(201) },
      { ...pic('a'), name: 7 },
      { ...pic('a'), name: 'n'.repeat(ITEM_ATTACHMENT_NAME_MAX + 1) },
      { ...pic('a'), size: 0 },
      { ...pic('a'), size: 1.5 },
      { ...pic('a'), size: ITEM_ATTACHMENT_BYTES_MAX + 1 },
      { ...pic('a'), type: 'image/svg+xml' },
      { ...pic('a'), cover: false },
    ];
    for (const entry of bad) expect(normaliseAttachments([entry])).toBeUndefined();
    expect(normaliseAttachments('not a list')).toBeUndefined();
  });

  it('names a blank file Image, and trims a name', () => {
    expect(normaliseAttachments([{ ...pic('a'), name: '   ' }])?.[0]?.name).toBe('Image');
    expect(attachmentName('  shot.png ')).toBe('shot.png');
    expect(Array.from(attachmentName('é'.repeat(300)))).toHaveLength(ITEM_ATTACHMENT_NAME_MAX);
  });

  it('is checked by every door through validateFields, an empty list refused', () => {
    expect(validateFields({ attachments: [pic('a')] }, 'patch')).toEqual({
      ok: true,
      fields: { attachments: [pic('a')] },
    });
    expect(validateFields({ attachments: [] }, 'patch')).toMatchObject({
      ok: false,
      error: 'field_value_invalid',
    });
    const over = Array.from({ length: ITEM_ATTACHMENTS_MAX + 1 }, (_, i) => pic(`p${i}`));
    expect(validateFields({ attachments: over }, 'patch')).toMatchObject({ ok: false });
  });
});

describe('a card’s pictures', () => {
  const item = { fields: { attachments: [pic('a'), pic('b', { cover: true })] } };

  it('reads its list and its cover, none for a card without', () => {
    expect(itemAttachments(item).map((a) => a.id)).toEqual(['a', 'b']);
    expect(attachmentCover(item)?.id).toBe('b');
    expect(itemAttachments({ fields: {} })).toEqual([]);
    expect(attachmentCover({ fields: { attachments: 'junk' } })).toBeUndefined();
  });

  it('adds at the end, never twice, never a cover, up to the cap', () => {
    const { list, skipped } = withAttachmentsAdded(
      [pic('a')],
      [pic('a'), pic('b', { cover: true })],
    );
    expect(list).toEqual([pic('a'), pic('b')]);
    expect(skipped).toBe(0);
    const full = Array.from({ length: ITEM_ATTACHMENTS_MAX }, (_, i) => pic(`p${i}`));
    expect(withAttachmentsAdded(full, [pic('x'), pic('y')]).skipped).toBe(2);
  });

  it('sets, moves and clears the cover, and removes a picture', () => {
    const list = itemAttachments(item);
    expect(attachmentCover({ fields: { attachments: withCover(list, 'a') } as never })?.id).toBe(
      'a',
    );
    expect(withCover(list, null).some((a) => a.cover)).toBe(false);
    expect(withoutAttachment(list, 'b').map((a) => a.id)).toEqual(['a']);
    expect(attachmentsValue([])).toBeUndefined();
    expect(attachmentsValue(list)).toBe(list);
  });

  it('says a size as people read it', () => {
    expect(attachmentSizeText(200)).toBe('1 KB');
    expect(attachmentSizeText(820 * 1024)).toBe('820 KB');
    expect(attachmentSizeText(1.2 * 1024 * 1024)).toBe('1.2 MB');
    expect(attachmentSizeText(2 * 1024 * 1024)).toBe('2 MB');
    expect(attachmentSizeText(10 * 1024 * 1024)).toBe('10 MB');
  });
});

describe('Attachments on a type', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const withFiles = { ...task, fields: [...task.fields, 'attachments'] };

  it('sits in the default Overview tab, with the long-form fields', () => {
    expect(tabsOf(withFiles)[0]!.fields).toContain('attachments');
  });

  it('is never set by an agent, only cleared', () => {
    const named = resolveFields({ attachments: [pic('a')] }, withFiles, {
      statuses: [],
      items: [],
    });
    expect(named).toMatchObject({ ok: false, message: 'Attachments are added in the card panel.' });
  });
});
