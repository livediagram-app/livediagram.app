import { FORUM_ANY_APP_LABEL, forumAppLabel, type ForumApp } from '@liveworkspace/community';
import { listedApps, type ListedApp } from '@/lib/apps';
import { AppLogo } from '@/components/landing/AppLogo';
import { AnyAppIcon } from '../shared/icons';

// The app a forum post is about, as the site's header draws an app (liveworkspace/docs/specs/007-community/community.md
// "Categories and apps"): its logo and wordmark. Any App has no logo of its own: an icon and the words.

const LISTED: ReadonlyMap<string, ListedApp> = new Map(listedApps().map((app) => [app.id, app]));

export function ForumAppLogo({ app, size = 'xs' }: { app: ForumApp; size?: 'xs' | 'sm' }) {
  const listed = app ? LISTED.get(app) : undefined;
  if (listed) return <AppLogo app={listed} size={size} />;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
      {app ? null : <AnyAppIcon aria-hidden className="text-slate-500 dark:text-slate-400" />}
      {app ? forumAppLabel(app) : FORUM_ANY_APP_LABEL}
    </span>
  );
}
