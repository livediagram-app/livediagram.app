import type { Metadata } from 'next';
import { CommunityGalleryPage } from '@/components/community/CommunityGalleryPage';

// Every app's posts together on liveworkspace.app. On an app's address its router serves this same page as that app's
// Community and rewrites the head to say so, with the app's own canonical (@liveworkspace/community-site/router), so
// each app's gallery stays its own page to search engines.
const TITLE = 'Community · liveworkspace';
const DESCRIPTION =
  'What people made with the liveworkspace apps: diagrams, documents, designs and spaces, shared by the people who made them. Find inspiration, then make your own copy.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/community' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/community',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function CommunityPage() {
  return <CommunityGalleryPage />;
}
