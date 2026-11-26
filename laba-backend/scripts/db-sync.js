// Applies additive schema changes to the database during a Render build, so a deploy never
// runs new code against an old schema. Runs only on Render (RENDER=true); local builds skip it.
// Destructive changes (dropping tables/columns with data) are NOT applied: prisma refuses without
// --accept-data-loss, the build fails, and Render keeps the previous version live.
const { execSync } = require('child_process');

if (process.env.RENDER !== 'true' && process.env.DB_SYNC_ON_BUILD !== 'true') {
  console.log('[db-sync] skipped (not a Render build)');
  process.exit(0);
}

try {
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log('[db-sync] database schema is up to date');
} catch {
  console.error('[db-sync] schema sync failed (possibly a destructive change). Apply it manually, then redeploy.');
  process.exit(1);
}
