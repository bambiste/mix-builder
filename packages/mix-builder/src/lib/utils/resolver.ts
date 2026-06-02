import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve a path from a directory.
 */
export function resolveFrom(dir: string, relativePath: string) {
  // console.log('resolving', { dir, relativePath });
  return resolve(dir, relativePath);
}
