import { describe, expect, it, vi } from 'vitest';
import { reportImagesUploaded } from './person-events';

describe('reportImagesUploaded', () => {
  it('reports one counted event for the person', async () => {
    const sent: unknown[] = [];
    await reportImagesUploaded(
      { pushPersonEvents: async (e) => void sent.push(...e) },
      'p1',
      3,
      10,
    );
    expect(sent).toEqual([{ type: 'image_uploaded', actorId: 'p1', at: 10, count: 3 }]);
  });

  it('reports nothing without an index or a count, and never throws', async () => {
    const push = vi.fn(async () => {
      throw new Error('down');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await reportImagesUploaded(null, 'p1');
    await reportImagesUploaded({ pushPersonEvents: push }, 'p1', 0);
    expect(push).not.toHaveBeenCalled();
    await expect(reportImagesUploaded({ pushPersonEvents: push }, 'p1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
