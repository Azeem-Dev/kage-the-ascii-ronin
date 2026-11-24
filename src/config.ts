// ============================================================================
// KAGE: The ASCII Ronin — Configuration & Tunables
// Calibrated for 100% isotropic 16:9 geometry without vertical funhouse distortion
// ============================================================================

export interface GridDensityConfig {
  name: string;
  cols: number;
  rows: number;
}

export const CONFIG = {
  // Target display & canvas
  display: {
    targetFps: 60,
    aspectRatio: 16 / 9,
    fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
    fontSize: 12,
    cellWidth: 9,
    cellHeight: 14,
    defaultDensity: 'high' as 'low' | 'medium' | 'high',
    densities: {
      low: { name: 'Low (140x50)', cols: 140, rows: 50 },
      medium: { name: 'Medium (170x61)', cols: 170, rows: 61 },
      high: { name: 'High (200x72)', cols: 200, rows: 72 },
    } as Record<'low' | 'medium' | 'high', GridDensityConfig>,
  },

  // Two-stage renderer pipeline settings
  render: {
    // Hidden scene buffer dimensions (400x224 px = 16:9)
    sceneWidth: 400,
    sceneHeight: 224,
    bufferScale: 2,
    
    // Sobel edge detection threshold on physical geometry (0-255)
    edgeThreshold: 28,
    
    // Color saturation & brightness boost for the glowing ASCII terminal look
    saturationBoost: 1.25,
    brightnessBoost: 1.15,
    
    // Background cell tint opacity (gives subtle CRT phosphor glow)
    cellBgOpacity: 0.14,
    
    // Quantized color palette resolution: 4 levels per channel (4x4x4 = 64 colors)
    paletteLevels: [18, 75, 160, 255],
    
    // Ramps available for cycling with F4
    activeRampIndex: 0,
    ramps: [
      {
        name: 'Standard Feudal',
        chars: ' .,:;-=+*cxoO#%@',
      },
      {
        name: 'Detailed Density',
        chars: ' .\'`^",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
      },
      {
        name: 'Samurai Minimalist',
        chars: ' .·:+=*#@',
      },
      {
        name: 'Retro Blocks',
        chars: ' ░▒▓█',
      },
    ],

    // Directional edge glyphs (Sobel angle mapped)
    directionalGlyphs: {
      horizontal: '—',
      vertical: '|',
      diagonalUpRight: '/',   // 45 deg slope
      diagonalUpLeft: '\\',   // 135 deg slope
    },
  },

  // Feudal Japan night atmosphere colors
  palette: {
    skyTop: '#040814',
    skyBottom: '#0b1626',
    moon: '#e8f4fc',
    moonGlow: '#426892',
    lanternWarm: '#ff9922',
    lanternCore: '#fff2bb',
    shojiLit: '#f8d27a',
    toriiRed: '#b8201a',
    pineFoliage: '#142f26',
    pineBark: '#261b14',
    roofTiles: '#1c2936',
    woodPlanks: '#3b2c22',
    stoneGround: '#1e242c',
    grassDark: '#12221c',
  },

  // Debug keys and overlay toggles
  debug: {
    showSceneBuffer: false,   // F1
    showMaterialBuffer: false,// F2
    showStats: true,          // F3
  },
};
