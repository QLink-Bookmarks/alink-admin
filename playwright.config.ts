import { defineConfig } from '@playwright/test';

const port = Number(process.env.ADMIN_E2E_PORT ?? 8101);
const viewports = {
  wide: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
  'boundary-768': { width: 768, height: 1024 },
  'boundary-769': { width: 769, height: 1024 },
};

export default defineConfig({
  testDir: './tests/smoke',
  outputDir: './output/test-results',
  reporter: [['list'], ['html', { outputFolder: 'output/playwright-report', open: 'never' }]],
  workers: 1,
  use: { baseURL: `http://localhost:${port}`, headless: true, trace: 'retain-on-failure' },
  projects: Object.entries(viewports).flatMap(([name, viewport]) =>
    (['light', 'dark'] as const).map((colorScheme) => ({
      name: `${name}-${colorScheme}`,
      use: { viewport, colorScheme, browserName: 'chromium' as const },
    })),
  ),
  webServer: {
    command: `bun run preview --host localhost --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});
