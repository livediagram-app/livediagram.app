import { ContactPage, contactMetadata } from '@liveworkspace/help-site/components/ContactPage';
import { REPO_URL } from '@livedesign/ui';
import { site } from '@/lib/help-site';

export const metadata = contactMetadata(site);

export default function Contact() {
  return <ContactPage site={site} issuesUrl={`${REPO_URL}/issues`} />;
}
