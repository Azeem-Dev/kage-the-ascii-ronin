# Source art provenance and final prompt set

Generated with the **built-in image generation tool**, with transparent-background
output requested. These are offline authoring references. The game renders baked
glyph JSON, not the images. Originals remain in the tool's generated-images folder;
the following copies are saved in the project:

- `horse-v2.png`
- `knight-v3.png`
- `catfolk-family.png`
- `vampire-family.png`
- `dwarf-family.png`

Bake command: `python scripts/bake_ascii_art.py` (Pillow). The script samples source
coverage/colors into cells, preserving the original source files. Each family
sheet is sampled as separate left/right variants. The runtime character wrappers
all implement the same `AsciiAsset` contract.

## Horse

Use case: stylized-concept. Asset type: anatomy-correct 2D game horse cutout for
offline conversion to dense colored ASCII glyphs. The supplied hair-physics video
frame is a visual reference only for horse proportions and elevated camera.
Create one riderless pale grey warhorse, full body, facing right in a slightly
elevated three-quarter side view. Correct real horse anatomy: rounded barrel,
powerful hindquarters, sloping muscular neck, long muzzle, small pricked ears,
articulated legs with knees/hocks and four separated dark hooves. Flowing silver
mane and dark tail. Simple leather saddle/bridle, no rider. Detailed hand-painted
fantasy RPG shading, steel-grey shadows, ivory upper-flank highlights, crisp
readable silhouette and a broad tonal range. Whole horse and transparent padding.
No llama/dog/toy/cartoon proportions; no scene, ground plane, text, UI, glyphs,
border, external shadow or particles.

## Knight

Use case: stylized-concept. Asset type: production-quality 2D fantasy RPG knight
source cutout for offline ASCII conversion. Obsidian Paladin contact sheet is mood
reference only, not a source to copy. One full-body dark steel medieval knight
facing diagonally right, elevated three-quarter RPG view, relaxed grounded pose.
Real adult anatomy, broad layered pauldrons, narrow waist, articulated cuirass,
gauntlets, plate thighs/knees/greaves and heavy boots. Closed armet and dark visor
slit with pale silver rim. Weathered charcoal cape, straight longsword/crossguard
held downward diagonally right. Detailed hand-painted tonal shading, near-black
recesses, strong silver highlights, restrained antique-brass trim. Entire figure,
weapon and boots visible with transparent padding. No scene, floor, ground shadow,
halo, particles, text, UI, oversized head, toy style or samurai robes.

## Shared family-sheet specification

Use case: stylized-concept. Transparent 2D fantasy RPG character-variant sheet for
offline dense colored ASCII conversion. Two equal-sized columns with a generous
transparent gap. Same camera/style, facing diagonally right in relaxed standing
poses. Detailed hand-painted fantasy art, strong tonal shading, crisp silhouettes
and cool highlights. Each figure and weapon tip entirely in frame with padding.
No overlapping figures, floor, ground plane, cast ground shadow, halo, particles,
labels, lettering, border, UI or text.

### Catfolk family

Adult female left, adult male right. Human faces, two feline ears, visible long
curved tails, practical layered leather armor, lowered hoods, steel bracers,
sheathed short swords and boots. Female: silver shoulder-length hair, light steel
and midnight-blue leathers. Male: short dark hair, bronze and forest-green
leathers. Distinct feminine/masculine silhouettes, fully clothed, realistic anatomy,
not chibi/cartoon.

### Vampire family

Adult female left, adult male right. Elegant pale vampire nobles, pointed collars,
black/burgundy coats, restrained silver jewelry, fitted boots, short curved blades
at hips and subtle red eyes. Female: long dark hair and tailored long coat. Male:
swept-back dark hair and high-collared cape. Distinct adult silhouettes, realistic
dark fantasy, not cartoon or sexualized clothing.

### Dwarf family

Bearded male left, gender-neutral hooded dwarf right. Short, stocky, broad-shouldered
adult fantasy guardians with powerful proportions, heavy boots and segmented
iron/bronze armor. Male: braided copper beard, open helmet, broad axe downward.
Neutral: closed rounded iron helmet, short dark teal cloak, compact square-headed
hammer downward. Sturdy recognizable dwarf anatomy, not toy figures/cartoons.
