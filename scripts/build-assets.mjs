import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';

await build({entryPoints:['src/view-3d.js'],outfile:'public/view-3d.js',bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,legalComments:'eof'});
await copyFile(new URL('../node_modules/three/LICENSE',import.meta.url),new URL('../public/three-LICENSE.txt',import.meta.url));
console.log('3D match view bundled.');
