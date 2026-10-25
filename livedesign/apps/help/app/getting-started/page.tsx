import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Getting Started',
  description:
    'New to livedesign? Create your first design, learn your way around its pages, and share it with your team.',
  lede: 'New here? These guides get you up and running quickly.',
};

export const metadata = supportCategoryMetadata(site, 'getting-started', COPY);

export default function GettingStartedPage() {
  return <SupportCategoryPage site={site} slug="getting-started" copy={COPY} numbered />;
}
