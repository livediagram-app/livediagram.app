import { describe, expect, it } from 'vitest';
import type { ForumPostState } from '@liveworkspace/community';
import {
  forumReplyFixture as replyFixture,
  forumTopicFixture as topicFixture,
} from '@liveworkspace/community/testing';
import { forumTopicHead } from './forum-head';
import { META_DESCRIPTION_MAX, type CommunityRouteSite } from './post-head';

const SITE: CommunityRouteSite = {
  app: 'livediagram.app',
  siteUrl: 'https://www.livediagram.app',
  product: 'livediagram',
  nouns: 'canvases',
};

describe('a Forum topic’s head', () => {
  it('names a listed topic, with its words as the preview, but only an answered one is indexable', () => {
    const head = forumTopicHead(SITE, { topic: topicFixture(), replies: [] })!;
    expect(head.title).toBe('How do I connect two shapes? | livediagram Community Forum');
    expect(head.description).toBe(
      'I drew two boxes and want an arrow between them. What is the quickest way?',
    );
    expect(head.canonical).toBe('https://www.livediagram.app/community/forum/topic?id=t1');
    expect(head.indexable).toBe(false);
    expect(JSON.stringify(head.jsonLd)).toContain('DiscussionForumPosting');
  });

  it('is indexable with a listed answer, and says it as a question and its answer', () => {
    const topic = topicFixture({ answerId: 'r1' });
    const head = forumTopicHead(SITE, { topic, replies: [replyFixture()] })!;
    expect(head.indexable).toBe(true);
    const json = JSON.stringify(head.jsonLd);
    expect(json).toContain('QAPage');
    expect(json).toContain('Drag from the dot');
    expect(json).toContain('BreadcrumbList');
  });

  it('does not quote an answer that is not listed, nor count it as one', () => {
    const topic = topicFixture({ answerId: 'r1' });
    for (const state of ['pending', 'refused', 'hidden'] as ForumPostState[]) {
      const head = forumTopicHead(SITE, { topic, replies: [replyFixture({ state })] })!;
      expect(head.indexable).toBe(false);
      expect(JSON.stringify(head.jsonLd)).not.toContain('Drag from the dot');
    }
    const missing = forumTopicHead(SITE, { topic, replies: [] })!;
    expect(missing.indexable).toBe(false);
  });

  it('says nothing of a topic that is Pending, refused or hidden', () => {
    for (const state of ['pending', 'refused', 'hidden'] as ForumPostState[]) {
      const topic = topicFixture({
        state,
        answerId: 'r1',
        title: 'Secret title',
        body: 'Secret body words',
      });
      expect(forumTopicHead(SITE, { topic, replies: [replyFixture()] })).toBeNull();
    }
  });

  it('keeps the description to a search result’s length, on a whole word', () => {
    const body = `${'word '.repeat(100)}end`;
    const head = forumTopicHead(SITE, { topic: topicFixture({ body }), replies: [] })!;
    expect(head.description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(head.description.endsWith('…')).toBe(true);
  });
});
