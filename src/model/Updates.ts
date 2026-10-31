import { version } from '../../package.json';
export const RELEASES_URL = 'https://github.com/vitals5/schematico/releases/latest';
export const RELEASES_API = 'https://api.github.com/repos/vitals5/schematico/releases/latest';
const stableTag = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export class UpdateCheckError extends Error {
  constructor(public reason: 'network'|'timeout'|'limit'|'unavailable'|'invalid') { super(reason); }
}
export interface UpdateResult { currentVersion: string; latestVersion: string; tag: string; url: string; status: 'available'|'current'|'ahead' }
export function compareVersions(a: string, b: string): number {
  const parse = (value:string) => {
    const match=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
    if(!match || value.trim()!==value || match[4]?.slice(1).split('.').some(id=>/^0\d+$/.test(id)))throw new UpdateCheckError('invalid');
    return match;
  };
  const first=parse(a),second=parse(b);
  for(let i=1;i<=3;i++) {
    if(first[i].length!==second[i].length)return Math.sign(first[i].length-second[i].length);
    if(first[i]!==second[i])return first[i]>second[i]?1:-1;
  }
  if(!!first[4]!==!!second[4])return first[4]?-1:1;
  if(first[4]&&second[4]){
    const left=first[4].slice(1).split('.'),right=second[4].slice(1).split('.');
    for(let i=0;i<Math.max(left.length,right.length);i++){
      if(left[i]===right[i])continue;
      if(left[i]===undefined)return -1;if(right[i]===undefined)return 1;
      const aNumeric=/^\d+$/.test(left[i]),bNumeric=/^\d+$/.test(right[i]);
      if(aNumeric!==bNumeric)return aNumeric?-1:1;
      if(aNumeric && left[i].length!==right[i].length)return Math.sign(left[i].length-right[i].length);
      return left[i]>right[i]?1:-1;
    }
  }
  return 0;
}
export async function checkForUpdates(currentVersion = version, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<UpdateResult> {
  try {
    const response=await fetcher(RELEASES_API,{headers:{Accept:'application/vnd.github+json'},credentials:'omit',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
    if(response.status===403||response.status===429)throw new UpdateCheckError('limit');
    if(!response.ok)throw new UpdateCheckError('unavailable');
    const release=await response.json();
    if(!release||release.draft!==false||release.prerelease!==false||typeof release.tag_name!=='string'||release.tag_name.trim()!==release.tag_name||!stableTag.test(release.tag_name))throw new UpdateCheckError('invalid');
    const latestVersion=release.tag_name.replace(/^v/,'');
    const compared=compareVersions(latestVersion,currentVersion);
    return {currentVersion,latestVersion,tag:release.tag_name,url:'https://github.com/vitals5/schematico/releases/tag/'+encodeURIComponent(release.tag_name),status:compared>0?'available':compared<0?'ahead':'current'};
  } catch(error) {
    if(error instanceof UpdateCheckError)throw error;
    throw new UpdateCheckError(error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)?'timeout':'network');
  }
}
