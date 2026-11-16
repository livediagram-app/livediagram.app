// The wireframe flows on a phone, a tablet or a watch (docs/specs/007-editor/wireframe-pages.md "Templates"):
// each flow's screens in its own words and linked. Pure data, gathered in wireframe-flow-data.ts.
import {
  BACK,
  BACK_ARROW,
  results,
  type WireframeFlow,
  type WireframeFlowKind,
} from './wireframe-flow-kit';

export const APP_FLOWS: Partial<Record<WireframeFlowKind, WireframeFlow>> = {
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
      { name: 'Messages', layout: 'wf-chat', links: BACK_ARROW },
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
        links: { ...BACK_ARROW, 'Jordan Lee': 'Profile', 'Add a comment…': 'New Post' },
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
