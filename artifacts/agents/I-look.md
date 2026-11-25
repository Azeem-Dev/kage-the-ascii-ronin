# Agent I — calm, readable ASCII look

You own `src/proof/ascii.ts` and new files under `src/proof/look/**`. Read
`artifacts/agents/README.md` (round 3) and `artifacts/CLAUDE_MASTER_PROMPT.md` first, then look
at `artifacts/preview/motivation-review/*.jpg` and `artifacts/preview/proof_ascii.png`.

The owner's words about the current pass: **"I feel like I am going to vomit, but this is very
much better than our previous game."** Your job is to remove the nausea and keep everything
else that is good (black world, lit models, warm lamp light, readable silhouettes).

## What is wrong now (measured / seen on screen)
- The ramp `' .\'`,:;-~+=*ixnoesCOQ#%@'` contains letters → letter soup in busy areas.
- Edges come from the luminance gradient between cells, so they fire inside grass and foliage
  → `|/-\` confetti everywhere.
- Colour is `col / max(channel)` → dim cells become fully saturated rainbow dots.
- One ramp for everything → grass, roofs, trees, stone all look the same; foliage becomes
  repeating `+=+=` columns.
- Thin geometry (blades, leaves) flips glyphs while walking. Claude already made the scene
  target exactly 2×2 texels per cell and snaps the ortho cameras to whole cells (keep both!):
  pixels changing per frame went 16% → 10.7% walking, 0.72% → 0.34% standing still.
- Three views now (V): isometric, top-down, third-person (perspective, smooth, not snapped —
  it needs your temporal stability most). N toggles day/night; the day sky becomes a wall of
  glyphs — sky and flat bright areas need a calm treatment too.
- The owner felt **dizzy** walking: "with movement grass changes and stuff".

## Do this, in order, checking the screen after each step
1. **Symbol-only glyph sets.** No letters at default zoom. Start from e.g.
   `' .,:;-~=+*#%@'` style ramps; pick glyphs by their measured ink coverage (rasterise each
   glyph once, sort by pixel count) so density steps are even.
2. **Colour follows light.** Saturation and brightness rise with luminance; dim cells are dark
   and nearly grey/cool; only lit things carry colour. Warm light stays warm. Keep the near-black
   background — most of the screen should be black.
3. **Edges from geometry, not noise.** Render depth (and if needed normals) — e.g. a second
   pass with `MeshDepthMaterial`/`MeshNormalMaterial` via `scene.overrideMaterial` into its own
   target, or a depth texture on the scene target — and draw edge glyphs only where depth or
   normal jumps (silhouettes, roof lines, wall corners). No edge glyphs inside grass or leaves.
4. **Per-category glyph sets.** Meshes carry `mesh.userData.look` = one of
   `'foliage' | 'grass' | 'stone' | 'wood' | 'roof' | 'cloth' | 'skin' | 'metal' | 'water' |
   'light' | 'ground'` (Agents J and K tag their meshes; untagged = default). Render a category
   ID target (override material writing a flat ID colour, or `layers`) and choose the glyph set
   and colour treatment per category: grass = `| / \ '` strokes; foliage = soft `" ' , .` clumps;
   stone/roof = calm fills; light = bright `* +`; etc. Export the category names from
   `src/proof/look/categories.ts` so J and K import them.
5. **Temporal stability.** Keep the previous frame's glyph index (ping-pong render target) and
   only switch a cell's glyph when its value moves past a hysteresis margin. Static scenery must
   not flicker; moving things may change.
6. **One subject.** The hero must be the brightest, cleanest thing on screen. Use category or
   a `userData.subject = true` flag (Agent K sets it) to give the hero a rim/brightness boost
   and a clean glyph set, and keep the rest of the scene a step darker around it.
7. **Performance.** Every added target costs a scene render; keep the extra passes cheap
   (half resolution, override materials, no shadows in ID/depth passes). Target ≥ 55 FPS at
   1920×1080 on the Iris Xe while walking.

## Acceptance (put the numbers in your hand-off)
- No letters a–z/A–Z visible at default zoom (Tab off/on comparison screenshot).
- Standing still: < 1% of pixels change per frame. Walking: report the number (it was 16%).
- FPS at 1920×1080 walking, measured with the GPU flags.
- Screenshots: default zoom, zoomed in, zoomed out, before vs after, in `artifacts/agents/I-shots/`.
- Keep the `AsciiPass` interface unchanged (`main.ts` uses it). If you need a new method, ask
  in your hand-off.
