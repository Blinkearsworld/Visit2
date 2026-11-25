import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { TEST_MIGRATIONS: migrations, SESSION_SECRET: 'test-secret',
        // test-only values (never real secrets): Meta webhook signing, page-token sealing, no real sending
        META_APP_SECRET: 'test-meta-secret', META_VERIFY_TOKEN: 'test-verify', META_ENC_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=', META_DRY_RUN: '1', PAY_DRY_RUN: '1' } },
    })],
    test: { setupFiles: ['./test/apply-migrations.js'] },
  };
});
