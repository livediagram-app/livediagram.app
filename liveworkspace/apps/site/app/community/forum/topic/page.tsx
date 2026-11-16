import type { Metadata } from 'next';
import { ForumTopicPage } from '@/components/community/forum/ForumTopicPage';

// One Forum topic (`/community/forum/topic?id=`). One static shell serves every topic, so it names no canonical of its
// own and is not indexed; the page names the topic in its title once it loads.
const TITLE = 'Community Forum · liveworkspace';
const DESCRIPTION = 'A question in the liveworkspace Community Forum, and its answers.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'liveworkspace', type: 'article' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: true },
};

export default function CommunityForumTopicRoute() {
  return <ForumTopicPage />;
}
