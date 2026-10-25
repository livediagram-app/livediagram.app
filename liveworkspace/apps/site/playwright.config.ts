import { defineConfig, devices } from '@playwright/test';

// The site's e2e checks (e2e/trusted-types.spec.ts): its static export, served with its own headers
// (e2e/serve-export.mjs), in Chromium, the browser that enforces Trusted Types. Build first: `pnpm build`.
const PORT = 3090;

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node e2e/serve-export.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
