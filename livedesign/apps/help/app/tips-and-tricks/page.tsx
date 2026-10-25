import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Tips and Tricks',
  description: 'Shortcuts and lesser-known features that make editing in livedesign faster.',
  lede: 'Work faster with these shortcuts and hidden features.',
};

export const metadata = supportCategoryMetadata(site, 'tips-and-tricks', COPY);

export default function TipsAndTricksPage() {
  return <SupportCategoryPage site={site} slug="tips-and-tricks" copy={COPY} />;
}
