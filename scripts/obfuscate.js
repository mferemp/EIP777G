// scripts/obfuscate.js
// Production build: minify + obfuscate client JS, no source maps
import { minify } from 'terser';
import JsObf from 'javascript-obfuscator';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'live/js';
const PER_FILE_TIMEOUT_MS = 90_000;

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  try {
    const entries = await readdir(DIR);
    const files = entries.filter((f) => f.endsWith('.js'));
    console.log(`[obfuscate] targets: ${files.join(', ') || '(none)'}`);

  for (const f of files) {
      if (f === 'gate.js') continue;
      const filePath = join(DIR, f);
      const { size } = await stat(filePath);
      const head = size > 0 ? await readFile(filePath, 'utf8') : '';
      if (head.startsWith('(function(_0x') || head.startsWith('const _0x') && head.includes('while(!![])')) {
        console.log(`[obfuscate] skip obfuscated ${f}`);
        continue;
      }
      console.log(`[obfuscate] file=${f} size=${size}`);

      const src = await readFile(filePath, 'utf8');

      console.log(`[obfuscate] minify start ${f}`);
      const minifyPromise = minify(src, {
        sourceMap: false,
        compress: true,
        mangle: true,
        keep_classnames: false,
        keep_fnames: false,
      });
      const minified = await withTimeout(minifyPromise, PER_FILE_TIMEOUT_MS);
      console.log(`[obfuscate] minify done ${f}`);

      console.log(`[obfuscate] obfuscate start ${f}`);
      const obfuscatePromise = Promise.resolve(
        JsObf.obfuscate(minified.code, {
          compact: true,
          // controlFlowFlattening: true,
          // deadCodeInjection: true,
          stringArray: true,
          stringArrayEncoding: ['rc4'],
          stringArrayThreshold: 0.75,
          rotateStringArray: true,
          shuffleStringArray: true,
          sourceMap: false,
          disableConsoleOutput: true,
        }).getObfuscatedCode()
      );
      const ob = await withTimeout(obfuscatePromise, PER_FILE_TIMEOUT_MS);
      console.log(`[obfuscate] obfuscate done ${f}`);

      await writeFile(filePath, ob);
      console.log(`[obfuscate] wrote ${f}`);
    }
    console.log('[obfuscate] complete');
  } catch (e) {
    console.error('[obfuscate] failed:', e);
    process.exit(1);
  }
}

main();