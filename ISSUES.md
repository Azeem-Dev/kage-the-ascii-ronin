# KAGE - Open Issues and Quality Gaps

Updated: 2026-11-24.

This backlog records the user's latest feedback and screenshots. All items below
are open. It is not a claim that every reported defect was reproduced during this
documentation update. Existing implementations and previously passing tests do
not establish acceptable visual quality or resolve later user reports.

The goal is a cohesive, playable ASCII open world matching the visual qualities
of the videos in [motivation/](motivation/), with reusable assets underneath.
Review progress in the running game and conversation. Do not add an approval app.

## P0 - Fix the foundations first

### VIS-01 - Player disappears into the environment
- **Reported:** the player is difficult to locate against grass, trees and effects.
  The problem occurs in both bright and dark surroundings, particularly zoomed out.
- **Needed:** a readable silhouette and clear player identity under changing light,
  without flattening the armor into a uniformly bright shape. Handle vegetation
  occlusion deliberately; preserve meaningful building depth.
- **Acceptance:** the player is immediately identifiable while stationary, moving,
  riding and partly behind foliage, across all playable appearances, day/night
  and supported zoom levels. Verify on busy and bright backgrounds as well as dark ones.

### PERF-01 - Slow gameplay and zoomed-out rendering
- **Reported:** the game still feels slow, especially at distant zoom and while moving.
- **Needed:** profile the current populated scene on the user's actual viewing
  conditions; address frame-time spikes as well as average FPS. Preserve scene content.
- **Acceptance:** record idle, walking, riding, zoom transitions and storm-weather
  measurements at 1920x1080 or the actual user viewport. Target sustained 60 FPS;
  report average, p95 and worst frame times and any settings that miss the target.
- **Evidence caveat:** an earlier headless test measured about 57 FPS after fixes.
  That historical result does not invalidate the user's subsequent slowdown reports.

### COLL-01 - Mouse movement can pass through trees
- **Reported:** clicking to move allows the player to pass through trees.
- **Needed:** reproduce through mouse/tap, keyboard and mounted movement. Check
  visual trunk placement against collision geometry, not just numerical circle tests.
- **Acceptance:** all input methods obey the same obstacles; running/riding cannot
  tunnel through trunks; glancing contacts slide naturally. Grass/flowers remain
  nonblocking. Doorways and arches have appropriate openings.

### RENDER-01 - Black horizontal bands and visible drawing artifacts
- **Reported:** straight black lines/bands cut across the environment and characters.
- **Investigation:** inspect glyph backgrounds, shadows, sprite transparency,
  row boundaries, compositing and dirty-cell updates. The cause is not yet established.
- **Acceptance:** no unexplained rectangular bands, seams or trails at rest,
  during movement, after zoom changes or after pausing/resuming.

### RENDER-02 - Flickering and unstable scene detail
- **Reported:** excessive flickering and changing detail make the world uncomfortable
  to watch. Trees were also reported disappearing/reappearing through zoom changes.
- **Needed:** stable world sampling and instance placement, coherent level of detail,
  and animation that moves features rather than randomly replacing large regions.
- **Acceptance:** camera and zoom round-trips preserve the same trees/landmarks;
  stationary terrain stays stable; only intended animation changes. Do not hide trees
  to increase FPS.

## P1 - Character, riding and environmental animation

### CHAR-01 - Other character assets fall below the knight's quality
- **Latest feedback:** the knight looks good relative to the other playable characters;
  catfolk, vampire and dwarf appearances still look poor or blend into the scenery.
- **Needed:** improve anatomy, faces, material shading, silhouettes and detail density
  while maintaining a consistent game scale. Preserve the knight as a quality baseline.
- **Acceptance:** every playable appearance reads clearly at normal gameplay size
  and remains recognizable at close and distant zoom, in daylight and darkness.

### ANIM-01 - Walking lacks convincing body mechanics
- **Reported:** the player appears to slide or move as a largely static image.
- **Needed:** clear alternating leg movement, planted feet, weight transfer, arm motion,
  turns and distinct idle/walk/run states. Basic image deformation is insufficient.
- **Acceptance:** watch complete movement cycles in several directions; check foot
  contact, limb attachment, clipping and transitions at multiple speeds/zoom levels.

### RIDE-01 - Horse anatomy, seated pose and directional riding
- **Reported:** early horse artwork looked unlike a convincing horse. The rider
  appears upright/standing or incorrectly attached; straight riding is not represented
  properly by the current visual orientation.
- **Needed:** a proportioned horse, saddle attachment, seated rider with bent legs,
  coordinated gait and appropriate north/south/east/west views and turns.
- **Acceptance:** riding straight in each direction looks correct; rider and saddle
  remain aligned through gait, turns, mounting and dismounting. No standing figure
  floating above the horse. Recheck the replacement artwork in motion.

### SIM-01 - Wind, cloth and hair lack convincing behavior
- **Reported:** wind/cloth/hair simulation is absent or not visually convincing.
- **Needed:** a shared wind field; anchored cloth/hair response with lag, damping
  and recovery; motion influenced by movement and weather rather than unrelated sine offsets.
- **Acceptance:** capes, hair and foliage respond coherently to gusts and movement
  without detachment, jitter or synchronized whole-scene flicker. State clearly
  whether a system is simulated or only a visual animation.

### GRASS-01 - Grass looks repetitive and reacts poorly
- **Reported:** grass animation remains poor and the world resembles a uniform texture.
- **Needed:** varied clumps, blade height, density, bare ground, paths and clearings;
  coherent wind and localized bending around feet/hooves with gradual recovery.
- **Acceptance:** movement visibly parts nearby vegetation without drawing artificial
  stripes or growing grass on bare paths. Distant grass stays stable and affordable.

### WATER-01 - Water does not convincingly flow
- **Reported:** changing glyph patterns and dots do not read as a moving current.
- **Needed:** clear downstream advection, curved flow around rocks, foam trails,
  ripples, wakes and bank transitions. Preserve dark depth and selective highlights.
- **Acceptance:** direction and speed are apparent in a short video, not only a
  screenshot. Rocks and moving bodies disturb the current; ripples expand and fade.
  Describe analytic effects accurately; do not claim a fluid solver without one.

## P1 - Game framework and navigation

### UI-01 - Missing ASCII title/opening and pause screens
- **Reported:** the application does not feel like a game; there is no proper opening
  screen or pause modal rendered in the ASCII style.
- **Needed:** an ASCII title/start screen and a clear pause screen with resume,
  restart and relevant settings. A pause flag alone is not a pause screen.
- **Acceptance:** start/resume works with keyboard and pointer; menus capture input;
  movement and simulation stop while paused and resume without a large time jump.

### UI-02 - No minimap or usable world orientation
- **Requested:** a minimap showing the player, explored terrain and useful landmarks.
- **Acceptance:** it follows position/direction, respects scale, identifies nearby
  destinations and stays readable without covering gameplay. It must remain inexpensive.

### ENGINE-01 - Advance the reusable game framework
- **Needed:** separate world state, fixed-step simulation, input, rendering, animation,
  collision, weather, lighting and menus into reusable systems. Avoid accumulating
  scene-specific patches in one controller.
- **Acceptance:** assets and systems can be reused in another region; input does not
  bypass simulation/collision; pause and timing are consistent; caches and streaming
  have bounded memory. Verify changes with behavior-focused tests and actual gameplay.

## P2 - World, lighting and content expansion

### LIGHT-01 - Sun/moon cycle is not visible or convincing
- **Reported:** the user cannot see a meaningful sun/moon progression.
- **Needed:** an understandable time-of-day cycle with dawn/day/dusk/night, sunlight,
  moonlight, environmental color changes and local light sources.
- **Acceptance:** transitions visibly affect the world while the player stays readable.
  Controls to change/pause time work. A global brightness change alone is insufficient.

### LIGHT-02 - No convincing material lighting/shader treatment
- **Reported:** surfaces lack the advanced shading seen in the references.
- **Needed:** coherent Canvas 2D/CPU material lighting, depth cues, contact shadows,
  controlled highlights and atmospheric effects. Keep the existing no-WebGL constraint.
- **Acceptance:** stone, armor, cloth, vegetation and water read differently; light
  reveals form rather than washing out glyphs or creating black rectangular patches.

### WORLD-01 - World lacks varied terrain and authored composition
- **Requested:** hills, mountains, towers, caves, random open spaces, paths and distinct
  places. Current repeating ground does not meet the reference quality.
- **Needed:** regions with recognizable silhouettes, relief, landmarks, negative space,
  sightlines and consistent elevation/traversal data.
- **Acceptance:** regions are distinguishable without their labels. Heights and stairs
  affect traversal where presented as playable; a tower picture alone is not that system.

### WORLD-02 - Settlements, ruins and light-bearing props
- **Requested:** recognizable tents, medieval houses, broken buildings, torches and
  other believable settlement details. Existing simple props have not satisfied this.
- **Acceptance:** reusable modules form convincing places; torches visibly illuminate
  nearby glyph surfaces and animate coherently. Placement and collision match the artwork.

### ASSET-01 - Expand reusable wildlife, enemies and remains
- **Requested:** parrots, sparrows, crows, vultures, bats, random butterflies, moths/light
  insects, vampires, goblins, orcs and dead bodies/remains.
- **Needed:** distinct silhouettes, palettes, animations, placement rules and reusable
  definitions. Separate ambient wildlife, friendly inhabitants and hostile agents.
- **Acceptance:** visually distinct assets appear naturally in appropriate regions;
  random placement is seeded and repeatable. Static hostile placement is not enemy AI.

### ASSET-02 - Agriculture and vegetation variety
- **Requested:** random tall grass, wheat, rice and other fields, sunflowers, flower
  patches and small blue/pink/purple butterflies.
- **Acceptance:** crop species have distinct structures, colors and density; field
  boundaries/rows and wet rice terrain are recognizable; vegetation respects paths,
  buildings and water. Wind/interaction do not destroy field readability or performance.

### EQUIP-01 - Distinct weapons, armor and character equipment
- **Requested:** different swords, armor sets and playable character types, including
  cat girl/boy, vampire girl/boy and dwarf/neutral appearances.
- **Needed:** refine the existing catalog and add equipment attachment/equipping logic.
- **Acceptance:** weapon and armor changes visibly affect the character and appropriate
  animation; no duplicated baked sword or detached equipment. Display assets alone
  do not constitute an equipment system.

## Reference map

- Horse/anatomy/hair: `motivation/snapgram.io_DfAg2Othm3G.mp4`.
- Flowing water: `motivation/snapgram.io_dsjylai6ml3t.mp4`.
- Tower/grass/elevation: `motivation/snapgram.io_wng8vz6wi6a5.mp4`.
- Cave/props/flowers/light: the `Alongside writing the logic, ...` video.
- Forest/world detail: `Making the ASCII MMORPG of my dreams! ...`.
- Creature detail: `It's amazing how changing the grid ...`.
- Small flying wildlife: `Making my browser beautiful...`.
- Knight materials/silhouette: `The Obsidian Paladin ...`.
- Boss/environment contrast: `motivation/i0asis.mp4`.
- Lighting/composition: lighthouse and power-line reference videos.

Existing implementation context: [asset catalog](artifacts/ASSET_CATALOG.md),
[handoff](artifacts/DEEPSEEK_HANDOFF.md), [phase plan](artifacts/CHATGPT_MASTER_PROMPT.md).
These documents describe foundations, not acceptance of the latest visual results.

## Closure rules

1. Work through P0 before adding more expensive visual systems/content.
2. Reproduce a reported defect before attributing a cause; preserve before/after evidence.
3. Verify each affected input path, character, lighting state and relevant zoom range.
4. Record commands, browser/viewport/settings, performance and short gameplay captures.
5. Distinguish technical checks from the user's visual acceptance. Do not close an
   issue solely because code exists or a build passes.
