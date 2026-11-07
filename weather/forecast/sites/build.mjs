import fs from 'node:fs';
const core=fs.readFileSync('core.mjs','utf8').replaceAll('export ','');
const assets=fs.readFileSync('assets.mjs','utf8').replaceAll('export ','');
const worker=fs.readFileSync('worker.mjs','utf8').replace(/^import .*;\r?\n/gm,'');
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',core+'\n'+assets+'\n'+worker);
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built self-contained Sites Worker: UI + D1 gateway. Secrets are runtime-only.');
