import { spawnSync } from 'node:child_process';
import { nativeFixtureFiles } from '../src/packages/testing/NativeFixture';
if(!nativeFixtureFiles().length)throw new Error('SCHEMATICO_NATIVE_FIXTURE muss auf ein externes Referenzarchiv zeigen.');
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['test'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;process.exit(result.status??1);
