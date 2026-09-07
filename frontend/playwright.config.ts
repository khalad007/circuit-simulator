import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: { baseURL: 'http://localhost:3000', channel: 'msedge', headless: true, launchOptions: { args: ['--mute-audio'] }, viewport: { width: 1500, height: 1000 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
    { command: '..\\backend\\venv\\Scripts\\python.exe -B -m uvicorn main:app --app-dir ../backend --port 8000', url: 'http://127.0.0.1:8000/docs', reuseExistingServer: true, timeout: 60_000 },
  ],
});
