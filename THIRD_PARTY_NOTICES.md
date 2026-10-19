# Third-party notices

Jimyeon uses the following major packages. The full dependency versions and registry integrity hashes are recorded in `package-lock.json`. Original license and notice files from installed runtime packages are collected into `THIRD_PARTY_LICENSES.txt` by `npm run build` and included in the desktop package together with this file and `LICENSE`. Electron also supplies its runtime and Chromium notices in the packaged application.

| Package | License |
| --- | --- |
| BlockNote core, React, Mantine, code-block | MPL-2.0 |
| BlockNote XL multi-column | GPL-3.0-only (GPL option selected) |
| React, Mantine, Vite, Vitest, ProseMirror, TipTap, KaTeX | MIT |
| Paged.js | MIT |
| Puppeteer Core | Apache-2.0 |
| idb | ISC |
| Lucide | ISC |
| Inter font | SIL Open Font License 1.1 |

The application uses the GPL option of the XL multi-column package and is designated GPL-3.0-only for distribution. Original packages have not been modified.

BlockNote: https://www.blocknotejs.org/

See `LICENSE` for the GNU GPL version 3 text.

Corresponding application source: https://github.com/vpdls1511/Jimyeon . Use the source tag matching the application version when building a released version.
