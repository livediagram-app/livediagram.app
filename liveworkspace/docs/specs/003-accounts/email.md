# Email

Every email the platform sends goes out through Cloudflare Email Service on the liveworkspace account. That
covers accounts' sign-in codes, team invitations and token reminders, and each app's own notifications. There is
no third-party provider and no API key: a Worker sends through its `send_email` binding, which is the credential.

## How a Worker sends

- **Binding.** The Worker's `wrangler.toml` declares `[[send_email]] name = "EMAIL"`, and restates it as
  `[[env.staging.send_email]]` because bindings don't inherit into an environment.
- **Sender.** `EMAIL_FROM` is a var: a bare address or `Name <address>`. Its domain must be onboarded to Email
  Service on this account (dashboard → Email Service → Onboard Domain). Cloudflare then adds the SPF and DKIM
  records itself, because the zone is on the same account.
- **Code.** `@liveworkspace/email` (`packages/email`) is the only code that calls the binding. `sendEmail(env.EMAIL,
{ from, to, subject, html, text?, unsubscribeUrl? })` resolves to the message id, sends `List-Unsubscribe` when
  given an unsubscribe link, and gives up after 10 seconds. A refusal throws with Email Service's `code`, such as
  `E_RECIPIENT_SUPPRESSED`.
- **Who is sending.** Each caller keeps its own policy. accounts throws, because a sign-in code that doesn't
  send has to fail visibly. An app's sends are best effort: logged and counted, never failing the request that
  triggered them.
- **Email off.** A Worker without the binding sends nothing. An app reports `emailEnabled: false`, and accounts in
  development prints each email to its log instead.
- **Locally.** `wrangler dev` simulates the binding. It prints each email and saves its text and HTML to files,
  so local sign-in works without sending anything.

## Senders

A sender's domain must be onboarded to Email Service on the liveworkspace account. Each app sends from its own
domain where that domain is onboarded; accounts and livediagram send from liveplanner.app's, since
livediagram.app's zone is on the historical account, which the migration moves (docs/migration.md at the
repository root, step 7):

| Worker             | `EMAIL_FROM`                                                |
| ------------------ | ----------------------------------------------------------- |
| accounts           | `sign-in@liveplanner.app` (named liveworkspace by accounts) |
| livediagram's api  | `livediagram <hello@liveplanner.app>`                       |
| liveplanner's api  | `liveplanner <hello@liveplanner.app>`                       |
| livedocuments' api | `livedocuments <hello@livedocuments.app>`                   |
| livedesign's api   | `livedesign <hello@livedesign.app>`                         |

To move a sender to its own domain, onboard the domain to Email Service, change `EMAIL_FROM` in that Worker's
`wrangler.toml` (production and staging), and let CI's deploy ship it.

## Limits and cost

- **Plan.** Sending needs the Workers Paid plan. 3,000 emails a month are included per account, then it costs
  $0.35 per 1,000.
- **Daily quota.** A new account starts on a conservative daily quota that rises with its sending reputation. A
  refusal over the quota throws like any other.
- **Transactional only.** No marketing email.
- **Logs.** Delivery logs and metrics are in the dashboard under Email Service.
