import fs from 'node:fs';
const core=fs.readFileSync('core.mjs','utf8').replaceAll('export ','');
const assets=fs.readFileSync('assets.mjs','utf8').replaceAll('export ','');
const chatPolicy=fs.readFileSync('chat-policy.mjs','utf8').replaceAll('export ','');
const chatCore=fs.readFileSync('chat-core.mjs','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
const worker=fs.readFileSync('worker.mjs','utf8').replace(/^import .*;\r?\n/gm,'');
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',core+'\n'+chatPolicy+'\n'+chatCore+'\n'+assets+'\n'+worker);
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
// Keep migration metadata in both supported artifact layouts. Some hosting
// normalizers retain _appgen_meta while discarding non-manifest .openai files.
fs.mkdirSync('dist/_appgen_meta',{recursive:true});
fs.cpSync('drizzle','dist/_appgen_meta/drizzle',{recursive:true});
console.log('Built self-contained Sites Worker: UI + D1 gateway. Secrets are runtime-only.');
