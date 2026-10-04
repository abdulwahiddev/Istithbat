import { execFileSync } from 'node:child_process';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const bad=files.filter(f=>/^\.env(?!\.example$)/.test(f)||/^(secrets|credentials|private-data)\//.test(f));
if (bad.length) throw new Error(`Private paths exposed: ${bad.join(', ')}`);
const names=Object.keys(process.env).filter(k=>k.startsWith('NEXT_PUBLIC_')&&/(SECRET|KEY|TOKEN)/.test(k));
if (names.length) throw new Error(`Privileged NEXT_PUBLIC_ names: ${names.join(', ')}`);
console.log('No prohibited tracked paths or public secret variable names');
