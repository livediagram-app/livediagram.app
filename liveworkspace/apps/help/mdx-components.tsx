import { createUseMdxComponents } from '@liveworkspace/help-site/mdx-components';
import { site } from '@/lib/help-site';

// What every article renders with, the file @next/mdx looks for (liveworkspace/docs/specs/016-help/help-centre.md "MDX"): the house
// styles and the article components from @liveworkspace/help-site, its Feature cards bound to this catalogue.
export const useMDXComponents = createUseMdxComponents(site);
