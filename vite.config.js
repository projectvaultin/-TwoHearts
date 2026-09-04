import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

const root = resolve(__dirname);
const htmlEntries = Object.fromEntries(
  readdirSync(root)
    .filter(f => f.endsWith('.html'))
    .map(f => [f.replace(/\.html$/, ''), resolve(root, f)])
);

export default defineConfig({
  base: '/-TwoHearts/',
  build: {
    rollupOptions: { input: htmlEntries }
  }
});
