import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Getting Started',
  description:
    'New to livediagram? Create your first diagram, learn the canvas, and share it with your team.',
  lede: 'New here? These guides get you up and running quickly.',
};

export const metadata = supportCategoryMetadata(site, 'getting-started', COPY);

export default function GettingStartedPage() {
  return <SupportCategoryPage site={site} slug="getting-started" copy={COPY} numbered />;
}
