# Browser regression tests

The game remains a static HTML/CSS/JavaScript application. Node dependencies are
used only for its tests.

```sh
npm ci
npm run test:e2e:install
npm test
npm run test:e2e
```

Playwright starts a localhost server on port 4173 and runs the same tests in
Chromium, Firefox and WebKit. To focus on one engine or scenario:

```sh
npm run test:e2e -- --project=chromium -g '390x844'
npm run test:e2e -- --project=webkit -g 'compact touch'
```

The suite uses the real pinned RoughJS renderer shipped in `vendor/`, without
intercepting its requests. Web fonts are unavailable deliberately, exercising the supported
fallback font. It does not mock game logic or write to the live game state.
Most cases use reduced motion; the reset-during-AI case uses full animations.
Screenshots and traces are retained for failures in `test-results/`.
The loading regression blocks all external hosts and verifies startup and a shot.

Coverage includes the agreed 15 viewport dimensions plus 600×960 and 1024×1366
portrait tablets in placement and battle, the visible compact placement hint,
minimum cell/button sizes, visibility and overflow, readiness and editing,
mouse/keyboard targeting, keyboard ship placement, explicit touch firing,
duplicate input, orientation changes, pause/resume and reset during AI thinking.
Drag interruption tests cover pointer cancellation, capture loss, window blur
and resizing even when the computed board size stays unchanged. Browser API
stubs exercise fullscreen/orientation rejection without modifying game state.
Full win/loss games use a deterministic random source and virtual time while
running the actual game rules, AI and renderer; result rotation is also checked.

Verified on 18 October 2026: 46 Node tests and 74 Chromium/WebKit browser cases
(37 per engine) pass. The original 39 game/AI tests remain unchanged. Firefox
is configured but could not start on this host: headless reports `Could not find
profile folder`, while headed launch reports a sandbox permission failure,
including with a fresh browser installation. This is a verification gap, not
a passing Firefox result; the Firefox project has not been skipped or removed.
Interruption tests cover pointer cancellation, capture loss, focus loss, and
resizing even when the board keeps its dimensions. Permission tests stub only
the browser fullscreen/orientation methods to exercise rejection and manual
rotation without replacing any game logic.

Browser emulation cannot certify physical devices. Before declaring complete
device compatibility, verify on an actual iPhone/Safari, Android phone/Chrome
and tablet:

- Both orientations, expanding/collapsing browser bars, and notched safe areas.
- Ship dragging, tapping to rotate, cancellation on a system interruption.
- Target selection, changing target and rapid tapping of the fire button.
- Rotation during preparation, a selected target, AI thinking and game over.
- Fullscreen/orientation permission rejection and manual rotation fallback.
- Browser zoom and the device's screen reader.
