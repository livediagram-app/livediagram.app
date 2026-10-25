import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Developers',
  description:
    'Call the livedesign REST API from your own scripts or the command line: authentication, worked examples, the CLI, errors and limits, and the OpenAPI reference.',
  lede: 'Drive livedesign from your own scripts and integrations. The same REST API the editor uses, callable with an API token, or from a terminal with the livedesign CLI.',
};

export const metadata = supportCategoryMetadata(site, 'developers', COPY);

export default function DevelopersPage() {
  return <SupportCategoryPage site={site} slug="developers" copy={COPY} />;
}
