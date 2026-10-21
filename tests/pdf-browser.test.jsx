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
  it('retries once when the cached browser is dead but did not report it',async()=>{
    const first=fake(),second=fake(),launch=vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    first.createBrowserContext.mockRejectedValue(new Error('Connection closed.'));
    const session=createBrowserSession(launch);
    await expect(session.context()).resolves.toBeDefined();expect(launch).toHaveBeenCalledTimes(2);
  });
  it('gives up after one retry',async()=>{
    const launch=vi.fn(async()=>{const b=fake();b.createBrowserContext.mockRejectedValue(new Error('Connection closed.'));return b});
    await expect(createBrowserSession(launch).context()).rejects.toThrow('Connection closed.');expect(launch).toHaveBeenCalledTimes(2);
  });
});
