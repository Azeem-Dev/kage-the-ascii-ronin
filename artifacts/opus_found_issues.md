# Issues found during codebase review

Date: 2026-11-24
Scope: uncommitted diff (`src/render/assetRenderer.ts`, `src/riverScene.ts`, `artifacts/preview/optimization-performance.json`), repo structure, `ISSUES.md`, `main.ts`.
Note: this is a static read only. Nothing was run, so every item is an observation to verify, not a reproduced bug.

## A. In-progress scroll-blit change (`assetRenderer.ts` / `riverScene.ts`)

1. **Dead code.** `scrollDisplayedCanvas` and the `scrollCanvas` field are defined but never called. Remove them or wire them in.
2. **Rounding drift.** `riverScene.ts` computes `scrollX = -Math.round((cameraX - lastCameraX) / detailStep)`, which rounds the delta each frame. Fractional camera motion can make the shift differ from the real motion, so many cells show as "changed" and the savings are lost. Better: compare `Math.round(cameraX / detailStep)` with the previous rounded value.
3. **Fragile invariant.** The shift is only correct if `previous` always matches what is in `outputPixels`. This holds today, but lighting (`illuminate`), `atmosphere.render` and time-driven water change ids without camera motion and rely on the diff pass to repair them. Any future change to that ordering can leave stale pixels.
4. **Magic colors.** `0xff100b07` (ABGR of `#070b10`) and the `'#070b10'` string are duplicated. Use one named constant.
5. **Dirty-tile strategy.** While scrolling, nearly every 64x64 tile is dirty, so many `putImageData` calls can cost more than one full put. Add a threshold (e.g. more than ~50% dirty means one full put).
6. **No test.** Nothing checks that the scroll path produces the same pixels as a full redraw. Add a pixel-equality regression test.
7. **`optimization-performance.json` modified.** Confirm it is a real benchmark result intended for commit.

## B. Architecture

8. **Two parallel render engines.** `main.ts` imports the legacy pipeline (`SceneBuffer`, `AsciiPass`, `AsciiSceneRenderer`, `TestScene`) and also calls `startRiverScene`. About 2.3k lines (`asciiScene.ts` 756, `testScene.ts` 768, `sceneBuffer.ts` 401, `asciiPass.ts` 399) look like the legacy path. Confirm which is live; delete or archive the other. It may be contributing to the render and perf issues.
9. **`riverScene.ts` does too much.** World build, input, camera, lighting, render loop and timing telemetry (via `canvas.dataset`) are in one file. Extract camera, input and a game/loop class to make PERF-01 and COLL-01 testable.

## C. Repository hygiene

10. **`motivation/` is ~194 MB of tracked .mp4 files**, essentially the whole 198 MB `.git`. Move to Git LFS or untrack and ignore.
11. **`.gitignore` contains `*.png`**, which will silently ignore real sprite/art assets and explains why `artifacts/workshop/*.png` behaves oddly. Replace with targeted rules.
12. **`artifacts/workshop/` is untracked** and holds images including two `snapgram.io_*.jpg` files that look like downloaded screenshots. Gitignore or exclude them from commits.
13. **`memory/` (agent notes) is tracked** (`active-task.md`, `checkpoint.md`). Fine if intentional, but it will churn diffs.
14. **Line endings.** Git warns LF will become CRLF. Add a `.gitattributes` to fix the policy.

## D. Testing

15. **`npm test` runs only `tests/assets.test.mjs`.** The browser tests (`scene`, `world`, `performance`) are not wired into any script or CI, so nothing guards COLL-01 (collision), RENDER-01/02 (artifacts, flicker) or the scroll-blit change.

## E. Open product issues (from `ISSUES.md`, unverified by me)

Priority P0, suggested order: RENDER-02 (stable sampling/flicker) first, then COLL-01 (mouse movement through trees), then PERF-01 (slow zoomed-out rendering). Fixing flicker and artifacts first makes the perf numbers meaningful. Also open: VIS-01 (player readability), RENDER-01 (black bands). P1: CHAR-01, ANIM-01, RIDE-01, SIM-01, GRASS-01, WATER-01, UI-01 (title/pause screens), UI-02 (minimap).

## Suggested next steps

1. Determine the live render path and delete the dead one.
2. Move `motivation/` out of git; fix the `*.png` ignore rule; add `.gitattributes`.
3. Add a pixel-equality test for the scroll path, clean up items A1-A5, then commit.
4. Wire browser tests into `package.json` scripts.
5. Work through P0 issues in the order above.
