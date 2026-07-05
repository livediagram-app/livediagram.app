import { buttonClassName } from '@livediagram/ui';
import { HeroIllustration } from './HeroIllustration';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          A picture tells a thousand words, <span className="text-brand-600">tell your story</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
          Turn any idea into a clear diagram in minutes. Build it with your team in real time, then
          share it with a single link.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/new"
            className={buttonClassName({ size: 'lg', className: 'w-full shadow-sm sm:w-auto' })}
          >
            Start drawing
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          No sign-up required. The canvas opens straight away.
        </p>

        <HeroIllustration />
      </div>
    </section>
  );
}
