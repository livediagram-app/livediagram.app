# Accounts

Follow the references below only as needed; never upfront.

- ./sign-in.md - when working on how signing in works: the OAuth flow, the sign-in and registration pages, closing an account, registering an app, security notes
- ./accounts.md - when working on what an account holds: guests, sessions on app addresses, teams, API tokens, settings, profiles, onboarding and notification emails, the account API
- ./ai-keys.md - when working on AI keys: a person's and a team's own provider key, which key wins, the Settings
  category, the binding-only door apps read a key through, sealing and rotation
- ./data-export.md - when working on Download All My Data: the export service, the zip, the doors it calls, the
  signed link, its email and the Settings category
- ./push.md - when working on phone notifications: devices, the per-kind switches, Web Push and VAPID, what an app hands accounts to send, the installable sites and their push-only service worker
- ./email.md - when working on how the platform sends email: Cloudflare Email Service, the senders, the templates
- ./inbound-email.md - when working on mail the platform takes in: Email Routing to an app's Worker, the shared reader, SPF/DKIM/DMARC from Authentication-Results, quoted reply stripping
- ./blueprints/README.md - when implementing an accounts spec: the blueprints hold the engineering detail derived from it
