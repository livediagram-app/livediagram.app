import type { LandingSection } from '@/lib/landing-content';
import { Showcase } from '@/components/Showcase';

// A category's showcase for its /features/<id> hero (FeatureCategoryHero):
// the shared Showcase montage over the section's own first few features.

// How many feature scenes to stack. Three reads as a rich montage without
// running so tall it dwarfs the pitch text beside it.
const SHOWCASE_COUNT = 3;

export function SectionShowcase({ section }: { section: LandingSection }) {
  return <Showcase items={section.items.slice(0, SHOWCASE_COUNT)} />;
}
