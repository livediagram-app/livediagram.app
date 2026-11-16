// The wireframe flows in a browser or on a laptop (docs/specs/007-editor/wireframe-pages.md "Templates"):
// each flow's screens in its own words and linked. Pure data, gathered in wireframe-flow-data.ts.
import { BACK_ARROW, type WireframeFlow, type WireframeFlowKind } from './wireframe-flow-kit';

export const WEB_FLOWS: Partial<Record<WireframeFlowKind, WireframeFlow>> = {
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
      { name: 'Conversation', layout: 'wf-chat', links: BACK_ARROW },
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
};
