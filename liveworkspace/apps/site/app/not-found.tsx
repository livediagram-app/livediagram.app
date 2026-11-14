import type { Metadata } from 'next';
import { lucideCompass } from '@liveworkspace/icons/lucide';
import { buttonClassName, ButtonContent, lucideGlyph } from '@liveworkspace/ui';
import { ErrorCard } from '@/components/ErrorCard';

// Its own title, and no home-page Open Graph address: without this, the root layout's title, description and
// `og:url` of `/` made every unknown address announce itself as the home page. Never indexed.
const TITLE = 'Nothing here · liveworkspace';
const DESCRIPTION = 'liveworkspace has no page at this address.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'liveworkspace', type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

const CompassIcon = lucideGlyph(lucideCompass, 16);

// An address liveworkspace.app has no page for (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the site's
// error card, drawn here on the server, so it ships no script. Kept light: Next carries this tree in every page.
export default function NotFound() {
  return (
    <ErrorCard
      icon={<CompassIcon />}
      title="Nothing here"
      description="That page doesn’t exist. Your work is in its app, and every app is a click away from the home page."
      statusLead="Followed a link that should work?"
    >
      <a href="/" className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Go to the Home Page</ButtonContent>
      </a>
    </ErrorCard>
  );
}
