import { ContactPage, contactMetadata } from '@liveworkspace/help-site/components/ContactPage';
import { EDITION } from '@/editions';
import { site } from '@/lib/help-site';

export const metadata = contactMetadata(site);

export default function Contact() {
  return <ContactPage site={site} issuesUrl={EDITION.issuesUrl} />;
}
