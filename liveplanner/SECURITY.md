# Security policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** through GitHub:

**[Report a vulnerability](https://github.com/livediagram-app/livediagram.app/security/advisories/new)**

Do not open a public issue, discussion or pull request for a security problem. This is the same private channel for
every liveworkspace app; the repository's root [`SECURITY.md`](../SECURITY.md) lists them all.

The full policy, covering scope, rules for testing, safe harbour and what to expect, is the help centre's
Report a Vulnerability page (`apps/help/app/policies/report-a-vulnerability/page.mdx`), published at
[liveplanner.app/help/policies/report-a-vulnerability](https://www.liveplanner.app/help/policies/report-a-vulnerability/).

In short:

- **In scope:** the hosted planner at liveplanner.app and the subdomains we run, such as `mcp.liveplanner.app`, plus the published liveplanner CLI.
- **Out of scope:** third-party services (Cloudflare, including its Email Service, and GitHub), and findings with no demonstrated security impact.
- **Safe harbour:** good-faith research that follows the policy is authorised, and we will not take legal action over it.
- liveplanner is free with no paid tier, so there is **no bug bounty** and **no guaranteed response time**. Every report is read, handled in good faith, and credited in the published advisory unless you would rather it wasn't.

## Supported versions

Only what liveplanner.app runs (the latest `main`) receives security fixes.
