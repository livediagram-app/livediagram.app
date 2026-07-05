import { Brand, buttonClassName, ProductNav } from '@livediagram/ui';
import { SearchInput } from '@/components/SearchInput';

// Help-centre header. Brand links back to the marketing home; the editor
// is always one click away (the canvas works without signing in, spec/04).
// Same origin as the rest of livediagram — the router stitches the apps by
// path — so these are plain absolute links. The search box sits here too so
// it's reachable from every article, not just the home hero.
export function Header() {
  return (
    <header className="sticky top-0 z-50 h-16 border-y border-slate-200/70 bg-slate-50/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 md:px-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <Brand href="/" size="md" />
          <ProductNav current="help" showOnMobile />
        </div>
        <div className="hidden min-w-0 flex-1 justify-center sm:flex">
          <div className="w-full max-w-sm">
            <SearchInput />
          </div>
        </div>
        {/* Cross-surface navigation lives in the apps menu next to the logo, so
            the header keeps just the one primary CTA into the editor. ml-auto
            pins it to the far right even on mobile, where the centred search
            box (the flex-1 spacer) is hidden. */}
        <nav className="ml-auto flex shrink-0 items-center gap-1.5">
          <a href="/new" className={buttonClassName({ size: 'md', className: 'shadow-sm' })}>
            Start drawing
          </a>
        </nav>
      </div>
    </header>
  );
}
