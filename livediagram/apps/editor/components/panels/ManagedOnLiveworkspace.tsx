import { ButtonContent, buttonClassName } from '@livediagram/ui';

// Where a page that used to manage teams lands now (the invite, join and decline pages): teams are
// run on liveworkspace.app (liveworkspace/docs/accounts.md "Teams"), the same team in every app, so
// this says so and links there.
export function ManagedOnLiveworkspace({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-center justify-center px-6 py-16">
      <div className="flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
        <a href={href} className={buttonClassName({ size: 'md', className: 'mt-6 shadow-sm' })}>
          <ButtonContent>{cta}</ButtonContent>
        </a>
      </div>
    </div>
  );
}
