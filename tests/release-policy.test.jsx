import {expect,it} from 'vitest';
import {shouldBuildRelease,verifyReleaseAssets} from '../scripts/release-policy.mjs';

it('builds a new version but skips an already published version',()=>{
 expect(shouldBuildRelease(undefined,'commit')).toBe(true);
 expect(shouldBuildRelease({isDraft:false,targetCommitish:'older'},'commit')).toBe(false);
});
it('only resumes a draft created from the same source commit',()=>{
 expect(shouldBuildRelease({isDraft:true,targetCommitish:'commit'},'commit')).toBe(true);
 expect(()=>shouldBuildRelease({isDraft:true,targetCommitish:'other'},'commit')).toThrow('another commit');
});
it('requires complete uploads with matching checksums and source before publication',()=>{
 const digests=new Map([['app.zip','abc'],['SHA256SUMS.txt','def']]);
 const release={target_commitish:'commit',assets:[{name:'app.zip',state:'uploaded',digest:'sha256:abc'},{name:'SHA256SUMS.txt',state:'uploaded',digest:'sha256:def'}]};
 expect(()=>verifyReleaseAssets(release,digests,'commit')).not.toThrow();
 for(const change of [doc=>doc.target_commitish='other',doc=>doc.assets.pop(),doc=>doc.assets[0].state='new',doc=>doc.assets[0].digest='sha256:wrong',doc=>doc.assets[0].name='other.zip']){
  const altered=structuredClone(release);change(altered);expect(()=>verifyReleaseAssets(altered,digests,'commit')).toThrow();
 }
});
