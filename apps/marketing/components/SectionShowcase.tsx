import type { LandingSection } from '@/lib/landing-content';
import { ShowcaseStagger } from '@/components/ShowcaseStagger';

// A taller, animated illustration for a feature category, composed from the
// section's own feature mocks (each FeatureArt is a fixed 96px animated scene).
// Stacking the first few, captioned, gives every section a custom showcase that
// clearly highlights what's inside, far more than reusing a single feature's
// art, while reusing the existing pure-CSS animations (so it still survives the
// static export and settles under prefers-reduced-motion).
//
// The scenes animate one at a time (ShowcaseStagger cycles which is active) so
// the montage reads in turn rather than all moving at once. Scenes render here
// on the server and are handed to that client cycler as children.
//
// Shared by the landing advertising block (FeatureCategoryBlock) and the
// category detail-page hero (FeatureCategoryHero) so the two surfaces match.

// How many feature scenes to stack. Three reads as a rich montage without
// running so tall it dwarfs the pitch text beside it.
const SHOWCASE_COUNT = 3;

export function SectionShowcase({ section }: { section: LandingSection }) {
  const scenes = section.items.slice(0, SHOWCASE_COUNT);

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-brand-50/50 p-5 shadow-sm sm:p-6">
      <ShowcaseStagger>
        {scenes.map((item) => (
          <div key={item.title}>
            {/* The mock (its Frame carries its own mb spacing + animation). */}
            {item.art}
            <div className="-mt-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              <span className="text-sm font-medium text-slate-700">{item.title}</span>
            </div>
          </div>
        ))}
      </ShowcaseStagger>
    </div>
  );
}
