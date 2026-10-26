# Identity

Follow the references below only as needed; never upfront.

- ./auth-and-guest-access.md - when working on Auth + guest access: sign-in through the liveworkspace accounts Worker, but the canvas always works without sign-in; guest documents start This Browser, and signing in offers to move them
- ./sign-in-encouragement.md - when working on Sign-in encouragement: Dismissible guest banner (Explorer + delayed in-editor) + "why sign in" modal
- ./transactional-email.md - when working on Transactional & lifecycle email: Optional Cloudflare Email Service sends, gated on the `send_email` binding `EMAIL`: notification, milestone and account-deleted emails, to addresses liveworkspace answers (the welcome, onboarding and team emails are liveworkspace's). Off (no sends) without the binding
- ./profile-and-email-notifications.md - when working on Account settings & email notifications: the Settings Account rows (identity card, Delete account) and the seven opt-out email switches, gated like [Transactional & lifecycle email](transactional-email.md)
