import {readFile,writeFile} from 'node:fs/promises';

const file=new URL('../touchline-duel-demo.html',import.meta.url),html=await readFile(file,'utf8');
const marker='<script type="module">',start=html.indexOf(marker)+marker.length,end=html.indexOf('const $=id=>',start);
if(start<marker.length||end<start)throw new Error('Standalone warm-up script markers are missing');
const engine=(await readFile(new URL('../public/engine.js',import.meta.url),'utf8')).replace(/^export /gm,'');
await writeFile(file,html.slice(0,start)+'\n'+engine+'\n'+html.slice(end));
console.log('Standalone warm-up movement updated.');
