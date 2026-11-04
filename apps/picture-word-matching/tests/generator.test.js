const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { vocabulary, categories } = require('../vocabulary.js');
const G = require('../generator.js');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('bank contains 300-500 distinct concrete words with locally bundled colour SVGs', () => {
  assert.ok(vocabulary.length >= 300 && vocabulary.length <= 500);
  assert.equal(new Set(vocabulary.map(w => w.id)).size, vocabulary.length);
  assert.equal(new Set(vocabulary.map(w => w.hiragana)).size, vocabulary.length);
  for (const word of vocabulary) {
    assert.match(word.hiragana, /^[ぁ-ゖー]+$/);
    assert.ok(categories[word.category]);
    const svg = fs.readFileSync(path.join(__dirname, '..', word.image), 'utf8');
    assert.match(svg, /<svg/); assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)=["']https?:/);
  }
});
test('hiragana and katakana modes have no mixed-script words; mixed mode always has both', () => {
  for (const n of [2,3,4,6]) for (const mode of ['hiragana','katakana','mixed']) {
    const modes = G.wordScripts(n, mode, seeded(n));
    assert.equal(modes.length, n);
    assert.equal(modes.includes('hiragana'), mode !== 'katakana');
    assert.equal(modes.includes('katakana'), mode !== 'hiragana');
    for (const word of vocabulary) assert.match(G.katakana(word.hiragana), /^[ァ-ヶー]+$/);
  }
});
test('random worksheets keep exact counts and a one-to-one deranged word permutation', () => {
  for (let seed = 0; seed < 200; seed++) for (const n of [2,3,4,6]) {
    const sheet = G.makeSheet(vocabulary, n, new Set(), seeded(seed));
    assert.equal(sheet.ids.length, n); assert.equal(new Set(sheet.ids).size, n);
    assert.ok(G.validSheet(sheet, new Set(vocabulary.map(w => w.id)), n));
    assert.ok(sheet.words.every((id, i) => id !== sheet.ids[i]));
    for (const answer of G.answerPairs(sheet)) assert.equal(sheet.ids[answer.pictureIndex], sheet.words[answer.wordIndex]);
  }
});
test('multiple sheets use unseen words first and finite pools never hang', () => {
  const used = new Set();
  for (let i = 0; i < 30; i++) G.makeSheet(vocabulary, 6, used, seeded(i));
  assert.equal(used.size, 180);
  const small = vocabulary.slice(0,4);
  for (let i = 0; i < 100; i++) assert.equal(G.makeSheet(small,4,used,()=>0).ids.length,4);
});
test('impossible conditions fail immediately rather than changing the count', () => {
  assert.throws(()=>G.makeSheet([],4),/0語/);
  assert.throws(()=>G.makeSheet(vocabulary.slice(0,2),4),/2語/);
  assert.throws(()=>G.makeSheet(vocabulary,1),/2〜6/);
  assert.throws(()=>G.makeSheet(vocabulary,7),/2〜6/);
});
test('saved shapes reject unknown IDs, missing pairs and repeated answers', () => {
  const allowed=new Set(vocabulary.map(w=>w.id)), valid=G.makeSheet(vocabulary,4);
  assert.equal(G.validSheet(valid,allowed,4),true);
  assert.equal(G.validSheet({...valid,ids:['unknown',...valid.ids.slice(1)]},allowed,4),false);
  assert.equal(G.validSheet({...valid,words:Array(4).fill(valid.ids[0])},allowed,4),false);
  assert.equal(G.validSheet(valid,allowed,3),false);
  assert.equal(G.validSheet(null,allowed,4),false);
});
test('generic and specific pictures cannot make the same sheet ambiguous', () => {
  const fish=vocabulary.find(w=>w.hiragana==='さかな'), puffer=vocabulary.find(w=>w.hiragana==='ふぐ');
  assert.throws(()=>G.makeSheet([fish,puffer],2,new Set(),()=>0),/曖昧/);
  for(let seed=0;seed<100;seed++){
    const sheet=G.makeSheet(vocabulary,6,new Set(),seeded(seed));
    const selected=vocabulary.filter(w=>sheet.ids.includes(w.id));
    for(const word of selected) assert.ok(selected.every(other=>!(word.conflicts||[]).includes(other.id)));
  }
});
