# Identity

Follow the references below only as needed; never upfront.

- ./auth-and-guest-access.md - when working on Auth + guest access: sign-in through the liveworkspace accounts Worker — but the canvas always works without sign-in; guest documents start This Browser, and signing in offers to move them
- ./sign-in-encouragement.md - when working on Sign-in encouragement: Dismissible guest banner (Explorer + delayed in-editor) + "why sign in" modal
- ./transactional-email.md - when working on Transactional & lifecycle email (Resend): Optional Resend integration, gated on `RESEND_API_KEY`: notification, milestone and account-deleted emails, to addresses liveworkspace answers (the welcome, onboarding and team emails are liveworkspace's). Off (no sends) when the key is unset
- ./profile-and-email-notifications.md - when working on Account settings & email notifications: Signed-in account home in the Explorer (avatar, name, email, join date); delete-account moves here; two opt-out email notifications (someone joins my document, someone responds to my team invite), gated like [Transactional & lifecycle email (Resend)](transactional-email.md)
