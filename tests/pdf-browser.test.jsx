import {describe,expect,it,vi} from 'vitest';
import {executable,createBrowserSession,missingBrowserMessage} from '../pdf-browser.mjs';

describe('PDF browser lookup',()=>{
  const env={LOCALAPPDATA:'C:\\Users\\a\\AppData\\Local',ProgramFiles:'C:\\Program Files','ProgramFiles(x86)':'C:\\Program Files (x86)'};
  const find=installed=>executable({env,platform:'win32',exists:p=>installed.includes(p)});
  it('finds system-wide Chrome and Edge on Windows',()=>{
    expect(find(['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'])).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(find(['C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'])).toContain('Program Files (x86)');
    expect(find(['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'])).toContain('msedge.exe');
    expect(find([])).toBeUndefined();
    expect(executable({env:{},platform:'win32',exists:()=>false})).toBeUndefined();
  });
  it('mentions the environment variable workaround when nothing is found',()=>{
    expect(missingBrowserMessage).toContain('PUPPETEER_EXECUTABLE_PATH');
  });
});
describe('PDF browser recovery',()=>{
  const fake=()=>{const b={connected:true,handlers:{},on(e,f){b.handlers[e]=f},createBrowserContext:vi.fn(async()=>({}))};return b};
  it('launches again after the browser disconnects',async()=>{
    const first=fake(),second=fake(),launch=vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const session=createBrowserSession(launch);
    await session.context();first.connected=false;first.handlers.disconnected();
    await session.context();expect(launch).toHaveBeenCalledTimes(2);expect(second.createBrowserContext).toHaveBeenCalled();
  });
  it('rejects with the launch message when no browser can be started',async()=>{
    const launch=vi.fn(async()=>{throw new Error(missingBrowserMessage)});
    await expect(createBrowserSession(launch).context()).rejects.toThrow('PUPPETEER_EXECUTABLE_PATH');
    await expect(createBrowserSession(launch).context()).rejects.toThrow(missingBrowserMessage);
  });
});
