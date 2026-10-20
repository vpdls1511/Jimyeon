import assert from 'node:assert/strict';

export function shouldBuildRelease(release,commit){
 if(!release)return true;
 if(!release.isDraft)return false;
 assert.equal(release.targetCommitish,commit,'An existing draft belongs to another commit; increment the version');
 return true;
}

export function verifyReleaseAssets(release,digests,commit){
 assert.equal(release.target_commitish,commit,'Release source commit differs from the build');
 assert.equal(release.assets.length,digests.size,'Unexpected release assets');
 for(const [name,digest] of digests){
  const asset=release.assets.find(asset=>asset.name===name);
  assert(asset,`Missing release asset: ${name}`);
  assert.equal(asset.state,'uploaded',`Incomplete release asset: ${name}`);
  assert.equal(asset.digest,`sha256:${digest}`,`Release checksum mismatch: ${name}`);
 }
}
