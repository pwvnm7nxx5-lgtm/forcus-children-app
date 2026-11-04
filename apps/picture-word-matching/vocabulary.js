// Reviewed concrete vocabulary. All active artwork is generated for this project.
(function(root){
 const catalog=typeof module!=='undefined'&&module.exports?require('./art-catalog.js'):root.PictureWordArtCatalog;
 const manifest=typeof module!=='undefined'&&module.exports?require('./art-manifest.json'):root.PictureWordArtManifest;
 const categories={animals:'どうぶつ',food:'たべもの',life:'せいかつ',tools:'がっこうのどうぐ',transport:'のりもの・まち',nature:'しぜん',play:'あそび'};
 const families=[
  ['car','taxi','police-car','ambulance','fire-engine','truck','bus'],
  ['clock','watch'],['desk','table'],['handbag','schoolbag'],['bear','teddy'],
  ['rice','onigiri','curry','sushi','lunchbox'],['ramen','udon','spaghetti'],
  ['egg','fried-egg'],['shoes','boots','slippers'],['pencil','coloured-pencils'],
  ['monkey','gorilla'],['notebook','picture-book'],
 ];
 const vocabulary=catalog.batches.flatMap(batch=>{
  const atlas=manifest.atlases[batch.id];
  if(!atlas)throw Error('教材の画像データが不足しています。');
  return batch.items.map((word,index)=>({
   id:word.id,hiragana:word.hiragana,category:word.category,image:atlas.image,
   art:{width:atlas.width,height:atlas.height,columns:batch.columns,rows:batch.rows,column:index%batch.columns,row:Math.floor(index/batch.columns),leftBleed:word.id === 'slide' ? 0.04 : 0,rightTrim:word.id === 'jump-rope' ? 0.04 : 0},
   conflicts:[...new Set(families.filter(group=>group.includes(word.id)).flat().filter(id=>id!==word.id))],
  }));
 });
 const api={categories,vocabulary};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PictureWordVocabulary=api;
})(typeof globalThis!=='undefined'?globalThis:this);
