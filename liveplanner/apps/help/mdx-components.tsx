import { createUseMdxComponents } from '@liveworkspace/help-site/mdx-components';
import { site } from '@/lib/help-site';

// What every article renders with, the file @next/mdx looks for (docs/specs/018-help/help-app.md "MDX"): the house
// styles and the article components from @liveworkspace/help-site, its Feature cards bound to this catalogue.
export const useMDXComponents = createUseMdxComponents(site);

// SheetFunctionList renders its reference tables with the article components.
export { InlineCode, SectionHeading, Table, Td, Th } from '@liveworkspace/help-site/mdx-components';
