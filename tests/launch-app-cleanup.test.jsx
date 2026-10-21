import {afterAll,expect,it} from 'vitest';
afterAll(()=>expect(document.querySelector('.app')).toBeNull());
const {launchApp}=await import('./launch-app');
it('unmounts the launched App when the shared cleanup runs',async()=>{await launchApp();expect(document.querySelector('.app')).not.toBeNull()});
