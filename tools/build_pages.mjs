import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');
const staticEntries = ['index.html', 'css', 'js', 'data', 'assets', 'examples'];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const entry of staticEntries) {
  const source = join(projectRoot, entry);
  const target = join(outputDir, entry);
  if (!existsSync(source)) {
    throw new Error(`Missing required static entry: ${entry}`);
  }
  cpSync(source, target, { recursive: true });
}

copyFileSync(join(projectRoot, '_headers'), join(outputDir, '_headers'));
console.log(`Built Cloudflare Pages output in ${outputDir}`);
