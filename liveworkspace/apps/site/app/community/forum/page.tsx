import type { Metadata } from 'next';
import { ForumListPage } from '@/components/community/forum/ForumListPage';

// The Community's Forum: one for every app, questions and answers (liveworkspace/docs/specs/007-community/community.md
// "The Forum"). The same page on liveworkspace.app and on each app's address, as the gallery is.
const TITLE = 'Community Forum · liveworkspace';
const DESCRIPTION =
  'Ask how to do something in the liveworkspace apps, share a tip, or help someone else. Questions and answers from the people who use them.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/community/forum' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/community/forum',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function CommunityForumPage() {
  return <ForumListPage />;
}
