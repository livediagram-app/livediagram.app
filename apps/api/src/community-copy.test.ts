import { describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from './test-sqlite-d1';
import { countCommunityCopy } from './community-copy';
import { createCommunityPost, getCommunityPostForDocument } from './db';

// A copy through a Community link counts once per person (docs/specs/025-community/community.md "Likes").

async function published() {
  const db = sqliteD1();
  db.sql
    .prepare(
      "INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'user_author', 'D', 0, 1, 1)",
    )
    .run();
  await createCommunityPost(db.env, 'd1', 'user_author', {
    title: 'Payments platform',
    description: 'How our payment services talk to each other.',
    category: 'architecture',
    tags: [],
    anonymous: true,
  });
  const post = (await getCommunityPostForDocument(db.env, 'd1'))!;
  return { db, code: post.share_code };
}

describe('countCommunityCopy', () => {
  it('counts each copier once', async () => {
    const { db, code } = await published();
    await countCommunityCopy(db.env, code, 'guest-1', '203.0.113.7');
    await countCommunityCopy(db.env, code, 'guest-1', '203.0.113.7');
    await countCommunityCopy(db.env, code, 'guest-2', '198.51.100.4');
    expect((await getCommunityPostForDocument(db.env, 'd1'))!.copy_count).toBe(2);
  });

  it('does nothing for a code with no post, and never throws', async () => {
    const { db } = await published();
    await expect(countCommunityCopy(db.env, 'NOPE', 'guest-1', '1.2.3.4')).resolves.toBeUndefined();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = {
      ...db.env,
      DB: {
        prepare: () => {
          throw new Error('d1 down');
        },
      },
    };
    await expect(
      countCommunityCopy(broken as never, 'CODE', 'guest-1', '1.2.3.4'),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[community] copy count failed', expect.any(Error));
    warn.mockRestore();
  });
});
