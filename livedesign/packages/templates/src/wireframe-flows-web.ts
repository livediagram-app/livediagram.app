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
      {
        name: 'Sign In',
        layout: 'wf-sign-in',
        copy: { 'Welcome Back': 'Back to Your Team' },
        links: { 'Sign In': 'Home' },
      },
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
    brand: 'Loomhouse',
    links: { Shop: 'Shop', Loomhouse: 'Shop' },
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
      {
        name: 'Contact',
        layout: 'wf-contact',
        copy: {
          'Let’s Talk': 'Write to Field Notes',
          'Questions, feedback or a demo: we usually reply within a day.':
            'Story ideas, corrections or a guest post: I read every note.',
          'hello@example.com': 'jordan@fieldnotes.example',
          '+44 20 7946 0000': '+44 113 496 0712',
          '12 High Street, London': 'Writing from Leeds',
          'How can we help?': 'What should I write about next?',
          'Send Message': 'Send Note',
        },
      },
    ],
  },
  // A company's site: home, the people, help and contact.
  'wireframe-company-site': {
    device: 'browser',
    brand: 'Tidewater',
    copy: { Pricing: 'Contact', Customers: 'Team', Docs: 'Help', 'Get Started': 'Try It Free' },
    links: { Tidewater: 'Home', Team: 'Team', Help: 'Help', Contact: 'Contact' },
    screens: [
      {
        name: 'Home',
        layout: 'wf-landing-page',
        copy: {
          'New: Team Spaces': 'New: Contractor Payments',
          'Work Together, Wherever You Are': 'Payroll Done Before Lunch',
          'One calm place for your team’s plans, notes and files.':
            'Pay your whole team in three clicks, the taxes worked out for you.',
          'Start Free': 'Start a Trial',
          'Fast to Start': 'Runs Itself',
          'Set up in minutes, no training needed.': 'Set the dates once and every payday follows.',
          'Built for Teams': 'Every Country',
          'Invite everyone and work together live.':
            'Pay people in 40 countries, in their own money.',
          'Private by Default': 'Checked Every Year',
          'Your data stays yours, always.': 'Encrypted, audited and backed up nightly.',
        },
        links: { 'Book a Demo': 'Contact', 'Start a Trial': 'Contact' },
      },
      {
        name: 'Team',
        layout: 'wf-team',
        copy: {
          'Twelve people building calm tools for busy teams.':
            'Twelve people making payday the easy day.',
        },
      },
      {
        name: 'Help',
        layout: 'wf-help-center',
        copy: {
          Docs: 'Team',
          Community: 'Contact',
          Status: 'Home',
          'Search for answers': 'Search payroll help',
          'How do I reset my password?': 'How do I add a new starter?',
          'Can I change my plan later?': 'Can I pay contractors abroad?',
          'Where do I find my invoices?': 'When does the money leave?',
          'How do I invite my team?': 'How are the taxes worked out?',
          'Is my data backed up?': 'Where are my payslips?',
        },
      },
      {
        name: 'Contact',
        layout: 'wf-contact',
        copy: {
          'Let’s Talk': 'Switch to Tidewater',
          'Questions, feedback or a demo: we usually reply within a day.':
            'Moving your payroll over? We set it up with you in a week.',
          'hello@example.com': 'sales@tidewater.example',
          '+44 20 7946 0000': '+44 117 496 0388',
          '12 High Street, London': '4 Quay Street, Bristol',
          'How can we help?': 'How many people do you pay?',
          'Send Message': 'Book a Call',
        },
      },
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
      {
        name: 'Tasks',
        layout: 'wf-task-list',
        // The sidebar is the tool's own: the board, the tasks, the calendar and the team, as on the Board.
        copy: {
          Today: ['My Tasks', 'Today'],
          Upcoming: 'Calendar',
          Flagged: 'Boards',
          Done: 'Team',
        },
        links: {
          Boards: 'Board',
          Calendar: 'Calendar',
          Team: 'Team',
          'Send the launch email draft': 'Board',
        },
      },
      {
        name: 'Calendar',
        layout: 'wf-calendar',
        copy: {
          'Design Review': 'Launch Board Review',
          'Lunch with Sam': 'Team Lunch',
          'Sprint Planning': 'Plan My Tasks',
        },
        links: { 'Launch Board Review': 'Board', 'Team Lunch': 'Team', 'Plan My Tasks': 'Tasks' },
      },
      {
        name: 'Team',
        layout: 'wf-team',
        copy: {
          Product: ['Board', 'Product'],
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
      {
        name: 'Conversation',
        layout: 'wf-chat',
        copy: {
          'Bring the photos?': 'Checklist is up.',
          'Sounds good, thanks!': 'Merged, thanks.',
          'Slides are shared.': 'Deck v3 attached.',
          'Ten minutes late!': 'Standup moved to 10.',
          'Thursday instead?': 'Can you review?',
          'Love it, ship it.': 'Invoice approved.',
          'Hey! Are we still on for Friday?': 'Is the launch checklist final?',
          'Yes, 7pm works for me.': 'Two left: pricing and the email.',
          'Great. I’ll book the table.': 'I’ll take the email.',
          'Perfect, see you there!': 'Pricing is mine, then.',
          'Bring the photos from the trip?': 'Sign off on Thursday?',
          'Will do.': 'Thursday at noon.',
        },
        links: BACK_ARROW,
      },
      {
        name: 'Notifications',
        layout: 'wf-notifications',
        copy: {
          Home: 'Inbox',
          Explore: 'Mentions',
          Messages: 'Settings',
          Follows: 'Assigned',
          'liked your photo.': 'assigned you Launch checklist.',
          'started following you.': 'replied in Offsite dates.',
          'mentioned you in Launch plan.': 'mentioned you in Pricing notes.',
          'commented: “Looks great!”': 'starred Invoice #2041.',
          'shared a file with you.': 'shared checklist.pdf.',
          'invited you to Offsite.': 'added you to Launch.',
          'replied to your comment.': 'closed Q4 budget.',
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
    copy: {
      Product: 'How It Works',
      Customers: 'Installers',
      Docs: 'FAQ',
      'Get Started': 'Get a Quote',
    },
    links: {
      Brightside: 'Home',
      Pricing: 'Pricing',
      'Get a Quote': 'Sign Up',
      'Log In': 'Sign Up',
    },
    screens: [
      {
        name: 'Home',
        layout: 'wf-landing-page',
        copy: {
          'New: Team Spaces': 'New: Home Batteries',
          'Work Together, Wherever You Are': 'Sunshine, Paid Monthly',
          'One calm place for your team’s plans, notes and files.':
            'Solar panels on your roof for one flat fee, fitted in a day.',
          'Start Free': 'Check My Roof',
          'Book a Demo': 'See the Savings',
          'Fast to Start': 'Fitted in a Day',
          'Set up in minutes, no training needed.':
            'A survey from space, a date, one day up there.',
          'Built for Teams': 'Nothing Upfront',
          'Invite everyone and work together live.': 'No deposit: pay monthly from the first bill.',
          'Private by Default': 'Cared For 25 Years',
          'Your data stays yours, always.': 'Repairs and a yearly clean, always included.',
        },
        links: { 'Check My Roof': 'Sign Up', 'See the Savings': 'Pricing' },
      },
      {
        name: 'Pricing',
        layout: 'wf-pricing',
        copy: {
          'Simple Pricing': 'One Flat Monthly Fee',
          'Start free, upgrade when your team grows.':
            'Panels, fitting and care in one bill, with no deposit.',
          Starter: 'Terrace',
          '$0/mo': '£39/mo',
          '1 project': '6 panels',
          'Basic support': 'A yearly clean',
          Choose: ['Pick Terrace', 'Pick Detached'],
          Team: 'Semi',
          '$12/mo': '£59/mo',
          'Unlimited projects': '10 panels',
          'Shared spaces': 'A home battery',
          'Priority support': 'Two cleans a year',
          'Start Trial': 'Pick Semi',
          Business: 'Detached',
          '$29/mo': '£89/mo',
          'Everything in Team': 'Everything in Semi',
          'Admin controls': '16 panels',
          SSO: 'A car charger',
        },
        links: { 'Pick Terrace': 'Sign Up', 'Pick Semi': 'Sign Up', 'Pick Detached': 'Sign Up' },
      },
      {
        name: 'Sign Up',
        layout: 'wf-sign-up',
        copy: {
          '“We shipped our first release a week after signing up.”':
            '“Our first bill after the fitting was £11. It used to be £94.”',
          'Priya Patel · Lumen': 'Priya Patel · Bristol',
          'Create Your Account': 'Get Your Roof Checked',
          'Free for 14 days, no card needed.': 'Free and from the sky: no visit needed.',
          Password: 'Postcode',
          'At least 8 characters': 'BS1 4QA',
          'Create Account': 'Check My Roof',
        },
        links: { 'icon:zap': 'Home', 'Check My Roof': 'Verify' },
      },
      {
        name: 'Verify',
        layout: 'wf-verify-code',
        copy: {
          'Check Your Email': 'Your Roof Report Is Ready',
          'We sent a 6-digit code to you@example.com': 'Enter the code we emailed you to open it.',
          Verify: 'See My Report',
        },
        links: { 'See My Report': 'Welcome' },
      },
      {
        name: 'Welcome',
        layout: 'wf-empty-state',
        copy: {
          Projects: 'My Roof',
          Team: 'Bills',
          Reports: 'Help',
          'Nothing Here Yet': 'Your Roof Fits 10 Panels',
          'Projects you create will show up here.':
            'About £640 a year back. Pick a plan to lock it in.',
          'Create a Project': 'Pick a Plan',
        },
        links: { 'Pick a Plan': 'Pricing' },
      },
    ],
  },
};
