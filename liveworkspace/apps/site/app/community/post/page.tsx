import type { Metadata } from 'next';
import { CommunityPostPage } from '@/components/community/CommunityPostPage';

// One post, on its app's address (`livediagram.app/community/post?id=`). One static shell serves every post, so it
// names no canonical and no address of its own: the app's router fills the head with the post's title, description,
// card and canonical before it leaves (@liveworkspace/community-site/router), and the page names its canonical once the
// post loads. liveworkspace.app has no post pages of its own (PostView.tsx), so this shell is never indexed there.
const TITLE = 'Community · liveworkspace';
const DESCRIPTION = 'Something made with a liveworkspace app, shared to the Community.';

// Every field the router names the post in is here for it to fill (title, description, Open Graph, Twitter).
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'liveworkspace', type: 'article' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function CommunityPostRoute() {
  return <CommunityPostPage />;
}
