import type { FeatureProps } from '@/components/Section';
import { ShowcaseStagger } from '@/components/ShowcaseStagger';

// A taller, animated illustration composed from feature mocks (each FeatureArt
// is a fixed 96px animated scene). Stacking a few, captioned, reuses the
// existing pure-CSS animations, so it survives the static export and settles
// under prefers-reduced-motion.
//
// The scenes animate one at a time (ShowcaseStagger cycles which is active) so
// the montage reads in turn rather than all moving at once. Scenes render here
// on the server and are handed to that client cycler as children.
//
// Two callers (spec/16): SectionShowcase stacks one category's own features
// for its /features/<id> hero, and a landing StoryBeat stacks one feature from
// each category the beat covers.

export function Showcase({ items }: { items: FeatureProps[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-brand-50/50 p-5 shadow-sm sm:p-6">
      <ShowcaseStagger>
        {items.map((item) => (
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
