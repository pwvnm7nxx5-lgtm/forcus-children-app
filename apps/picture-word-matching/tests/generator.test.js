const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { vocabulary, categories } = require('../vocabulary.js');
const G = require('../generator.js');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('bank contains 240 reviewed everyday words with local generated artwork and no emoji fallback', () => {
  assert.equal(vocabulary.length, 240);
  assert.equal(new Set(vocabulary.map(w => w.id)).size, vocabulary.length);
  assert.equal(new Set(vocabulary.map(w => w.hiragana)).size, vocabulary.length);
  for (const word of vocabulary) {
    assert.match(word.hiragana, /^[ぁ-ゖー]+$/);
    assert.ok(categories[word.category]);
    const bytes = fs.readFileSync(path.join(__dirname, '..', word.image));
    assert.match(word.image, /^assets\/illustrations\/[a-z-]+\.webp$/);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(word.art.columns, 4); assert.equal(word.art.rows, 3);
    assert.ok(word.art.column >= 0 && word.art.column < 4 && word.art.row >= 0 && word.art.row < 3);
    assert.ok(word.art.width / 4 >= 360 && word.art.height / 3 >= 360);
    const left=(word.art.column-word.art.leftBleed)*word.art.width/4;
    const width=(1+word.art.leftBleed-word.art.rightTrim)*word.art.width/4;
    assert.ok(left>=0&&left+width<=word.art.width+.01);
  }
  assert.equal(new Set(vocabulary.map(w => w.image)).size, 20);
  assert.ok(vocabulary.every(w => !/まほう|ゆにこーん|ぴにゃーた|まとりょーしか|とぅくとぅく/.test(w.hiragana)));
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
  const clock=vocabulary.find(w=>w.id==='clock'), watch=vocabulary.find(w=>w.id==='watch');
  assert.throws(()=>G.makeSheet([clock,watch],2,new Set(),()=>0),/曖昧/);
  for(let seed=0;seed<100;seed++){
    const sheet=G.makeSheet(vocabulary,6,new Set(),seeded(seed));
    const selected=vocabulary.filter(w=>sheet.ids.includes(w.id));
    for(const word of selected) assert.ok(selected.every(other=>!(word.conflicts||[]).includes(other.id)));
  }
});
test('atlas layout and browser metadata agree with the reviewed source catalog',()=>{
  const {batches}=require('../art-catalog.js');
  const manifest=require('../art-manifest.json');
  assert.equal(batches.length,20);
  assert.equal(batches.flatMap(b=>b.items).length,240);
  for(const batch of batches){
    assert.equal(batch.items.length,12);
    const atlas=manifest.atlases[batch.id];assert.ok(atlas);
    assert.match(atlas.sourceSha256,/^[a-f0-9]{64}$/);
    batch.items.forEach((source,index)=>{
      const word=vocabulary.find(w=>w.id===source.id);
      assert.equal(word.hiragana,source.hiragana);
      assert.equal(word.art.column,index%4);assert.equal(word.art.row,Math.floor(index/4));
    });
  }
  const vm=require('node:vm'),context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../art-manifest.js'),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.PictureWordArtManifest)),manifest);
});
test('legacy identifiers never change a homonym into the wrong object',()=>{
  const legacy=require('../legacy-ids.js');
  assert.equal(legacy['1F577'],undefined,'a spider must not become a cloud');
  assert.equal(legacy['1F9AA'],undefined,'an oyster must not become a persimmon');
  assert.equal(legacy['1FA84'],undefined,'a magic wand is not in the new curriculum');
  assert.equal(legacy['1F34E'],'apple');assert.equal(legacy['1F408'],'cat');
  assert.ok(Object.values(legacy).every(id=>vocabulary.some(w=>w.id===id)));
});
