import path from 'node:path';
import { copyFileSync } from './copy.js';
import { cwd } from 'node:process';

const dest = path.join(cwd(copyFileSync), 'dist/lib/builder/schema');
console.log('copy file to', dest);
copyFileSync(
  path.join(cwd(), 'src/lib/builder/schema/build-config.schema.json'),
  dest
);
