# Browser regressions

```sh
npm ci
npx playwright install chromium webkit firefox
npm test
npm run test:browser
```

The suite starts a localhost-only static server at port 8141. `npm run test:browser:chromium` runs the Chromium project alone. Tests do not need remote application services, and include blocked external requests and direct `file://` startup.

The responsive matrix covers 12/16/20 boards at ten phone, tablet and desktop viewports. Chromium and WebKit touch tests enable mobile viewport emulation and check that the visual viewport stays at scale 1; Firefox runs the same touch/viewport cases without the unsupported mobile emulation option. Tests verify roll, answer and placement phases, minimum touch targets, rendered SVG text bounds, board access and an orientation gate where the viewport cannot fit. Gameplay regressions cover touch and physical keyboard input, rotation, timer pause/resume, expiry, duplicate submissions, scoring, passing, the result screen and restarting during pending work. The orientation gate is also tested with rejected fullscreen/rotation requests and when changing to a smaller board through settings.

All three browser projects remain enabled. A missing browser executable or environment failure is a test failure, not a skipped test. For a preinstalled browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` or `PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH` to its executable (WebKit's `pw_run.sh` on macOS).

Verification on 2026-10-18 completed 60 unique cases each in Chromium and WebKit: a full 108-case run, followed by 18 focused cases after the ledger and target-orientation fixes (six repeat existing coverage). Firefox could not launch in this macOS environment: the preinstalled build reported a missing profile folder, and the matching downloaded build failed at the macOS sandbox extension / software compositor boundary. Firefox compatibility therefore remains unverified; its project and assertions are retained for a working runner. Physical-device checks have not been performed.

The compact ledger tests render three-digit increments/totals at real device dimensions and check that text remains separate and within its column, including history rollover on short and tall boards.

`pause.spec.js` adds eight regressions for pausing the opponent during calculation and placement under settings, the orientation gate and background visibility, restarting a paused game, and keyboard focus on the answer field. These additions have been syntax-checked but not run: browser execution was blocked by the session's access restriction. They are not included in the executed case counts above. The DOM-independent continuation gate is covered by four passing tests in `test/akis.test.js`; the full Node suite has 43 passing tests.

Browser emulation cannot establish physical-device support. Before release, repeat on real iPhone/iPad and Android phone/tablet: portrait/landscape during each phase, browser bars expanded/collapsed, notch safe areas, fullscreen denial, physical keyboard, two taps on a cell, background/resume and sound.
