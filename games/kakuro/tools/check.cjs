'use strict';
const {readdirSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
for(const directory of ['.','tools','test'])for(const file of readdirSync(directory))if(/\.(cjs|js)$/.test(file))execFileSync(process.execPath,['--check',join(directory,file)],{stdio:'inherit'});
console.log('JavaScript syntax checks passed.');
