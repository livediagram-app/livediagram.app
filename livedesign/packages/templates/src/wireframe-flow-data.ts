// The wireframe flows' data (docs/specs/007-editor/wireframe-pages.md "Templates"): each flow's device and its
// screens, each a named wireframe layout in the flow's own words, linked so the flow plays in Prototype mode as it
// opens. Pure data with type-only imports, so the template previews can read it (the `./template-flow-data` export)
// without pulling the layout builders into a page's bundle.
import type { WireframeDeviceId } from '@livedesign/design';
import type { TemplateKind } from './templates';
import type { WireframeLayoutId } from './wireframe-layouts';

export type WireframeFlowKind = Extract<
  TemplateKind,
  | 'wireframe-mobile-app'
  | 'wireframe-website'
  | 'wireframe-dashboard'
  | 'wireframe-tablet-app'
  | 'wireframe-watch-app'
  | 'wireframe-social-app'
  | 'wireframe-delivery-app'
  | 'wireframe-travel-app'
  | 'wireframe-ride-app'
  | 'wireframe-music-app'
  | 'wireframe-app-onboarding'
  | 'wireframe-online-store'
  | 'wireframe-blog'
  | 'wireframe-company-site'
  | 'wireframe-project-tool'
  | 'wireframe-team-inbox'
  | 'wireframe-video-app'
  | 'wireframe-fitness-watch'
  | 'wireframe-watch-music'
  | 'wireframe-launch-site'
  | 'wireframe-account-settings'
  | 'wireframe-class-booking'
>;

// A screen's words in its flow ("A flow's own words"): a layout's label to the flow's own; a list gives each element
// so labelled its entry in turn, the rest keeping the last.
export type FlowCopy = Readonly<Record<string, string | readonly string[]>>;

// A screen's links ("A flow's links"): a control, by its words (after the copy and brand) or `icon:<iconId>`, to the
// screen it goes to by name, or BACK.
export type FlowLinks = Readonly<Record<string, string>>;

export type FlowScreen = {
  name: string;
  layout: WireframeLayoutId;
  copy?: FlowCopy;
  links?: FlowLinks;
};

export type WireframeFlow = {
  device: WireframeDeviceId;
  // The product's name, in place of the layouts' "Your App".
  brand?: string;
  // Words and links for every screen, under each screen's own.
  copy?: FlowCopy;
  links?: FlowLinks;
  screens: readonly FlowScreen[];
};

/** The target that makes a control a back link. */
export const BACK = 'back';

// The back arrow most phone layouts draw at the top left.
const BACK_ARROW = { 'icon:arrow-left': BACK } as const;

// A shop's search results (wf-search-results) in a flow's own words: the row titles, lines and prices in order.
const RESULT_TITLES = [
  'Linen Shirt',
  'Canvas Tote',
  'Wool Scarf',
  'Leather Belt',
  'Cotton Cap',
  'Field Jacket',
  'Knit Beanie',
] as const;
const RESULT_PRICES = [
  '$24.00',
  '$30.00',
  '$36.00',
  '$42.00',
  '$48.00',
  '$54.00',
  '$60.00',
] as const;
function results(
  titles: readonly string[],
  lines: readonly string[],
  prices: readonly string[],
): Record<string, string | readonly string[]> {
  const copy: Record<string, string | readonly string[]> = {
    'In stock · Ships tomorrow': lines,
  };
  RESULT_TITLES.forEach((t, i) => (copy[t] = titles[i]!));
  RESULT_PRICES.forEach((p, i) => (copy[p] = prices[i]!));
  return copy;
}

export const WIREFRAME_FLOWS: Record<WireframeFlowKind, WireframeFlow> = {
  // A shopping app from first open to paying: the happy path a mobile flow is reviewed on.
  'wireframe-mobile-app': {
    device: 'iphone',
    brand: 'Harbour',
    screens: [
      {
        name: 'Onboarding',
        layout: 'wf-onboarding',
        copy: {
          'Plan Your Week in Minutes': 'Shop Small Makers',
          'Everything you need in one place, ready whenever you are.':
            'Hand-picked goods from independent studios, at your door in two days.',
        },
        links: { Continue: 'Sign In', Skip: 'Home' },
      },
      {
        name: 'Sign In',
        layout: 'wf-sign-in',
        links: { 'Sign In': 'Home', 'Continue with Google': 'Home' },
      },
      {
        name: 'Home',
        layout: 'wf-home-feed',
        copy: {
          Discover: 'Shop',
          Travel: 'Shirts',
          Food: 'Bags',
          Design: 'Home',
          'Weekend in the Hills': 'Linen Shirt',
          'A Slower Morning': 'Canvas Tote',
          '12 min · Saved by 1.2k people': ['$49.00 · Free delivery', '$30.00 · Free delivery'],
          Inbox: 'Orders',
        },
        links: { 'Linen Shirt': 'Product', 'Canvas Tote': 'Product' },
      },
      {
        name: 'Product',
        layout: 'wf-product-detail',
        copy: { 'Product Name': 'Linen Shirt' },
        links: { ...BACK_ARROW, 'Add to Cart': 'Checkout' },
      },
      { name: 'Checkout', layout: 'wf-checkout', links: { ...BACK_ARROW, 'Pay $54.00': 'Home' } },
    ],
  },
  // A marketing site: the landing page, pricing and the way in.
  'wireframe-website': {
    device: 'browser',
    brand: 'Northstar',
    links: { Northstar: 'Home', Pricing: 'Pricing', 'Log In': 'Sign In', 'Get Started': 'Sign In' },
    screens: [
      { name: 'Home', layout: 'wf-landing-page', links: { 'Start Free': 'Sign In' } },
      {
        name: 'Pricing',
        layout: 'wf-pricing',
        links: { Choose: 'Sign In', 'Start Trial': 'Sign In' },
      },
      { name: 'Sign In', layout: 'wf-sign-in', links: { 'Sign In': 'Home' } },
    ],
  },
  // A web app's working screens on a laptop.
  'wireframe-dashboard': {
    device: 'laptop',
    brand: 'Ledger',
    screens: [
      {
        name: 'Overview',
        layout: 'wf-dashboard',
        copy: { Products: 'Orders' },
        links: { Orders: 'Orders', Settings: 'Settings', 'Recent Orders': 'Orders' },
      },
      {
        name: 'Orders',
        layout: 'wf-data-table',
        copy: { Reports: 'Home' },
        links: { Home: 'Overview', Settings: 'Settings' },
      },
      {
        name: 'Settings',
        layout: 'wf-settings',
        copy: { Projects: 'Orders' },
        links: { Home: 'Overview', Orders: 'Orders', Ledger: 'Overview' },
      },
    ],
  },
  // A tablet app's three main screens.
  'wireframe-tablet-app': {
    device: 'ipad',
    brand: 'Wander',
    screens: [
      {
        name: 'Discover',
        layout: 'wf-home-feed',
        copy: { Following: 'Messages' },
        links: { Messages: 'Messages', 'icon:user': 'Profile' },
      },
      { name: 'Messages', layout: 'wf-chat' },
      {
        name: 'Profile',
        layout: 'wf-profile',
        copy: { Explore: 'Discover' },
        links: { Home: 'Discover', Discover: 'Discover', Messages: 'Messages', Wander: 'Discover' },
      },
    ],
  },
  // A watch app's glance, list and alert.
  'wireframe-watch-app': {
    device: 'watch',
    screens: [
      { name: 'Glance', layout: 'wf-watch-glance', links: { '7,240 steps': 'Today' } },
      { name: 'Today', layout: 'wf-watch-list', links: { Messages: 'Alert' } },
      { name: 'Alert', layout: 'wf-watch-notification', links: { Dismiss: BACK } },
    ],
  },
  // A social app: the feed and stories, a post and making one, what is new and who you are.
  'wireframe-social-app': {
    device: 'iphone',
    brand: 'Campfire',
    links: { Home: 'Feed', Inbox: 'Notifications', Profile: 'Profile' },
    screens: [
      {
        name: 'Feed',
        layout: 'wf-home-feed',
        copy: { All: 'For You', Travel: 'Stories', Food: 'Following', Design: 'Saved' },
        links: {
          Stories: 'Stories',
          'Weekend in the Hills': 'Post',
          'A Slower Morning': 'Post',
          'icon:bell': 'Notifications',
        },
      },
      {
        name: 'Stories',
        layout: 'wf-stories',
        links: { You: 'New Post', 'Jordan Lee': 'Profile', 'icon:message': 'Post' },
      },
      {
        name: 'Post',
        layout: 'wf-post-detail',
        links: { 'Jordan Lee': 'Profile', 'Add a comment…': 'New Post' },
      },
      { name: 'New Post', layout: 'wf-compose-post', links: { Cancel: BACK, Post: 'Feed' } },
      {
        name: 'Notifications',
        layout: 'wf-notifications',
        links: { 'liked your photo.': 'Post' },
      },
      { name: 'Profile', layout: 'wf-profile', links: { 'icon:settings': 'Notifications' } },
    ],
  },
  // A delivery app from browsing the shop to watching the order arrive.
  'wireframe-delivery-app': {
    device: 'iphone',
    screens: [
      {
        name: 'Shop',
        layout: 'wf-shop-grid',
        copy: { '$24.00': '$48.00', '$30.00': '$32.00' },
        links: {
          'Search products': 'Search',
          'Linen Shirt': 'Item',
          'Canvas Tote': 'Item',
          'icon:shopping-bag': 'Cart',
          Bag: 'Cart',
          Search: 'Search',
        },
      },
      {
        name: 'Search',
        layout: 'wf-search-results',
        copy: { '$24.00': '$48.00', '$30.00': '$32.00' },
        links: { ...BACK_ARROW, 'Linen Shirt': 'Item' },
      },
      {
        name: 'Item',
        layout: 'wf-product-detail',
        copy: { 'Product Name': 'Linen Shirt', '$49.00': '$48.00' },
        links: { ...BACK_ARROW, 'Add to Cart': 'Cart' },
      },
      { name: 'Cart', layout: 'wf-cart', links: { ...BACK_ARROW, Checkout: 'Tracking' } },
      { name: 'Tracking', layout: 'wf-order-tracking', links: { 'icon:arrow-left': 'Shop' } },
    ],
  },
  // A travel app: find a flight, pick one, board it, then explore where you land.
  'wireframe-travel-app': {
    device: 'iphone',
    screens: [
      {
        name: 'Search',
        layout: 'wf-flight-search',
        links: { 'Search Flights': 'Results', Trips: 'Boarding Pass' },
      },
      {
        name: 'Results',
        layout: 'wf-search-results',
        copy: {
          Linen: 'London to Lisbon',
          '24 results': '18 flights · Fri 23 Oct',
          ...results(
            [
              '07:15 → 09:50',
              '09:40 → 12:15',
              '11:05 → 13:45',
              '13:30 → 17:55',
              '15:55 → 18:30',
              '18:20 → 20:55',
              '20:45 → 23:20',
            ],
            [
              'Direct · 2h 35m',
              'Direct · 2h 35m',
              'Direct · 2h 40m',
              '1 stop · 4h 25m',
              'Direct · 2h 35m',
              'Direct · 2h 35m',
              'Direct · 2h 35m',
            ],
            ['£64', '£89', '£72', '£58', '£95', '£81', '£66'],
          ),
        },
        links: { ...BACK_ARROW, '07:15 → 09:50': 'Boarding Pass' },
      },
      {
        name: 'Boarding Pass',
        layout: 'wf-boarding-pass',
        links: { ...BACK_ARROW, Lisbon: 'Explore' },
      },
      {
        name: 'Explore',
        layout: 'wf-places',
        copy: {
          'Search places': 'Search Lisbon',
          'Corner Coffee': 'Time Out Market',
          '★ 4.7 · Café · 0.3 mi · Open until 6 pm': '★ 4.6 · Food hall · 0.4 km · Open late',
        },
      },
    ],
  },
  // A ride app: sign in, say where to, watch the ride come, read its updates.
  'wireframe-ride-app': {
    device: 'iphone',
    brand: 'Hop',
    screens: [
      {
        name: 'Sign In',
        layout: 'wf-sign-in',
        links: { 'Sign In': 'Where To', 'Continue with Google': 'Where To' },
      },
      {
        name: 'Where To',
        layout: 'wf-places',
        copy: {
          'Search places': 'Where to?',
          'Corner Coffee': 'King’s Cross Station',
          '★ 4.7 · Café · 0.3 mi · Open until 6 pm': 'Euston Road, London · 12 min away',
          'Wi-Fi': 'Home',
          Outdoor: 'Work',
          Vegan: 'Gym',
          Directions: 'Choose a Ride',
          Call: 'Save',
        },
        links: { 'Choose a Ride': 'Your Ride' },
      },
      {
        name: 'Your Ride',
        layout: 'wf-ride',
        copy: { 'Where to?': 'King’s Cross Station' },
        links: { 'Confirm Standard': 'Updates' },
      },
      {
        name: 'Updates',
        layout: 'wf-notifications',
        copy: {
          Notifications: 'Updates',
          Mentions: 'Trips',
          Follows: 'Offers',
          'Sam Rivera': 'Sam is here',
          'liked your photo.': 'Silver Prius, LX21 HOP.',
          'Priya Patel': 'Sam is on the way',
          'mentioned you in Launch plan.': 'Two minutes from you.',
          'Alex Morgan': 'Ride booked',
          'started following you.': 'Standard, £12.40.',
          'Mia Novak': 'Rate your ride',
          'commented: “Looks great!”': 'How was your trip?',
          'Chris Wong': 'Receipt ready',
          'shared a file with you.': 'Tuesday’s ride, £38.20.',
          'Leo Grant': '20% off',
          'invited you to Offsite.': 'Rides after 8 pm.',
          'Ava Brooks': 'Welcome to Hop',
          'replied to your comment.': 'Your first ride is on us.',
          Inbox: 'Trips',
        },
      },
    ],
  },
  // A music app: browse and search, then listen.
  'wireframe-music-app': {
    device: 'iphone',
    screens: [
      {
        name: 'Browse',
        layout: 'wf-gallery',
        copy: {
          Photos: 'Listen Now',
          Favourites: 'Albums',
          Albums: ['Playlists', 'Albums'],
          Videos: 'Podcasts',
          'October 2026': 'New This Week',
          Library: 'Listen',
        },
        links: { 'icon:image': 'Now Playing', Podcasts: 'Podcast', Search: 'Search' },
      },
      {
        name: 'Search',
        layout: 'wf-search-results',
        copy: {
          Linen: 'Morning',
          ...results(
            [
              'Morning Light',
              'Morning Train',
              'Good Morning Blues',
              'Morning Glory',
              'Mornings in May',
              'Morning Song',
              'Early Morning',
            ],
            [
              'The Quiet Hours',
              'Paper Lanterns',
              'Ruth Abara',
              'Slow Tide',
              'The Quiet Hours',
              'Mara Cole',
              'Harbour Lights',
            ],
            ['3:41', '4:02', '3:18', '2:57', '4:25', '3:33', '5:10'],
          ),
        },
        links: { ...BACK_ARROW, 'Morning Light': 'Now Playing' },
      },
      { name: 'Now Playing', layout: 'wf-music-player', links: BACK_ARROW },
      { name: 'Podcast', layout: 'wf-podcast', links: { ...BACK_ARROW, Play: 'Now Playing' } },
    ],
  },
  // An app's first run, from the welcome to the empty first screen.
  'wireframe-app-onboarding': {
    device: 'iphone',
    brand: 'Planwell',
    screens: [
      { name: 'Welcome', layout: 'wf-onboarding', links: { Continue: 'Sign Up', Skip: 'Sign Up' } },
      {
        name: 'Sign Up',
        layout: 'wf-sign-up',
        links: { ...BACK_ARROW, 'Create Account': 'Verify' },
      },
      { name: 'Verify', layout: 'wf-verify-code', links: { ...BACK_ARROW, Verify: 'Permissions' } },
      { name: 'Permissions', layout: 'wf-permissions', links: { Continue: 'Get Started' } },
      { name: 'Get Started', layout: 'wf-empty-state' },
    ],
  },
  // An online store in the browser, from the shop to paying.
  'wireframe-online-store': {
    device: 'browser',
    brand: 'Harbour',
    links: { Shop: 'Shop', Harbour: 'Shop' },
    screens: [
      {
        name: 'Shop',
        layout: 'wf-shop-grid',
        copy: { '$24.00': '$48.00', '$30.00': '$32.00' },
        links: { 'Linen Shirt': 'Product', 'Canvas Tote': 'Product' },
      },
      {
        name: 'Product',
        layout: 'wf-product-detail',
        copy: {
          'Product Name': 'Linen Shirt',
          '$49.00': '$48.00',
          'Home  /  Shop  /  Product': 'Home  /  Shirts  /  Linen Shirt',
        },
        links: { 'Add to Cart': 'Cart' },
      },
      { name: 'Cart', layout: 'wf-cart', links: { Checkout: 'Checkout' } },
      {
        name: 'Checkout',
        layout: 'wf-checkout',
        copy: {
          '$49.00': '$116.00',
          '$5.00': 'Free',
          '$54.00': '$116.00',
          'Pay $54.00': 'Pay $116.00',
        },
        links: { 'Pay $116.00': 'Shop' },
      },
    ],
  },
  // A blog: the posts, one to read, and a way to get in touch.
  'wireframe-blog': {
    device: 'browser',
    brand: 'Field Notes',
    copy: {
      Product: 'Latest',
      Pricing: 'Topics',
      Customers: 'About',
      Docs: 'RSS',
      'Log In': 'Sign In',
      'Get Started': 'Subscribe',
    },
    links: { 'Field Notes': 'Blog', Latest: 'Blog', About: 'Contact' },
    screens: [
      {
        name: 'Blog',
        layout: 'wf-blog',
        links: { 'How Small Teams Ship Faster': 'Article', 'The Five Minute Standup': 'Article' },
      },
      { name: 'Article', layout: 'wf-article', copy: { Stories: 'Latest' } },
      { name: 'Contact', layout: 'wf-contact' },
    ],
  },
  // A company's site: home, the people, help and contact.
  'wireframe-company-site': {
    device: 'browser',
    brand: 'Northstar',
    copy: { Pricing: 'Contact', Customers: 'Team', Docs: 'Help' },
    links: { Northstar: 'Home', Team: 'Team', Help: 'Help', Contact: 'Contact' },
    screens: [
      { name: 'Home', layout: 'wf-landing-page', links: { 'Book a Demo': 'Contact' } },
      { name: 'Team', layout: 'wf-team' },
      {
        name: 'Help',
        layout: 'wf-help-center',
        copy: { Docs: 'Team', Community: 'Contact', Status: 'Home' },
      },
      { name: 'Contact', layout: 'wf-contact' },
    ],
  },
  // A project tool's working screens on a laptop.
  'wireframe-project-tool': {
    device: 'laptop',
    brand: 'Launchpad',
    screens: [
      {
        name: 'Board',
        layout: 'wf-kanban',
        links: {
          'My Tasks': 'Tasks',
          Calendar: 'Calendar',
          Team: 'Team',
          'Write launch email': 'Tasks',
        },
      },
      { name: 'Tasks', layout: 'wf-task-list', links: { Upcoming: 'Calendar' } },
      { name: 'Calendar', layout: 'wf-calendar' },
      {
        name: 'Team',
        layout: 'wf-team',
        copy: {
          Product: 'Board',
          Pricing: 'Tasks',
          Customers: 'Calendar',
          Docs: 'Team',
          'Log In': 'Invite',
          'Get Started': 'Add Person',
          'Twelve people building calm tools for busy teams.': 'Twelve people on the Launch Board.',
        },
        links: { Board: 'Board', Tasks: 'Tasks', Calendar: 'Calendar', Launchpad: 'Board' },
      },
    ],
  },
  // A team inbox's working screens on a laptop.
  'wireframe-team-inbox': {
    device: 'laptop',
    brand: 'Relay',
    screens: [
      {
        name: 'Inbox',
        layout: 'wf-inbox',
        copy: { Sent: 'Mentions', Drafts: 'Settings' },
        links: {
          'Launch checklist': 'Conversation',
          Reply: 'Conversation',
          Mentions: 'Notifications',
          Settings: 'Settings',
        },
      },
      { name: 'Conversation', layout: 'wf-chat' },
      {
        name: 'Notifications',
        layout: 'wf-notifications',
        copy: {
          Home: 'Inbox',
          Explore: 'Mentions',
          Messages: 'Settings',
          'liked your photo.': 'assigned you Launch checklist.',
          'started following you.': 'replied in Offsite dates.',
        },
        links: { Inbox: 'Inbox', Settings: 'Settings', 'Mark all as read': 'Inbox' },
      },
      {
        name: 'Settings',
        layout: 'wf-settings',
        copy: { Home: 'Inbox', Projects: 'Mentions' },
        links: { Inbox: 'Inbox', Mentions: 'Notifications', Relay: 'Inbox' },
      },
    ],
  },
  // A video app on a tablet: find something, then watch it.
  'wireframe-video-app': {
    device: 'ipad',
    brand: 'Reel',
    links: { Home: 'Browse', Search: 'Search', 'icon:user': 'Profile', Reel: 'Browse' },
    screens: [
      {
        name: 'Browse',
        layout: 'wf-gallery',
        copy: {
          Library: 'Home',
          Albums: ['Search', 'Series'],
          Shared: 'Saved',
          'October 2026': 'Trending Now',
          Favourites: 'Films',
          Videos: 'Talks',
        },
        links: { 'icon:image': 'Watch' },
      },
      {
        name: 'Search',
        layout: 'wf-search-results',
        copy: {
          Shop: 'Home',
          'New In': 'Search',
          Sale: 'Saved',
          Linen: 'Design',
          Shirts: 'Films',
          Bags: 'Series',
          Accessories: 'Talks',
          Outerwear: 'Tutorials',
          'On Sale': 'Free',
          '24 results for “Linen”': '24 results for “Design”',
          ...results(
            [
              'Wireframes in Ten Minutes',
              'Colour for Interfaces',
              'Type That Reads Well',
              'Designing Empty States',
              'The Grid, Explained',
              'Motion With Purpose',
              'Kind Design Critique',
            ],
            [
              'Design Weekly · 48k views',
              'Studio Notes · 31k views',
              'Design Weekly · 22k views',
              'Small Studio · 18k views',
              'Studio Notes · 64k views',
              'Design Weekly · 12k views',
              'Small Studio · 9k views',
            ],
            ['10:24', '18:02', '12:45', '9:30', '15:11', '11:48', '21:05'],
          ),
        },
        links: { 'Wireframes in Ten Minutes': 'Watch' },
      },
      {
        name: 'Watch',
        layout: 'wf-video-player',
        copy: { Subscriptions: 'Search' },
        links: { 'Design Weekly': 'Profile' },
      },
      { name: 'Profile', layout: 'wf-profile', copy: { Explore: 'Search', Messages: 'Saved' } },
    ],
  },
  // A fitness app on the wrist.
  'wireframe-fitness-watch': {
    device: 'watch',
    screens: [
      {
        name: 'Workout',
        layout: 'wf-watch-workout',
        links: { '142': 'Heart Rate', '24:18': 'Timer', 'Outdoor Run': 'Weather' },
      },
      { name: 'Heart Rate', layout: 'wf-watch-heart-rate', links: { '72': BACK } },
      { name: 'Timer', layout: 'wf-watch-timer', links: { Cancel: BACK } },
      { name: 'Weather', layout: 'wf-watch-weather', links: { London: BACK } },
    ],
  },
  // A music remote on the wrist.
  'wireframe-watch-music': {
    device: 'watch',
    screens: [
      {
        name: 'Now Playing',
        layout: 'wf-watch-now-playing',
        links: { 'Morning Light': 'Up Next' },
      },
      {
        name: 'Up Next',
        layout: 'wf-watch-up-next',
        copy: {
          'Design Review': 'Paper Lanterns',
          '10:00 – 11:00': 'The Quiet Hours',
          'Lunch with Sam': 'Slow Tide',
          '12:30': 'Mara Cole',
        },
        links: { 'Up Next': BACK },
      },
    ],
  },
  // A product's launch in the browser: the landing page and pricing, then signing up through to the first screen.
  'wireframe-launch-site': {
    device: 'browser',
    brand: 'Brightside',
    links: {
      Brightside: 'Home',
      Pricing: 'Pricing',
      'Get Started': 'Sign Up',
      'Log In': 'Sign Up',
    },
    screens: [
      { name: 'Home', layout: 'wf-landing-page', links: { 'Start Free': 'Sign Up' } },
      {
        name: 'Pricing',
        layout: 'wf-pricing',
        links: { Choose: 'Sign Up', 'Start Trial': 'Sign Up' },
      },
      {
        name: 'Sign Up',
        layout: 'wf-sign-up',
        links: { 'icon:zap': 'Home', 'Create Account': 'Verify' },
      },
      { name: 'Verify', layout: 'wf-verify-code', links: { Verify: 'Welcome' } },
      { name: 'Welcome', layout: 'wf-empty-state' },
    ],
  },
  // An account's own screens: who you are, changing it, the settings and getting help.
  'wireframe-account-settings': {
    device: 'iphone',
    screens: [
      {
        name: 'Profile',
        layout: 'wf-profile',
        links: { 'Edit Profile': 'Edit Profile', 'icon:settings': 'Settings' },
      },
      { name: 'Edit Profile', layout: 'wf-edit-profile', links: { Cancel: BACK, Save: 'Profile' } },
      {
        name: 'Settings',
        layout: 'wf-settings',
        copy: { Units: 'Help', Metric: 'FAQs' },
        links: { Profile: 'Edit Profile', Help: 'Help', Home: 'Profile' },
      },
      { name: 'Help', layout: 'wf-help-center', links: BACK_ARROW },
    ],
  },
  // Booking a fitness class on a phone: find a studio, pick a class, pay, and the booking to show at the door.
  'wireframe-class-booking': {
    device: 'iphone',
    screens: [
      {
        name: 'Studios',
        layout: 'wf-places',
        copy: {
          'Search places': 'Search studios',
          'Corner Coffee': 'Northside Yoga',
          '★ 4.7 · Café · 0.3 mi · Open until 6 pm': '★ 4.9 · Yoga · 0.4 mi · Next class 07:00',
          'Wi-Fi': 'Showers',
          Outdoor: 'Mats',
          Vegan: 'Lockers',
          Directions: 'See Classes',
          Call: 'Call',
        },
        links: { 'See Classes': 'Class', 'Northside Yoga': 'Class' },
      },
      {
        name: 'Class',
        layout: 'wf-product-detail',
        copy: {
          'Product Name': 'Sunrise Flow',
          '$49.00': '£12.00',
          '★★★★★  4.8 (128 reviews)': '★★★★★  4.9 (212 reviews)',
          Size: 'Time',
          S: '07:00',
          M: '08:30',
          L: '12:15',
          XL: '18:00',
          'Add to Cart': 'Book a Spot',
        },
        links: { ...BACK_ARROW, 'Book a Spot': 'Book' },
      },
      {
        name: 'Book',
        layout: 'wf-checkout',
        copy: {
          Checkout: 'Book',
          Delivery: ['Your Details', 'Mat hire'],
          Address: 'Phone',
          '12 High Street': '07700 900123',
          'Order Summary': 'Summary',
          Subtotal: 'Sunrise Flow',
          '$49.00': '£12.00',
          '$5.00': '£2.00',
          '$54.00': '£14.00',
          'Pay $54.00': 'Pay £14.00',
        },
        links: { ...BACK_ARROW, 'Pay £14.00': 'Booked' },
      },
      {
        name: 'Booked',
        layout: 'wf-boarding-pass',
        copy: {
          'Your Trip': 'Booked',
          'Boarding Pass': 'Your Booking',
          'Flight YA 214': 'Sunrise Flow · Studio 2',
          LHR: '07:00',
          London: 'Starts',
          LIS: '08:00',
          Lisbon: 'Ends',
          PASSENGER: 'NAME',
          SEAT: 'MAT',
          '14A': '12',
          GATE: 'ROOM',
          B32: 'Studio 2',
          BOARDS: 'DOORS',
          '06:40': '06:50',
          'Add to Wallet': 'Add to Wallet',
        },
        links: { 'icon:arrow-left': 'Studios' },
      },
    ],
  },
};

/** True for a template that is a wireframe flow. */
export function isWireframeFlowKind(kind: TemplateKind): kind is WireframeFlowKind {
  return Object.hasOwn(WIREFRAME_FLOWS, kind);
}
