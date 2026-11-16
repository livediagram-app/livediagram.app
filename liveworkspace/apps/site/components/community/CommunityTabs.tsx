import Link from 'next/link';
import { COMMUNITY_HOME_PATH } from '@liveworkspace/community/paths';
import { FORUM_HOME_PATH } from '@liveworkspace/community';
import { ForumIcon, GalleryIcon } from './shared/icons';

// The Community page's two tabs (liveworkspace/docs/specs/007-community/community.md "The Forum", "Its pages"):
// Gallery and Forum, under the hero. Links, not a tab widget: each is its own address, kept on the page's own
// address (the app's, or liveworkspace.app's), so a tab can be bookmarked, shared and opened in a new tab.
const TABS = [
  { id: 'gallery', label: 'Gallery', href: COMMUNITY_HOME_PATH, Icon: GalleryIcon },
  { id: 'forum', label: 'Forum', href: FORUM_HOME_PATH, Icon: ForumIcon },
] as const;

export type CommunityTab = (typeof TABS)[number]['id'];

export function CommunityTabs({ current }: { current: CommunityTab }) {
  return (
    <nav aria-label="Community" className="border-b border-slate-200 dark:border-slate-800">
      <ul className="-mb-px flex gap-1">
        {TABS.map(({ id, label, href, Icon }) => {
          const active = id === current;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors duration-micro focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-brand-600 ${
                  active
                    ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'
                }`}
              >
                <Icon aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
