/**
 * Get an environment variable from process.env or Cloudflare Workers bindings.
 * In CF Workers, process.env is not available — secrets are accessed via getCloudflareContext().
 */
export function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const val = (getCloudflareContext().env as Record<string, string | undefined>)[key];
    if (val) return val;
  } catch { /* not running in CF Workers */ }
  return undefined;
}
