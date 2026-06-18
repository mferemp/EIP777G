// scripts/obfuscate.js
// Production build: minify + obfuscate client JS, no source maps

import { minify } from 'terser';
import JsObf from 'javascript-obfuscator';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'live/js';

async function main() {
  try {
    const files = await readdir(DIR);
    for (const f of files) {
      if (!f.endsWith('.js')) continue;
      const filePath = join(DIR, f);
      const src = await readFile(filePath, 'utf8');
      
      // First minify with terser
      const { code } = await minify(src, { 
        sourceMap: false, 
        compress: true, 
        mangle: true,
        keep_classnames: false,
        keep_fnames: false
      });
      
      // Then obfuscate
      const obf = JsObf.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        deadCodeInjection: true,
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 0.75,
        rotateStringArray: true,
        shuffleStringArray: true,
        sourceMap: false,
        disableConsoleOutput: true
      }).getObfuscatedCode();
      
      await writeFile(filePath, obf);
      console.log(`Obfuscated: ${f}`);
    }
    console.log('Client obfuscated, no source maps');
  } catch (e) {
    console.error('Obfuscation failed:', e);
    process.exit(1);
  }
}

main();