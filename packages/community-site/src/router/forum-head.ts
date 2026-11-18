// What a Forum topic's page says about itself before any script runs, on an app's address (liveworkspace/docs/specs/
// 007-community/community.md "Search engines"). One static shell serves every topic and is not indexed; the app's
// router (./index.ts) fills its head from the service, so a shared topic link has a preview and an answered
// question can be found. Pure, so it is tested without a runtime.
//
// What it may say is decided here, not trusted to the service: only a topic that is `listed` is named, and an
// answer is quoted only when that reply is `listed` too. A Pending, refused or hidden topic (the service answers none
// of them to an anonymous reader, as the router is) has no head of its own: the shell keeps its generic, noindex one.

import {
  FORUM_HOME_PATH,
  forumAppLabel,
  forumCategoryLabel,
  forumExcerpt,
  forumTopicPath,
  type ForumTopicResponse,
} from '@liveworkspace/community';
import { COMMUNITY_HOME_PATH } from '@liveworkspace/community/paths';
import { breadcrumbJsonLd } from '@liveworkspace/ui/breadcrumb-json-ld';
import { META_DESCRIPTION_MAX, type CommunityRouteSite } from './post-head';

export type ForumTopicHead = {
  title: string;
  description: string;
  canonical: string;
  /** Whether search engines may index it: a listed topic with a marked answer. Others get a preview only. */
  indexable: boolean;
  jsonLd: unknown;
};

const forumName = (site: CommunityRouteSite) => `${site.product} Community Forum`;

/** The topic's head, or null when it is not listed (so nothing of it is ever written into a page). */
export function forumTopicHead(
  site: CommunityRouteSite,
  { topic, replies }: ForumTopicResponse,
): ForumTopicHead | null {
  if (topic.state !== 'listed') return null;
  const canonical = `${site.siteUrl}${forumTopicPath(topic.id)}`;
  const excerpt = forumExcerpt(topic.body);
  const description =
    excerpt.length > META_DESCRIPTION_MAX
      ? `${excerpt.slice(0, META_DESCRIPTION_MAX - 1)}…`
      : excerpt;
  const answer = topic.answerId
    ? replies.find((r) => r.id === topic.answerId && r.state === 'listed')
    : undefined;
  const forum = `${site.siteUrl}${FORUM_HOME_PATH}`;
  const page = {
    name: topic.title,
    text: topic.body,
    url: canonical,
    dateCreated: new Date(topic.createdAt).toISOString(),
    author: { '@type': 'Person', name: topic.author.name },
    about: forumAppLabel(topic.app),
    genre: forumCategoryLabel(topic.category),
  };
  return {
    title: `${topic.title} | ${forumName(site)}`,
    description,
    canonical,
    indexable: answer !== undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        answer
          ? {
              '@type': 'QAPage',
              mainEntity: {
                '@type': 'Question',
                ...page,
                answerCount: 1,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: answer.body,
                  url: canonical,
                  dateCreated: new Date(answer.createdAt).toISOString(),
                  author: { '@type': 'Person', name: answer.author.name },
                },
              },
            }
          : { '@type': 'DiscussionForumPosting', headline: topic.title, ...page },
        breadcrumbJsonLd([
          { name: 'Community', url: `${site.siteUrl}${COMMUNITY_HOME_PATH}` },
          { name: 'Forum', url: forum },
          { name: topic.title, url: canonical },
        ]),
      ],
    },
  };
}
