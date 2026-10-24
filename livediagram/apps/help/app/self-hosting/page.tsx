import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Self-Hosting',
  description: 'livediagram is open source and MIT-licensed. Run your own instance on Cloudflare.',
  lede: 'The whole product is open source. Here is how to run your own.',
};

export const metadata = supportCategoryMetadata(site, 'self-hosting', COPY);

export default function SelfHostingPage() {
  return <SupportCategoryPage site={site} slug="self-hosting" copy={COPY} />;
}
