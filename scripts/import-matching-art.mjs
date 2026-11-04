// Imports built-in imagegen outputs as WebP atlases. Encoding only: no redrawing or cropping.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {batches}=require('../apps/picture-word-matching/art-catalog.js');
const sources=JSON.parse(await fs.readFile(process.argv[2]||'output/playwright/matching-art-sources.json','utf8'));
const root=new URL('../apps/picture-word-matching/',import.meta.url);
await fs.mkdir(new URL('assets/illustrations/',root),{recursive:true});
const manifest={version:2,format:'webp',columns:4,rows:3,atlases:{}};
for(const batch of batches){
 const source=sources[batch.id];if(!source)throw Error('Missing source '+batch.id);
 const bytes=await fs.readFile(source);
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',source],{encoding:'utf8'})).streams[0];
 const target=new URL(`assets/illustrations/${batch.id}.webp`,root);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',source,'-c:v','libwebp','-quality','95','-compression_level','6','-frames:v','1','-y',fileURLToPath(target)]);
 manifest.atlases[batch.id]={image:`assets/illustrations/${batch.id}.webp`,width:metadata.width,height:metadata.height,sourceFile:path.basename(source),sourceSha256:createHash('sha256').update(bytes).digest('hex')};
}
await fs.writeFile(new URL('art-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(new URL('art-manifest.js',root),'// Generated browser wrapper for art-manifest.json\nwindow.PictureWordArtManifest='+JSON.stringify(manifest)+';\n');
console.log(JSON.stringify({atlases:Object.keys(manifest.atlases).length,words:batches.flatMap(b=>b.items).length}));
