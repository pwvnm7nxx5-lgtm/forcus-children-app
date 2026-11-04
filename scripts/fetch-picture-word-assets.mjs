// Fetch unmodified, pinned OpenMoji colour SVGs. No network is used by the app itself.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { vocabulary } = require('../apps/picture-word-matching/vocabulary.js');
if(vocabulary.some(word=>word.art)){
 console.log('現在の教材は生成画像です。旧OpenMoji素材の取得は行いません。新しい画像の取り込みには scripts/import-matching-art.mjs を使ってください。');
 process.exit(0);
}
const commit = '626bdc684b85738ebdba73ad83c499c2eb88c5dd';
const folder = new URL('../apps/picture-word-matching/assets/', import.meta.url);
await fs.mkdir(folder, { recursive: true });
const base = `https://raw.githubusercontent.com/hfg-gmuend/openmoji/${commit}`;
let cursor = 0;
const failures = [];
async function worker() {
  while (cursor < vocabulary.length) {
    const word = vocabulary[cursor++];
    try {
      const response = await fetch(`${base}/color/svg/${word.id}.svg`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const svg = await response.text();
      if (!svg.includes('<svg') || /<script|<foreignObject|https?:\/\//.test(svg.replace(/xmlns="[^"]*"/g, ''))) throw new Error('unsafe SVG');
      await fs.writeFile(new URL(`${word.id}.svg`, folder), svg);
    } catch (error) { failures.push(`${word.id} ${word.hiragana}: ${error.message}`); }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const license = await fetch(`${base}/LICENSE.txt`);
if (!license.ok) throw new Error('License download failed');
await fs.writeFile(new URL('LICENSE-OpenMoji.txt', folder), await license.text());
console.log(JSON.stringify({ entries: vocabulary.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
