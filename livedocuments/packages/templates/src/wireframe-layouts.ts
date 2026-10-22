// Wireframe layouts (docs/specs/007-editor/wireframe-pages.md "Wireframe layouts"): the screens a
// wireframe page starts from, by category. Each phone, tablet and computer layout is responsive
// (built for the form its safe area takes); a watch has its own. A page is offered its device
// class's: the watch's on a watch, the rest elsewhere.
import type { Element, WireframeDeviceClass } from '@livedocuments/document';
import type { LayoutBox } from './page-layout-kit';
import type { PageLayoutId } from './page-layouts';
import {
  emptyState,
  homeFeed,
  landingPage,
  onboarding,
  productDetail,
  searchResults,
  signIn,
} from './wireframe-layouts-start';
import { checkout, pricing, profile, settings } from './wireframe-layouts-account';
import { chat, dashboard, dataTable } from './wireframe-layouts-work';
import {
  watchGlance,
  watchList,
  watchNotification,
  watchNowPlaying,
  watchWeather,
  watchWorkout,
  watchHeartRate,
  watchTimer,
  watchUpNext,
} from './wireframe-layouts-watch';
import {
  cart,
  composePost,
  orderTracking,
  permissions,
  postDetail,
  shopGrid,
  signUp,
  stories,
  verifyCode,
} from './wireframe-layouts-shop';
import {
  editProfile,
  helpCenter,
  kanban,
  podcast,
  taskList,
  videoPlayer,
} from './wireframe-layouts-pro';
import { blog, boardingPass, contact, flightSearch, ride, team } from './wireframe-layouts-site';
import {
  article,
  calendar,
  gallery,
  inbox,
  musicPlayer,
  notifications,
  places,
} from './wireframe-layouts-more';

export type WireframeLayoutId =
  | 'wf-onboarding'
  | 'wf-sign-in'
  | 'wf-empty-state'
  | 'wf-home-feed'
  | 'wf-landing-page'
  | 'wf-product-detail'
  | 'wf-search-results'
  | 'wf-profile'
  | 'wf-settings'
  | 'wf-checkout'
  | 'wf-pricing'
  | 'wf-dashboard'
  | 'wf-chat'
  | 'wf-data-table'
  | 'wf-calendar'
  | 'wf-inbox'
  | 'wf-notifications'
  | 'wf-article'
  | 'wf-places'
  | 'wf-music-player'
  | 'wf-gallery'
  | 'wf-watch-workout'
  | 'wf-watch-now-playing'
  | 'wf-watch-weather'
  | 'wf-sign-up'
  | 'wf-verify-code'
  | 'wf-permissions'
  | 'wf-cart'
  | 'wf-shop-grid'
  | 'wf-order-tracking'
  | 'wf-post-detail'
  | 'wf-stories'
  | 'wf-compose-post'
  | 'wf-kanban'
  | 'wf-task-list'
  | 'wf-video-player'
  | 'wf-podcast'
  | 'wf-edit-profile'
  | 'wf-help-center'
  | 'wf-team'
  | 'wf-contact'
  | 'wf-blog'
  | 'wf-flight-search'
  | 'wf-boarding-pass'
  | 'wf-ride'
  | 'wf-watch-timer'
  | 'wf-watch-heart-rate'
  | 'wf-watch-up-next'
  | 'wf-watch-glance'
  | 'wf-watch-list'
  | 'wf-watch-notification';

type WireframeLayoutCategoryId =
  | 'wf-start'
  | 'wf-browse'
  | 'wf-shop'
  | 'wf-social'
  | 'wf-work'
  | 'wf-media'
  | 'wf-account'
  | 'wf-marketing'
  | 'wf-travel'
  | 'wf-watch';

export const WIREFRAME_LAYOUT_CATEGORIES: readonly {
  id: WireframeLayoutCategoryId;
  label: string;
}[] = [
  { id: 'wf-start', label: 'Start' },
  { id: 'wf-browse', label: 'Browse' },
  { id: 'wf-shop', label: 'Shop' },
  { id: 'wf-social', label: 'Social' },
  { id: 'wf-work', label: 'Work' },
  { id: 'wf-media', label: 'Media' },
  { id: 'wf-account', label: 'Account' },
  { id: 'wf-marketing', label: 'Marketing' },
  { id: 'wf-travel', label: 'Travel' },
  { id: 'wf-watch', label: 'Watch' },
];

type WireframeLayout = {
  id: PageLayoutId;
  label: string;
  category: WireframeLayoutCategoryId;
  description: string;
  build: (box: LayoutBox) => Element[];
};

const own = (
  id: WireframeLayoutId,
  label: string,
  category: WireframeLayoutCategoryId,
  description: string,
  build: (box: LayoutBox) => Element[],
): WireframeLayout => ({ id, label, category, description, build });

export const WIREFRAME_LAYOUTS: readonly WireframeLayout[] = [
  own(
    'wf-onboarding',
    'Onboarding',
    'wf-start',
    'A picture, a headline, progress dots and Continue.',
    onboarding,
  ),
  own(
    'wf-sign-in',
    'Sign In',
    'wf-start',
    'Email and password fields, Sign In and a Google button.',
    signIn,
  ),
  own(
    'wf-empty-state',
    'Empty State',
    'wf-start',
    'An icon, a headline, a line and one button.',
    emptyState,
  ),
  own(
    'wf-home-feed',
    'Home Feed',
    'wf-browse',
    'A search, filter chips and cards of picture and text.',
    homeFeed,
  ),
  own(
    'wf-landing-page',
    'Landing Page',
    'wf-marketing',
    'A nav, a hero with two buttons and a picture, three features.',
    landingPage,
  ),
  own(
    'wf-product-detail',
    'Product Detail',
    'wf-shop',
    'A picture, a name, a price, sizes and Add to Cart.',
    productDetail,
  ),
  own(
    'wf-search-results',
    'Search Results',
    'wf-browse',
    'A search, a count and rows of results.',
    searchResults,
  ),
  own(
    'wf-profile',
    'Profile',
    'wf-social',
    'An avatar, a name, three stats and a grid of pictures.',
    profile,
  ),
  own('wf-settings', 'Settings', 'wf-account', 'Grouped rows of switches and choices.', settings),
  own(
    'wf-checkout',
    'Checkout',
    'wf-shop',
    'Delivery and payment fields, a summary and Pay.',
    checkout,
  ),
  own(
    'wf-pricing',
    'Pricing',
    'wf-marketing',
    'Three plans, the middle one marked Popular.',
    pricing,
  ),
  own('wf-dashboard', 'Dashboard', 'wf-work', 'Four figures, a chart and a list.', dashboard),
  own('wf-chat', 'Chat', 'wf-social', 'A conversation of bubbles and a message field.', chat),
  own(
    'wf-data-table',
    'Data Table',
    'wf-work',
    'A search, filters and a table of orders.',
    dataTable,
  ),
  own(
    'wf-article',
    'Article',
    'wf-browse',
    'A title, its author, a picture and the story.',
    article,
  ),
  own('wf-places', 'Places', 'wf-browse', 'A map with pins and the chosen place’s card.', places),
  own(
    'wf-notifications',
    'Notifications',
    'wf-social',
    'Today’s and earlier activity, unread marked.',
    notifications,
  ),
  own('wf-calendar', 'Calendar', 'wf-work', 'A month with the day’s events.', calendar),
  own(
    'wf-inbox',
    'Inbox',
    'wf-work',
    'A mail list and, on a wide screen, the message open.',
    inbox,
  ),
  own(
    'wf-music-player',
    'Music Player',
    'wf-media',
    'Album art, a scrubber and the controls.',
    musicPlayer,
  ),
  own('wf-gallery', 'Photo Gallery', 'wf-media', 'A grid of pictures under filters.', gallery),
  own(
    'wf-sign-up',
    'Sign Up',
    'wf-start',
    'Name, email and password, with a quote beside on a computer.',
    signUp,
  ),
  own(
    'wf-verify-code',
    'Verify Code',
    'wf-start',
    'A six-digit code to confirm an email.',
    verifyCode,
  ),
  own(
    'wf-permissions',
    'Permissions',
    'wf-start',
    'What the app may use, a switch each.',
    permissions,
  ),
  own(
    'wf-shop-grid',
    'Shop Grid',
    'wf-shop',
    'Products in a grid, filters beside on a computer.',
    shopGrid,
  ),
  own('wf-cart', 'Cart', 'wf-shop', 'Items with steppers, a promo code and the total.', cart),
  own(
    'wf-order-tracking',
    'Order Tracking',
    'wf-shop',
    'An order’s steps from placed to delivered.',
    orderTracking,
  ),
  own(
    'wf-post-detail',
    'Post',
    'wf-social',
    'A photo post, its reactions and comments.',
    postDetail,
  ),
  own('wf-stories', 'Stories Feed', 'wf-social', 'A row of stories over the feed.', stories),
  own(
    'wf-compose-post',
    'New Post',
    'wf-social',
    'Writing a post with photos and tools.',
    composePost,
  ),
  own('wf-kanban', 'Kanban Board', 'wf-work', 'Columns of task cards.', kanban),
  own('wf-task-list', 'Task List', 'wf-work', 'Today’s tasks to tick off.', taskList),
  own(
    'wf-video-player',
    'Video Player',
    'wf-media',
    'A video, its channel and what plays next.',
    videoPlayer,
  ),
  own('wf-podcast', 'Podcast', 'wf-media', 'A show’s art and its episodes.', podcast),
  own(
    'wf-edit-profile',
    'Edit Profile',
    'wf-account',
    'A photo and the profile’s fields.',
    editProfile,
  ),
  own(
    'wf-help-center',
    'Help Center',
    'wf-account',
    'A search, topics and common questions.',
    helpCenter,
  ),
  own('wf-team', 'Team', 'wf-marketing', 'The people behind the product.', team),
  own(
    'wf-contact',
    'Contact',
    'wf-marketing',
    'A message form, the details beside on a computer.',
    contact,
  ),
  own('wf-blog', 'Blog', 'wf-marketing', 'A featured post over the latest.', blog),
  own(
    'wf-flight-search',
    'Flight Search',
    'wf-travel',
    'Where, when and the flights that fit.',
    flightSearch,
  ),
  own(
    'wf-boarding-pass',
    'Boarding Pass',
    'wf-travel',
    'A pass with the gate, seat and barcode.',
    boardingPass,
  ),
  own('wf-ride', 'Ride', 'wf-travel', 'A route on a map and the rides to choose.', ride),
  own('wf-watch-glance', 'Glance', 'wf-watch', 'A ring and a figure at a glance.', watchGlance),
  own('wf-watch-list', 'List', 'wf-watch', 'Rows of an icon and a label.', watchList),
  own('wf-watch-workout', 'Workout', 'wf-watch', 'A timer and three live figures.', watchWorkout),
  own(
    'wf-watch-now-playing',
    'Now Playing',
    'wf-watch',
    'A song, its progress and the controls.',
    watchNowPlaying,
  ),
  own(
    'wf-watch-weather',
    'Weather',
    'wf-watch',
    'The temperature and the hours ahead.',
    watchWeather,
  ),
  own('wf-watch-timer', 'Timer', 'wf-watch', 'A countdown ring and its controls.', watchTimer),
  own(
    'wf-watch-heart-rate',
    'Heart Rate',
    'wf-watch',
    'The rate now and the last hour.',
    watchHeartRate,
  ),
  own('wf-watch-up-next', 'Up Next', 'wf-watch', 'The day’s next events.', watchUpNext),
  own(
    'wf-watch-notification',
    'Notification',
    'wf-watch',
    'An app, a title, a line and two buttons.',
    watchNotification,
  ),
];

/** The wireframe layouts a device class is offered: a watch its own, any other device the rest
 *  (absent: every one, as an agent's catalogue lists them). */
export function wireframeLayoutsFor(deviceClass?: WireframeDeviceClass | null) {
  if (!deviceClass) return { categories: WIREFRAME_LAYOUT_CATEGORIES, layouts: WIREFRAME_LAYOUTS };
  const watch = deviceClass === 'watch';
  return {
    categories: WIREFRAME_LAYOUT_CATEGORIES.filter((c) => (c.id === 'wf-watch') === watch),
    layouts: WIREFRAME_LAYOUTS.filter((l) => (l.category === 'wf-watch') === watch),
  };
}
