// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const USE_DOCKER = process.env.USE_DOCKER !== '0';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // singolo container, evita conflitti
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // Browser permissions: simula un user gesture trust per AudioContext + autoplay
    contextOptions: {
      permissions: [],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Permette di creare AudioContext senza interazione esplicita (utile per asserzioni)
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],

  // Quando USE_DOCKER=0 (es. in CI con container già su) skippa il bootstrap
  webServer: USE_DOCKER
    ? {
        command: 'docker compose up --build',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
