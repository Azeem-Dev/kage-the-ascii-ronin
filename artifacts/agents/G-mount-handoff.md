# Agent G-mount handoff

## Changed

Only these owned files were edited:

- `src/assets/authored.ts`
  - Replaced the horse's lower-body Voronoi split with four cached anatomical leg corridors. Belly/saddle cells stay with the torso and the hanging tail stays with the tail, preventing the inherited doubled/detached-limb artifacts.
  - Added two-joint leg IK. Upper and lower leg pieces rotate rigidly around the hip and transformed knee; the hip follows torso bob while the stance hoof target stays on its contact plane.
  - Added a four-beat walk (quarter-cycle offsets, 70% stance), a grouped gallop (hind pair then fore pair, 40% stance, one all-air suspension), higher gallop stride/lift, and distinct body/head/tail/mane responses.
  - Idle keeps the hooves planted while the torso breathes; head dip, tail swish and neck/mane trail remain active.
  - Narrowed knight cape deformation to a diagonal cloth mask rooted at the shoulders. The previous rectangular mask also moved the left leg and sword arm. Cape motion is stronger when moving and settles to a small idle wave; torso bob/breathing no longer moves the planted lower legs.
  - Preserved `authoredFrame`'s signature, `GlyphArt`, source-cell caching, variant tinting, seed marks, facing mirroring and bounds clamping. `run` is accepted as a runtime alias for `gallop`.
- `src/assets/horse.ts`
  - Bumped the asset to version 3 and updated its description to match the articulated idle/walk/gallop behavior.

No baked art JSON, tests, package files, renderer, scene, catalog, engine or other agents' files were changed. No commit was made.

## Verified

- `npm test` passes: 78 assets / 2,568 standard frames plus all physics tests.
- `npx tsc --noEmit -p .` passes.
- Additional owned-asset validation passes for 2,160 frames across `idle`, `walk`, `gallop` and `run`, all horse/knight variants, three seeds, both facings and multiple times. Bounds, glyph/color validity, determinism, seed/variant changes and exact facing mirroring all pass.
- A 1,440-sample-per-gait IK sweep found four stable leg owners and exact sampled hoof-target solutions:
  - Walk maximum target error: `3.18e-14`; no all-air samples.
  - Gallop maximum target error: `4.02e-14`; 172 all-air suspension samples.
  - Every leg's stance target Y remained fixed at its baked contact row; swing clearance peaked at 4.14 authored cells for walk and 8.28 for gallop.
- In-game smoke check at `?area=outskirts`, default 0.8x: `E` successfully mounted the knight on the horse. Shift movement was exercised, but the scene currently supplies `walk`, not `gallop`.

## Remains / Claude integration

- `src/riverScene.ts` currently passes only `walk`/`idle`. When mounted and moving, pass `gallop` while Shift is held and `walk` otherwise. The mounted rider is also forced to `idle`; pass the moving action to the rider so the cape trails while mounted.
- `AssetOptions.action` in `src/assets/types.ts` is still typed as only `'idle' | 'walk'`; widen it for `gallop` (or cast at the scene call site). The animation already handles the runtime string.
- Finish the visual acceptance pass at 1.8x and with real Shift-gallop after the scene action is wired. Repeated Vite HMR reloads from parallel streams interrupted the zoomed in-game check, so it is not claimed as complete.
- Contact planting is exact in asset-local space. Because the asset API receives time but no world velocity/distance, true world-space no-slide locking would require a distance-linked gait phase from the engine; the current scene's time-only gait will slide relative to fast world movement.

## Foreign failures

None in the final runs. Earlier transient failures (`sparrow does not animate` in Agent F's birds and `riverWidth` missing in Agent H's world chunks) were observed but not edited; both cleared before the final passing runs.
