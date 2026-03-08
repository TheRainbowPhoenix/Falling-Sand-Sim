// main.js - JS port of Falling Sand Simulator

// --- Constants & Config ---

// Screen dimensions
const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 528; // Updated based on requirements

// Simulation grid dimensions
const GRID_WIDTH = 160;
const GRID_HEIGHT = 264; // SCREEN_HEIGHT / 2
const PIXEL_SIZE = 2; // Each cell is 2x2 pixels

// Particle types
const Particle = {
  AIR: 0,
  SAND: 1,
  WATER: 2,
  STONE: 3,
  WALL: 4,
  LAVA: 5,
  PLANT: 6,
  ICE: 7,
  STEAM: 8,
  ACID: 9,
  FIRE: 10,
  COUNT: 11
};

// Color definitions (RGB565 format)
const COLOR_AIR = 0x0000;
const COLOR_SAND = 0xFDA0;
const COLOR_WATER = 0x03BF;
const COLOR_STONE = 0x7BEF;
const COLOR_WALL = 0x4208;
const COLOR_LAVA = 0xF800;
const COLOR_PLANT = 0x07E0;
const COLOR_ICE = 0xAFFF;
const COLOR_UI_AIR = 0xF81F;
const COLOR_STEAM = 0xEF7D;
const COLOR_ACID = 0x8FE0;
const COLOR_FIRE = 0xFA00;
const COLOR_HIGHLIGHT = 0xFFFF;

// Brush size
const BRUSH_SIZE_DEFAULT = 3;
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 9;

// UI constants
const UI_HEIGHT = 16;
const SWATCH_SIZE = 16;
const SWATCH_SPACING = 18;
const UI_START_X = 10;
const PARTICLE_TYPE_COUNT = Particle.COUNT;

// Grid UI boundary
const GRID_UI_BOUNDARY = Math.floor((SCREEN_HEIGHT - UI_HEIGHT) / PIXEL_SIZE);

// Brush size slider layout
const BRUSH_SLIDER_DIGIT_X = 208;
const BRUSH_SLIDER_TRACK_X = 218;
const BRUSH_SLIDER_TRACK_W = 40;
const BRUSH_SLIDER_HANDLE_W = 6;

// Sim speed modes
const SIM_SPEED_MODE_DEFAULT = 0;
const SIM_SPEED_MODE_MAX = 4;
const simSpeedModeNames = ["NORMAL", "X2", "X3", "X5", "X9"];
const simSkipAmounts = [0, 1, 2, 4, 8];

// Simulation probabilities
const LAVA_FLOW_CHANCE = 4;
const PLANT_GROWTH_CHANCE = 8;
const PLANT_GROWTH_ATTEMPTS = 4;

// FPS counter constants
const FPS_SAMPLE_COUNT = 30;
const FPS_DISPLAY_X = 248;
const FPS_DISPLAY_Y = 2;

// Fall speeds
const FALL_SPEED_STONE = 1;
const FALL_SPEED_SAND = 2;
const FALL_SPEED_WATER = 1;
const FALL_SPEED_LAVA = 2;
const FALL_SPEED_ICE = 2;
const FALL_SPEED_STEAM = 2;
const FALL_SPEED_ACID = 1;
const FALL_SPEED_FIRE = 2;

const ACID_DISSOLVE_MASK = 0x3;
const ACID_CONSUME_MASK = 0x3;
const TEMP_STEAM = 210;
const TEMP_STEAM_CONDENSE = 80;
const STEAM_CONDENSE_MASK = 0x7;
const TEMP_FIRE = 220;
const FIRE_BURNOUT_MASK = 0xF;
const FIRE_SPREAD_MASK = 0x7;

// Coarse temperature grid
const TEMP_SCALE = 4;
const TEMP_GRID_W = Math.floor(GRID_WIDTH / TEMP_SCALE);
const TEMP_GRID_H = Math.floor(GRID_HEIGHT / TEMP_SCALE);

// Temperature constants
const TEMP_AMBIENT = 50;
const TEMP_COLD = 20;
const TEMP_HOT = 200;
const TEMP_LAVA = 255;
const TEMP_ICE_SURFACE = 5;
const TEMP_FREEZE_WATER = 12;
const TEMP_ICE_MELT = 65;
const TEMP_WATER_COOL_RATE = 3;
const TEMP_BURIED_COOL_MASK = 0xF;
const TEMP_LAVA_SOLIDIFY = 110;
const TEMP_STONE_MELT = 230;
const TEMP_DIFFUSION_PASSES = 4;
const TEMP_UI_COARSE_ROW = Math.floor(((SCREEN_HEIGHT - UI_HEIGHT) / PIXEL_SIZE) / TEMP_SCALE);

// Ordered UI particles
const PARTICLE_UI_ORDER = [
  Particle.SAND,
  Particle.WATER,
  Particle.STONE,
  Particle.WALL,
  Particle.LAVA,
  Particle.FIRE,
  Particle.PLANT,
  Particle.ICE,
  Particle.STEAM,
  Particle.ACID,
  Particle.AIR
];

function getParticleColor(p) {
  switch (p) {
    case Particle.SAND:  return COLOR_SAND;
    case Particle.WATER: return COLOR_WATER;
    case Particle.STONE: return COLOR_STONE;
    case Particle.WALL:  return COLOR_WALL;
    case Particle.LAVA:  return COLOR_LAVA;
    case Particle.PLANT: return COLOR_PLANT;
    case Particle.ICE:   return COLOR_ICE;
    case Particle.STEAM: return COLOR_STEAM;
    case Particle.ACID:  return COLOR_ACID;
    case Particle.FIRE:  return COLOR_FIRE;
    default: return COLOR_AIR;
  }
}

function getFallSpeed(p) {
  switch (p) {
    case Particle.STONE: return FALL_SPEED_STONE;
    case Particle.SAND:  return FALL_SPEED_SAND;
    case Particle.WATER: return FALL_SPEED_WATER;
    case Particle.LAVA:  return FALL_SPEED_LAVA;
    case Particle.ICE:   return FALL_SPEED_ICE;
    case Particle.STEAM: return FALL_SPEED_STEAM;
    case Particle.ACID:  return FALL_SPEED_ACID;
    case Particle.FIRE:  return FALL_SPEED_FIRE;
    default: return 1;
  }
}

function getParticleTemperature(p) {
  switch (p) {
    case Particle.LAVA: return TEMP_LAVA;
    case Particle.WATER: return TEMP_COLD;
    case Particle.SAND: return TEMP_AMBIENT;
    case Particle.STONE: return TEMP_AMBIENT;
    case Particle.WALL: return TEMP_AMBIENT;
    case Particle.PLANT: return TEMP_AMBIENT;
    case Particle.ICE:   return TEMP_ICE_SURFACE;
    case Particle.STEAM: return TEMP_STEAM;
    case Particle.ACID:  return TEMP_AMBIENT;
    case Particle.FIRE:  return TEMP_FIRE;
    case Particle.AIR:   return TEMP_AMBIENT;
    default: return TEMP_AMBIENT;
  }
}

function getParticleColorVaried(p, x, y) {
  let base = getParticleColor(p);
  if (p === Particle.AIR || p === Particle.WALL || p === Particle.ICE) return base;
  let v = ((x * 3) ^ (y * 7)) & 0xFF;
  return base ^ ((v & 0x3) << 5);
}

const tempPalette = new Uint16Array([
  0x001E, 0x001C, 0x0018, 0x0012, 0x000C, 0x0006, 0x0002, 0x0000,
  0x1000, 0x2800, 0x4000, 0x6000, 0x8000, 0xA000, 0xC000, 0xE000,
  0xF880, 0xF940, 0xFA40, 0xFB40, 0xFC40, 0xFD40, 0xFE40, 0xFF40,
  0xFFE0, 0xFFE4, 0xFFE8, 0xFFEE, 0xFFF4, 0xFFFA, 0xFFED, 0xFFFF
]);

function tempToColor(t) {
  return tempPalette[t >> 3];
}

// --- Grid & State ---

const UPDATED_WORDS = Math.ceil(GRID_WIDTH / 32);

// We use 1D arrays for performance, mapping (x, y) to y * width + x
const grid = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
const updated = new Uint32Array(UPDATED_WORDS * GRID_HEIGHT);
const dirty = new Uint32Array(UPDATED_WORDS * GRID_HEIGHT);
const temperature = new Uint8Array(TEMP_GRID_W * TEMP_GRID_H);

function getGrid(x, y) {
  return grid[y * GRID_WIDTH + x];
}

function setGrid(x, y, p) {
  grid[y * GRID_WIDTH + x] = p;
}

function tempGet(x, y) {
  return temperature[Math.floor(y / TEMP_SCALE) * TEMP_GRID_W + Math.floor(x / TEMP_SCALE)];
}

function tempSet(x, y, val) {
  temperature[Math.floor(y / TEMP_SCALE) * TEMP_GRID_W + Math.floor(x / TEMP_SCALE)] = val;
}

function updatedGet(x, y) {
  return (updated[y * UPDATED_WORDS + (x >> 5)] >> (x & 31)) & 1;
}

function updatedSet(x, y) {
  updated[y * UPDATED_WORDS + (x >> 5)] |= (1 << (x & 31));
}

function dirtyGet(x, y) {
  return (dirty[y * UPDATED_WORDS + (x >> 5)] >> (x & 31)) & 1;
}

function dirtySet(x, y) {
  dirty[y * UPDATED_WORDS + (x >> 5)] |= (1 << (x & 31));
}

function initGrid() {
  updated.fill(0);
  dirty.fill(0xFFFFFFFF); // force full repaint after clear
  temperature.fill(TEMP_AMBIENT);
  grid.fill(Particle.AIR);

  // Create bottom wall
  for (let x = 0; x < GRID_WIDTH; x++) {
    setGrid(x, GRID_UI_BOUNDARY - 1, Particle.WALL);
  }
}

function isValid(x, y) {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

function isEmpty(x, y) {
  return isValid(x, y) && getGrid(x, y) === Particle.AIR;
}

function canMoveTo(x, y, type) {
  if (!isValid(x, y)) return false;
  if (y >= GRID_UI_BOUNDARY) return false;

  let target = getGrid(x, y);
  if (target === Particle.AIR) return true;
  if ((type === Particle.SAND || type === Particle.ICE) && target === Particle.WATER) return true;

  return false;
}

function swap(x1, y1, x2, y2) {
  let temp = getGrid(x1, y1);
  setGrid(x1, y1, getGrid(x2, y2));
  setGrid(x2, y2, temp);
}


// --- VRAM and Canvas Rendering ---

const vram = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
let canvas, ctx, imageData, buf32;

function initRenderer(width, height) {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  imageData = ctx.createImageData(width, height);
  buf32 = new Uint32Array(imageData.data.buffer);
}

function flushVRAM() {
  for (let i = 0; i < vram.length; i++) {
    const p = vram[i];

    // Extract RGB565 and expand to 8-bit per channel
    // R is 5 bits: (p >> 11) & 0x1F. Scale by (255/31)
    // G is 6 bits: (p >> 5) & 0x3F. Scale by (255/63)
    // B is 5 bits: p & 0x1F. Scale by (255/31)

    const r5 = (p >> 11) & 0x1F;
    const g6 = (p >> 5) & 0x3F;
    const b5 = p & 0x1F;

    const r = (r5 * 255) / 31 | 0;
    const g = (g6 * 255) / 63 | 0;
    const b = (b5 * 255) / 31 | 0;

    // ImageData buffer is usually ABGR in little-endian (or RGBA depending on endianness)
    // Actually, on Uint32Array mapping over ImageData.data:
    // It's [R, G, B, A] in memory, so if little-endian:
    // A << 24 | B << 16 | G << 8 | R
    buf32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  ctx.putImageData(imageData, 0, 0);
}


function renderVRAM() {
  const isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;

  for (let i = 0; i < vram.length; i++) {
    const p = vram[i];

    const r5 = (p >> 11) & 0x1F;
    const g6 = (p >> 5) & 0x3F;
    const b5 = p & 0x1F;

    // Convert 565 to 888 correctly
    const r = (r5 * 255) / 31 | 0;
    const g = (g6 * 255) / 63 | 0;
    const b = (b5 * 255) / 31 | 0;

    if (isLittleEndian) {
      // ABGR order for little-endian
      buf32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    } else {
      // RGBA order for big-endian
      buf32[i] = (r << 24) | (g << 16) | (b << 8) | 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}


// --- Random Number Generator ---

let xorshift_state = 0x12345678;

function xorshift32() {
  let x = xorshift_state;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  xorshift_state = x >>> 0;
  return xorshift_state;
}

// --- Physics Engine ---

function shouldUpdate(p) {
  let fallSpeed = getFallSpeed(p);
  if (fallSpeed <= 1) return true;
  return (xorshift32() & (fallSpeed - 1)) === 0;
}

function propagateTemperature() {
  for (let pass = 0; pass < TEMP_DIFFUSION_PASSES; pass++) {
    for (let cy = 0; cy < TEMP_GRID_H; cy++) {
      for (let cx = 0; cx < TEMP_GRID_W; cx++) {
        let t = temperature[cy * TEMP_GRID_W + cx];
        let tL = (cx > 0) ? temperature[cy * TEMP_GRID_W + (cx - 1)] : t;
        let tR = (cx < TEMP_GRID_W - 1) ? temperature[cy * TEMP_GRID_W + (cx + 1)] : t;
        let tU = (cy > 0) ? temperature[(cy - 1) * TEMP_GRID_W + cx] : t;
        let tD = (cy < TEMP_GRID_H - 1) ? temperature[(cy + 1) * TEMP_GRID_W + cx] : t;
        temperature[cy * TEMP_GRID_W + cx] = ((t << 2) + tL + tR + tU + tD) >> 3;
      }
    }
  }

  for (let cy = 0; cy < TEMP_UI_COARSE_ROW; cy++) {
    for (let cx = 0; cx < TEMP_GRID_W; cx++) {
      let fineX0 = cx * TEMP_SCALE;
      let fineY0 = cy * TEMP_SCALE;
      let hasLava = false, hasFire = false, hasWater = false, hasIce = false;
      let wallCount = 0, airCount = 0;

      for (let dy = 0; dy < TEMP_SCALE; dy++) {
        for (let dx = 0; dx < TEMP_SCALE; dx++) {
          let p = getGrid(fineX0 + dx, fineY0 + dy);
          if (p === Particle.LAVA) hasLava = true;
          else if (p === Particle.FIRE) hasFire = true;
          else if (p === Particle.ICE) hasIce = true;
          else if (p === Particle.WALL) wallCount++;
          else if (p === Particle.WATER) hasWater = true;
          else if (p === Particle.AIR) airCount++;
        }
      }

      const allWall = (wallCount === TEMP_SCALE * TEMP_SCALE);
      if (hasLava) {
        temperature[cy * TEMP_GRID_W + cx] = TEMP_LAVA;
      } else if (hasFire) {
        let t = temperature[cy * TEMP_GRID_W + cx];
        if (t < TEMP_FIRE) t += 4;
        if (t > TEMP_FIRE) t = TEMP_FIRE;
        temperature[cy * TEMP_GRID_W + cx] = t;
      } else if (allWall) {
        temperature[cy * TEMP_GRID_W + cx] = TEMP_AMBIENT;
      } else if (hasIce) {
        temperature[cy * TEMP_GRID_W + cx] = TEMP_ICE_SURFACE;
      } else {
        let t = temperature[cy * TEMP_GRID_W + cx];
        if (hasWater) {
          t -= TEMP_WATER_COOL_RATE;
          if (t < TEMP_COLD) t = TEMP_COLD;
        } else if (airCount > 0) {
          if (t > TEMP_AMBIENT) t--;
          else if (t < TEMP_AMBIENT) t++;
        } else {
          if (t !== TEMP_AMBIENT && (xorshift32() & TEMP_BURIED_COOL_MASK) === 0) {
            if (t > TEMP_AMBIENT) t--;
            else t++;
          }
        }
        temperature[cy * TEMP_GRID_W + cx] = t;
      }
    }
  }

  for (let cy = TEMP_UI_COARSE_ROW; cy < TEMP_GRID_H; cy++) {
    for (let cx = 0; cx < TEMP_GRID_W; cx++) {
      temperature[cy * TEMP_GRID_W + cx] = TEMP_AMBIENT;
    }
  }
}

function updateSand(x, y) {
  if (tempGet(x, y) >= TEMP_HOT && (xorshift32() & 0xF) === 0) {
    setGrid(x, y, Particle.STONE);
    tempSet(x, y, TEMP_AMBIENT);
    return;
  }

  if (canMoveTo(x, y + 1, Particle.SAND)) {
    swap(x, y, x, y + 1);
    updatedSet(x, y);
    updatedSet(x, y + 1);
  } else {
    let tryLeftFirst = (xorshift32() & 1) === 0;
    let d1 = tryLeftFirst ? -1 : 1;
    let d2 = -d1;
    if (canMoveTo(x + d1, y + 1, Particle.SAND)) {
      swap(x, y, x + d1, y + 1);
      updatedSet(x, y);
      updatedSet(x + d1, y + 1);
    } else if (canMoveTo(x + d2, y + 1, Particle.SAND)) {
      swap(x, y, x + d2, y + 1);
      updatedSet(x, y);
      updatedSet(x + d2, y + 1);
    }
  }
}

function updateWater(x, y) {
  if (tempGet(x, y) <= TEMP_FREEZE_WATER && (xorshift32() & 0x3) === 0) {
    setGrid(x, y, Particle.ICE);
    tempSet(x, y, TEMP_ICE_SURFACE);
    return;
  }

  if (tempGet(x, y) >= TEMP_HOT && (xorshift32() & 0x7) === 0) {
    setGrid(x, y, Particle.STEAM);
    tempSet(x, y, TEMP_STEAM);
    return;
  }

  if (isEmpty(x, y + 1)) {
    swap(x, y, x, y + 1);
    updatedSet(x, y);
    updatedSet(x, y + 1);
    return;
  }

  let tryLeftFirst = (xorshift32() & 1) === 0;
  let d1 = tryLeftFirst ? -1 : 1;
  let d2 = -d1;
  if (isEmpty(x + d1, y + 1)) {
    swap(x, y, x + d1, y + 1);
    updatedSet(x, y);
    updatedSet(x + d1, y + 1);
    return;
  }
  if (isEmpty(x + d2, y + 1)) {
    swap(x, y, x + d2, y + 1);
    updatedSet(x, y);
    updatedSet(x + d2, y + 1);
    return;
  }

  tryLeftFirst = (xorshift32() & 1) === 0;
  let dir1 = tryLeftFirst ? -1 : 1;
  let dir2 = -dir1;

  if (isEmpty(x + dir1, y)) {
    swap(x, y, x + dir1, y);
    updatedSet(x, y);
    updatedSet(x + dir1, y);
  } else if (isEmpty(x + dir2, y)) {
    swap(x, y, x + dir2, y);
    updatedSet(x, y);
    updatedSet(x + dir2, y);
  }
}

function updateStone(x, y) {
  if (tempGet(x, y) >= TEMP_STONE_MELT && (xorshift32() & 0x1F) === 0) {
    setGrid(x, y, Particle.LAVA);
    tempSet(x, y, TEMP_LAVA);
    return;
  }

  if (isEmpty(x, y + 1)) {
    swap(x, y, x, y + 1);
    updatedSet(x, y);
    updatedSet(x, y + 1);
  }
}

function updateIce(x, y) {
  if (tempGet(x, y) >= TEMP_ICE_MELT && (xorshift32() & 0x7) === 0) {
    setGrid(x, y, Particle.WATER);
    tempSet(x, y, TEMP_COLD);
    return;
  }

  if (canMoveTo(x, y + 1, Particle.ICE)) {
    swap(x, y, x, y + 1);
    updatedSet(x, y);
    updatedSet(x, y + 1);
  } else {
    let tryLeftFirst = (xorshift32() & 1) === 0;
    let d1 = tryLeftFirst ? -1 : 1;
    let d2 = -d1;
    if (canMoveTo(x + d1, y + 1, Particle.ICE)) {
      swap(x, y, x + d1, y + 1);
      updatedSet(x, y);
      updatedSet(x + d1, y + 1);
    } else if (canMoveTo(x + d2, y + 1, Particle.ICE)) {
      swap(x, y, x + d2, y + 1);
      updatedSet(x, y);
      updatedSet(x + d2, y + 1);
    }
  }
}

function updateLava(x, y) {
  let hasAdjacentLava = false;
  for (let dy = -1; dy <= 1 && !hasAdjacentLava; dy++) {
    for (let dx = -1; dx <= 1 && !hasAdjacentLava; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isValid(x + dx, y + dy) && getGrid(x + dx, y + dy) === Particle.LAVA)
        hasAdjacentLava = true;
    }
  }

  if (!hasAdjacentLava && tempGet(x, y) < TEMP_LAVA && (xorshift32() & 0xFF) === 0) {
    setGrid(x, y, Particle.STONE);
    return;
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (isValid(nx, ny)) {
        let nbp = getGrid(nx, ny);
        if (nbp === Particle.SAND) {
          setGrid(nx, ny, Particle.STONE);
          updatedSet(nx, ny);
        } else if (nbp === Particle.WATER) {
          setGrid(nx, ny, Particle.STEAM);
          tempSet(nx, ny, TEMP_STEAM);
          updatedSet(nx, ny);
        } else if (nbp === Particle.ICE) {
          setGrid(nx, ny, Particle.WATER);
          tempSet(nx, ny, TEMP_AMBIENT);
          updatedSet(nx, ny);
        } else if (nbp === Particle.PLANT) {
          setGrid(nx, ny, Particle.STEAM);
          tempSet(nx, ny, TEMP_STEAM);
          updatedSet(nx, ny);
        }
      }
    }
  }

  if (y > 0 && isEmpty(x, y - 1) && (xorshift32() & 0x3F) === 0) {
    setGrid(x, y - 1, Particle.FIRE);
    tempSet(x, y - 1, TEMP_FIRE);
    updatedSet(x, y - 1);
  }

  if (isEmpty(x, y + 1)) {
    swap(x, y, x, y + 1);
    updatedSet(x, y);
    updatedSet(x, y + 1);
  } else if (isEmpty(x - 1, y + 1)) {
    swap(x, y, x - 1, y + 1);
    updatedSet(x, y);
    updatedSet(x - 1, y + 1);
  } else if (isEmpty(x + 1, y + 1)) {
    swap(x, y, x + 1, y + 1);
    updatedSet(x, y);
    updatedSet(x + 1, y + 1);
  } else if ((xorshift32() & (LAVA_FLOW_CHANCE - 1)) === 0) {
    let tryLeftFirst = (xorshift32() & 1) === 0;
    let dir1 = tryLeftFirst ? -1 : 1;
    let dir2 = -dir1;
    if (isEmpty(x + dir1, y)) {
      swap(x, y, x + dir1, y);
      updatedSet(x, y);
      updatedSet(x + dir1, y);
    } else if (isEmpty(x + dir2, y)) {
      swap(x, y, x + dir2, y);
      updatedSet(x, y);
      updatedSet(x + dir2, y);
    }
  }
}

function updateAcid(x, y) {
  const ndx = [0, 0, -1, 1];
  const ndy = [-1, 1, 0, 0];

  let consumed = false;
  for (let i = 0; i < 4 && !consumed; i++) {
    let nx = x + ndx[i];
    let ny = y + ndy[i];
    if (!isValid(nx, ny)) continue;
    let nb = getGrid(nx, ny);

    let dissolveToAir = (nb === Particle.SAND || nb === Particle.STONE || nb === Particle.PLANT);
    let dissolveIceToWater = (nb === Particle.ICE);

    if ((dissolveToAir || dissolveIceToWater) && (xorshift32() & ACID_DISSOLVE_MASK) === 0) {
      if (dissolveIceToWater) {
        setGrid(nx, ny, Particle.WATER);
        tempSet(nx, ny, TEMP_COLD);
      } else {
        setGrid(nx, ny, Particle.AIR);
      }
      if ((xorshift32() & ACID_CONSUME_MASK) === 0) {
        setGrid(x, y, Particle.AIR);
        consumed = true;
      }
    }
  }
  if (consumed) return;

  if (isEmpty(x, y + 1)) {
    swap(x, y, x, y + 1);
    updatedSet(x, y);
    updatedSet(x, y + 1);
    return;
  }

  let tryLeftFirst = (xorshift32() & 1) === 0;
  let d1 = tryLeftFirst ? -1 : 1;
  let d2 = -d1;
  if (isEmpty(x + d1, y + 1)) {
    swap(x, y, x + d1, y + 1);
    updatedSet(x, y);
    updatedSet(x + d1, y + 1);
    return;
  }
  if (isEmpty(x + d2, y + 1)) {
    swap(x, y, x + d2, y + 1);
    updatedSet(x, y);
    updatedSet(x + d2, y + 1);
    return;
  }

  tryLeftFirst = (xorshift32() & 1) === 0;
  let dir1 = tryLeftFirst ? -1 : 1;
  let dir2 = -dir1;
  if (isEmpty(x + dir1, y)) {
    swap(x, y, x + dir1, y);
    updatedSet(x, y);
    updatedSet(x + dir1, y);
  } else if (isEmpty(x + dir2, y)) {
    swap(x, y, x + dir2, y);
    updatedSet(x, y);
    updatedSet(x + dir2, y);
  }
}

function updateFire(x, y) {
  if ((xorshift32() & FIRE_BURNOUT_MASK) === 0) {
    if (xorshift32() & 1) {
      setGrid(x, y, Particle.STEAM);
      tempSet(x, y, TEMP_STEAM);
    } else {
      setGrid(x, y, Particle.AIR);
    }
    updatedSet(x, y);
    return;
  }

  const fndx = [0, 0, -1, 1];
  const fndy = [-1, 1, 0, 0];
  for (let i = 0; i < 4; i++) {
    let nx = x + fndx[i];
    let ny = y + fndy[i];
    if (!isValid(nx, ny)) continue;
    let nb = getGrid(nx, ny);

    if (nb === Particle.WATER) {
      setGrid(x, y, Particle.STEAM);
      setGrid(nx, ny, Particle.STEAM);
      tempSet(x, y, TEMP_STEAM);
      tempSet(nx, ny, TEMP_STEAM);
      updatedSet(x, y);
      updatedSet(nx, ny);
      return;
    }

    if (nb === Particle.PLANT && (xorshift32() & FIRE_SPREAD_MASK) === 0) {
      setGrid(nx, ny, Particle.FIRE);
      tempSet(nx, ny, TEMP_FIRE);
      updatedSet(nx, ny);
    }
  }

  if (y > 0 && isEmpty(x, y - 1)) {
    swap(x, y, x, y - 1);
    updatedSet(x, y);
    updatedSet(x, y - 1);
    return;
  }

  let tryLeftFirst = (xorshift32() & 1) === 0;
  let d1 = tryLeftFirst ? -1 : 1;
  let d2 = -d1;
  if (y > 0 && isEmpty(x + d1, y - 1)) {
    swap(x, y, x + d1, y - 1);
    updatedSet(x, y);
    updatedSet(x + d1, y - 1);
    return;
  }
  if (y > 0 && isEmpty(x + d2, y - 1)) {
    swap(x, y, x + d2, y - 1);
    updatedSet(x, y);
    updatedSet(x + d2, y - 1);
    return;
  }

  if (isEmpty(x + d1, y)) {
    swap(x, y, x + d1, y);
    updatedSet(x, y);
    updatedSet(x + d1, y);
  } else if (isEmpty(x + d2, y)) {
    swap(x, y, x + d2, y);
    updatedSet(x, y);
    updatedSet(x + d2, y);
  }
}

function updateSteam(x, y) {
  if (tempGet(x, y) <= TEMP_STEAM_CONDENSE && (xorshift32() & STEAM_CONDENSE_MASK) === 0) {
    setGrid(x, y, Particle.WATER);
    tempSet(x, y, TEMP_COLD);
    return;
  }

  if (y > 0 && isEmpty(x, y - 1)) {
    swap(x, y, x, y - 1);
    updatedSet(x, y);
    updatedSet(x, y - 1);
    return;
  }

  let tryLeftFirst = (xorshift32() & 1) === 0;
  let d1 = tryLeftFirst ? -1 : 1;
  let d2 = -d1;
  if (y > 0 && isEmpty(x + d1, y - 1)) {
    swap(x, y, x + d1, y - 1);
    updatedSet(x, y);
    updatedSet(x + d1, y - 1);
    return;
  }
  if (y > 0 && isEmpty(x + d2, y - 1)) {
    swap(x, y, x + d2, y - 1);
    updatedSet(x, y);
    updatedSet(x + d2, y - 1);
    return;
  }

  if (isEmpty(x + d1, y)) {
    swap(x, y, x + d1, y);
    updatedSet(x, y);
    updatedSet(x + d1, y);
  } else if (isEmpty(x + d2, y)) {
    swap(x, y, x + d2, y);
    updatedSet(x, y);
    updatedSet(x + d2, y);
  }
}

function updatePlant(x, y) {
  if (tempGet(x, y) >= TEMP_HOT && (xorshift32() & 0x3) === 0) {
    setGrid(x, y, Particle.AIR);
    return;
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (isValid(nx, ny) && getGrid(nx, ny) === Particle.LAVA) {
        setGrid(x, y, Particle.AIR);
        return;
      }
    }
  }

  let hasWater = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (isValid(nx, ny) && getGrid(nx, ny) === Particle.WATER) {
        hasWater = true;
        break;
      }
    }
    if (hasWater) break;
  }

  if (hasWater && (xorshift32() & (PLANT_GROWTH_CHANCE - 1)) === 0) {
    const growDx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const growDy = [-1, -1, -1, 0, 0, 1, 1, 1];
    for (let attempt = 0; attempt < PLANT_GROWTH_ATTEMPTS; attempt++) {
      let idx = xorshift32() & 0x7;
      let nx = x + growDx[idx];
      let ny = y + growDy[idx];
      if (isEmpty(nx, ny)) {
        setGrid(nx, ny, Particle.PLANT);
        break;
      }
    }
  }
}

function simulate() {
  updated.fill(0);
  propagateTemperature();

  for (let y = GRID_HEIGHT - 2; y >= 0; y--) {
    let scanLeft = (y % 2) === 0;

    for (let i = 0; i < GRID_WIDTH; i++) {
      let x = scanLeft ? i : (GRID_WIDTH - 1 - i);

      if (updatedGet(x, y)) continue;

      let p = getGrid(x, y);
      if (p === Particle.AIR || p === Particle.WALL) continue;
      if (!shouldUpdate(p)) continue;

      switch (p) {
        case Particle.SAND: updateSand(x, y); break;
        case Particle.WATER: updateWater(x, y); break;
        case Particle.STONE: updateStone(x, y); break;
        case Particle.LAVA: updateLava(x, y); break;
        case Particle.PLANT: updatePlant(x, y); break;
        case Particle.ICE: updateIce(x, y); break;
        case Particle.STEAM: updateSteam(x, y); break;
        case Particle.ACID: updateAcid(x, y); break;
        case Particle.FIRE: updateFire(x, y); break;
      }
    }
  }

  for (let i = 0; i < dirty.length; i++) {
    dirty[i] |= updated[i];
  }
}


// --- Rendering & UI ---

let lcdWidth = SCREEN_WIDTH;
let lcdHeight = SCREEN_HEIGHT;

let currentFPS = 0.0;
let frameTimes = new Array(FPS_SAMPLE_COUNT).fill(16667);
let frameIndex = 0;
let lastFrameTime = performance.now() * 1000;

let startMenuPlayBtnX = 0, startMenuPlayBtnY = 0, startMenuPlayBtnW = 0, startMenuPlayBtnH = 0;
let startMenuSettingsBtnX = 0, startMenuSettingsBtnY = 0, startMenuSettingsBtnW = 0, startMenuSettingsBtnH = 0;
let startMenuControlsBtnX = 0, startMenuControlsBtnY = 0, startMenuControlsBtnW = 0, startMenuControlsBtnH = 0;
let startMenuExitBtnX = 0, startMenuExitBtnY = 0, startMenuExitBtnW = 0, startMenuExitBtnH = 0;

function updateFPS() {
  let currentTime = performance.now() * 1000;
  let delta = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  if (delta === 0) delta = 1;

  frameTimes[frameIndex] = delta;
  frameIndex = (frameIndex + 1) % FPS_SAMPLE_COUNT;

  let totalTime = 0;
  for (let i = 0; i < FPS_SAMPLE_COUNT; i++) {
    totalTime += frameTimes[i];
  }

  currentFPS = (FPS_SAMPLE_COUNT * 1000000) / totalTime;
}

const font = [
  [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E], // 0
  [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E], // 1
  [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F], // 2
  [0x0E, 0x11, 0x01, 0x0E, 0x01, 0x11, 0x0E], // 3
  [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02], // 4
  [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E], // 5
  [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E], // 6
  [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08], // 7
  [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], // 8
  [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C]  // 9
];

function drawDigit(x, y, digit, color, scale = 1) {
  if (digit < 0 || digit > 9) return;
  for (let row = 0; row < 7; row++) {
    let rowData = font[digit][row];
    for (let col = 0; col < 5; col++) {
      if (rowData & (1 << (4 - col))) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            let px = x + col * scale + sx;
            let py = y + row * scale + sy;
            if (px >= 0 && px < lcdWidth && py >= 0 && py < lcdHeight)
              vram[py * lcdWidth + px] = color;
          }
        }
      }
    }
  }
}

function drawFPS() {
  let fps = Math.round(currentFPS);
  if (fps > 99999) fps = 99999;

  for (let row = FPS_DISPLAY_Y; row < FPS_DISPLAY_Y + 7; row++) {
    for (let col = FPS_DISPLAY_X; col < FPS_DISPLAY_X + 30; col++) {
      if (col >= 0 && col < lcdWidth && row >= 0 && row < lcdHeight)
        vram[row * lcdWidth + col] = COLOR_AIR;
    }
  }

  let tenthousands = Math.floor(fps / 10000);
  let thousands = Math.floor(fps / 1000) % 10;
  let hundreds = Math.floor(fps / 100) % 10;
  let tens = Math.floor(fps / 10) % 10;
  let ones = fps % 10;

  let x = FPS_DISPLAY_X;
  if (tenthousands > 0) { drawDigit(x, FPS_DISPLAY_Y, tenthousands, COLOR_HIGHLIGHT); x += 6; }
  if (tenthousands > 0 || thousands > 0) { drawDigit(x, FPS_DISPLAY_Y, thousands, COLOR_HIGHLIGHT); x += 6; }
  if (tenthousands > 0 || thousands > 0 || hundreds > 0) { drawDigit(x, FPS_DISPLAY_Y, hundreds, COLOR_HIGHLIGHT); x += 6; }
  if (tenthousands > 0 || thousands > 0 || hundreds > 0 || tens > 0) { drawDigit(x, FPS_DISPLAY_Y, tens, COLOR_HIGHLIGHT); x += 6; }
  drawDigit(x, FPS_DISPLAY_Y, ones, COLOR_HIGHLIGHT);
}

function drawBrushSlider() {
  const UI_Y = SCREEN_HEIGHT - UI_HEIGHT;
  drawDigit(BRUSH_SLIDER_DIGIT_X, UI_Y + Math.floor((UI_HEIGHT - 7) / 2), brushSize, COLOR_HIGHLIGHT);

  const trackY = UI_Y + Math.floor(UI_HEIGHT / 2);
  for (let tx = BRUSH_SLIDER_TRACK_X; tx < BRUSH_SLIDER_TRACK_X + BRUSH_SLIDER_TRACK_W; tx++) {
    if (tx >= 0 && tx < lcdWidth && trackY >= 0 && trackY < lcdHeight)
      vram[trackY * lcdWidth + tx] = COLOR_WALL;
  }

  const effectiveW = BRUSH_SLIDER_TRACK_W - BRUSH_SLIDER_HANDLE_W;
  const handleX = BRUSH_SLIDER_TRACK_X + Math.floor((brushSize - BRUSH_SIZE_MIN) * effectiveW / (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN));
  const handleTop = UI_Y + 2;
  const handleBottom = UI_Y + UI_HEIGHT - 2;

  for (let hy = handleTop; hy < handleBottom; hy++) {
    for (let hx = handleX; hx < handleX + BRUSH_SLIDER_HANDLE_W; hx++) {
      if (hx >= 0 && hx < lcdWidth && hy >= 0 && hy < lcdHeight)
        vram[hy * lcdWidth + hx] = COLOR_HIGHLIGHT;
    }
  }
}

const letterFont = [
  [0x0E,0x11,0x11,0x1F,0x11,0x11,0x11], // A
  [0x1E,0x11,0x11,0x1E,0x11,0x11,0x1E], // B
  [0x0E,0x11,0x10,0x10,0x10,0x11,0x0E], // C
  [0x1E,0x11,0x11,0x11,0x11,0x11,0x1E], // D
  [0x1F,0x10,0x10,0x1E,0x10,0x10,0x1F], // E
  [0x1F,0x10,0x10,0x1E,0x10,0x10,0x10], // F
  [0x0E,0x11,0x10,0x17,0x11,0x11,0x0E], // G
  [0x11,0x11,0x11,0x1F,0x11,0x11,0x11], // H
  [0x1F,0x04,0x04,0x04,0x04,0x04,0x1F], // I
  [0x07,0x02,0x02,0x02,0x02,0x12,0x0C], // J
  [0x11,0x12,0x14,0x18,0x14,0x12,0x11], // K
  [0x10,0x10,0x10,0x10,0x10,0x10,0x1F], // L
  [0x11,0x1B,0x15,0x11,0x11,0x11,0x11], // M
  [0x11,0x19,0x15,0x13,0x11,0x11,0x11], // N
  [0x0E,0x11,0x11,0x11,0x11,0x11,0x0E], // O
  [0x1E,0x11,0x11,0x1E,0x10,0x10,0x10], // P
  [0x0E,0x11,0x11,0x15,0x12,0x0D,0x00], // Q
  [0x1E,0x11,0x11,0x1E,0x14,0x12,0x11], // R
  [0x0E,0x11,0x10,0x0E,0x01,0x11,0x0E], // S
  [0x1F,0x04,0x04,0x04,0x04,0x04,0x04], // T
  [0x11,0x11,0x11,0x11,0x11,0x11,0x0E], // U
  [0x11,0x11,0x11,0x11,0x11,0x0A,0x04], // V
  [0x11,0x11,0x11,0x15,0x1B,0x11,0x11], // W
  [0x11,0x11,0x0A,0x04,0x0A,0x11,0x11], // X
  [0x11,0x11,0x0A,0x04,0x04,0x04,0x04], // Y
  [0x1F,0x01,0x02,0x04,0x08,0x10,0x1F], // Z
  [0x00,0x00,0x00,0x00,0x00,0x00,0x00], // space
  [0x00,0x04,0x04,0x1F,0x04,0x04,0x00], // + (index 27)
  [0x10,0x08,0x04,0x02,0x04,0x08,0x10], // > (index 28)
  [0x00,0x00,0x00,0x1F,0x00,0x00,0x00], // - (index 29)
];

function drawChar(x, y, c, color, scale) {
  if (c >= '0' && c <= '9') {
    drawDigit(x, y, c.charCodeAt(0) - 48, color, scale);
    return;
  }
  let idx = 26;
  if (c >= 'A' && c <= 'Z') idx = c.charCodeAt(0) - 65;
  else if (c >= 'a' && c <= 'z') idx = c.charCodeAt(0) - 97;
  else if (c === '+') idx = 27;
  else if (c === '>') idx = 28;
  else if (c === '-') idx = 29;

  for (let row = 0; row < 7; row++) {
    let rowData = letterFont[idx][row];
    for (let col = 0; col < 5; col++) {
      if (rowData & (1 << (4 - col))) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            let px = x + col * scale + sx;
            let py = y + row * scale + sy;
            if (px >= 0 && px < lcdWidth && py >= 0 && py < lcdHeight)
              vram[py * lcdWidth + px] = color;
          }
        }
      }
    }
  }
}

function drawText(x, y, str, color, scale) {
  for (let i = 0; i < str.length; i++) {
    drawChar(x, y, str[i], color, scale);
    x += 5 * scale + scale;
  }
}

function textPixelWidth(str, scale) {
  if (str.length === 0) return 0;
  return str.length * (5 * scale + scale) - scale;
}

function drawMenuButton(label, scale, centreX, topY) {
  const padX = 20;
  const padY = 8;
  const charH = 7 * scale;
  let labelW = textPixelWidth(label, scale);
  let btnW = labelW + padX * 2;
  let btnH = charH + padY * 2;
  let btnX = centreX - Math.floor(btnW / 2);
  let btnY = topY;

  for (let py = btnY; py < btnY + btnH; py++) {
    for (let px = btnX; px < btnX + btnW; px++) {
      if (px >= 0 && px < lcdWidth && py >= 0 && py < lcdHeight)
        vram[py * lcdWidth + px] = COLOR_WALL;
    }
  }

  for (let px = btnX; px < btnX + btnW; px++) {
    if (btnY >= 0 && btnY < lcdHeight) vram[btnY * lcdWidth + px] = COLOR_HIGHLIGHT;
    if (btnY + btnH - 1 >= 0 && btnY + btnH - 1 < lcdHeight) vram[(btnY + btnH - 1) * lcdWidth + px] = COLOR_HIGHLIGHT;
  }
  for (let py = btnY; py < btnY + btnH; py++) {
    if (btnX >= 0 && btnX < lcdWidth) vram[py * lcdWidth + btnX] = COLOR_HIGHLIGHT;
    if (btnX + btnW - 1 >= 0 && btnX + btnW - 1 < lcdWidth) vram[py * lcdWidth + btnX + btnW - 1] = COLOR_HIGHLIGHT;
  }

  drawText(btnX + Math.floor((btnW - labelW) / 2), btnY + Math.floor((btnH - charH) / 2), label, COLOR_HIGHLIGHT, scale);

  return {x: btnX, y: btnY, w: btnW, h: btnH};
}

function drawStartMenu() {
  vram.fill(COLOR_AIR);
  const scale = 2;
  const centreX = Math.floor(lcdWidth / 2);

  const title = "FALLING SAND";
  let titleW = textPixelWidth(title, scale);
  drawText(centreX - Math.floor(titleW / 2), 28, title, COLOR_SAND, scale);

  const btnSpacing = 10;
  const charH = 7 * scale;
  const btnH = charH + 8 * 2;

  let playY = 70;
  let settingsY = playY + btnH + btnSpacing;
  let controlsY = settingsY + btnH + btnSpacing;
  let exitY = lcdHeight - btnH - 7;

  let btn = drawMenuButton("PLAY", scale, centreX, playY);
  startMenuPlayBtnX = btn.x; startMenuPlayBtnY = btn.y; startMenuPlayBtnW = btn.w; startMenuPlayBtnH = btn.h;

  btn = drawMenuButton("SETTINGS", scale, centreX, settingsY);
  startMenuSettingsBtnX = btn.x; startMenuSettingsBtnY = btn.y; startMenuSettingsBtnW = btn.w; startMenuSettingsBtnH = btn.h;

  btn = drawMenuButton("CONTROLS", scale, centreX, controlsY);
  startMenuControlsBtnX = btn.x; startMenuControlsBtnY = btn.y; startMenuControlsBtnW = btn.w; startMenuControlsBtnH = btn.h;

  btn = drawMenuButton("EXIT", scale, centreX, exitY);
  startMenuExitBtnX = btn.x; startMenuExitBtnY = btn.y; startMenuExitBtnW = btn.w; startMenuExitBtnH = btn.h;
}

function drawSettingsBackground(title) {
  vram.fill(COLOR_AIR);
  const scale = 2;
  let titleW = textPixelWidth(title, scale);
  drawText(Math.floor(lcdWidth / 2) - Math.floor(titleW / 2), 10, title, COLOR_HIGHLIGHT, scale);
}

function drawSettingsFooter() {
  const h1 = "UP DOWN SELECT";
  const h2 = "EXE SAVE   EXIT BACK";
  drawText(Math.floor(lcdWidth / 2) - Math.floor(textPixelWidth(h1, 1) / 2), lcdHeight - 20, h1, COLOR_WALL, 1);
  drawText(Math.floor(lcdWidth / 2) - Math.floor(textPixelWidth(h2, 1) / 2), lcdHeight - 10, h2, COLOR_WALL, 1);
}

function drawRowHighlight(rowY, rowH) {
  for (let py = rowY - 2; py < rowY + rowH - 4; py++) {
    for (let px = 8; px < lcdWidth - 8; px++) {
      if (px >= 0 && px < lcdWidth && py >= 0 && py < lcdHeight)
        vram[py * lcdWidth + px] = COLOR_WALL;
    }
  }
}

function drawControlsScreen() {
  drawSettingsBackground("CONTROLS");
  const scale = 1;
  const lx = 8;
  const rx = Math.floor(lcdWidth / 2) + 4;
  let y = 28;
  const lineH = 10;

  drawText(lx, y, "IN-GAME", COLOR_SAND, scale);
  drawText(rx, y, "MENUS", COLOR_SAND, scale);
  y += lineH + 2;

  const leftLines = ["TOUCH DRAW", "UI BAR SELECT TYPE", "SLIDER BRUSH SIZE", "+ - BRUSH SIZE", "0   TEMP VIEW", "CLEAR RESET GRID", "EXE  BACK TO MENU"];
  const rightLines = ["TOUCH SELECT", "UP DOWN NAVIGATE", "EXE  CONFIRM", "CLEAR BACK"];

  let maxLines = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (i < leftLines.length) drawText(lx, y, leftLines[i], COLOR_STONE, scale);
    if (i < rightLines.length) drawText(rx, y, rightLines[i], COLOR_STONE, scale);
    y += lineH;
  }

  const back = "EXE OR CLEAR   BACK";
  drawText(Math.floor(lcdWidth / 2) - Math.floor(textPixelWidth(back, 1) / 2), lcdHeight - 10, back, COLOR_WALL, 1);
}

function drawSettingsMenu(selectedItem) {
  drawSettingsBackground("SETTINGS");
  const scale = 2;
  const rowH = 7 * scale + 8;
  const rowStartY = 40;
  const items = ["CPU SPEED", "SIM SPEED"];

  for (let i = 0; i < items.length; i++) {
    let rowY = rowStartY + i * rowH;
    let sel = (i === selectedItem);
    if (sel) drawRowHighlight(rowY, rowH);
    let col = sel ? COLOR_HIGHLIGHT : COLOR_STONE;
    if (sel) drawText(12, rowY, ">", col, scale);
    drawText(28, rowY, items[i], col, scale);
    drawText(lcdWidth - 28, rowY, ">", sel ? COLOR_HIGHLIGHT : COLOR_WALL, scale);
  }

  const h1 = "UP DOWN SELECT";
  const h2 = "EXE ENTER  EXIT BACK";
  drawText(Math.floor(lcdWidth / 2) - Math.floor(textPixelWidth(h1, 1) / 2), lcdHeight - 20, h1, COLOR_WALL, 1);
  drawText(Math.floor(lcdWidth / 2) - Math.floor(textPixelWidth(h2, 1) / 2), lcdHeight - 10, h2, COLOR_WALL, 1);
}

function drawInt(x, y, val, color) {
  if (val >= 100) {
    drawDigit(x, y, Math.floor(val / 100), color); x += 6;
    drawDigit(x, y, Math.floor(val / 10) % 10, color); x += 6;
    drawDigit(x, y, val % 10, color);
  } else if (val >= 10) {
    drawDigit(x, y, Math.floor(val / 10), color); x += 6;
    drawDigit(x, y, val % 10, color);
  } else {
    drawDigit(x, y, val, color);
  }
}

function drawPctGlyph(x0, y0, color, scale) {
  const pct_glyph = [0x18, 0x18, 0x02, 0x04, 0x08, 0x03, 0x03];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (pct_glyph[row] & (1 << (4 - col))) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            let px = x0 + col * scale + sx;
            let py = y0 + row * scale + sy;
            if (px >= 0 && px < lcdWidth && py >= 0 && py < lcdHeight)
              vram[py * lcdWidth + px] = color;
          }
        }
      }
    }
  }
}

// Ignore real overclock logic, just mimic UI
const OC_LEVEL_MIN = 0;
const OC_LEVEL_MAX = 5;
const overclock_level_names = ["DEFAULT", "LIGHT", "MEDIUM", "FAST", "TURBO", "TURBO+"];
function oclock_speed_percent(lvl) {
  const pcts = [100, 106, 117, 126, 138, 200];
  return pcts[lvl];
}

function drawOCScreen(selectedLevel) {
  drawSettingsBackground("CPU SPEED");
  const scale = 2;
  const rowH = 7 * scale + 6;
  const rowStartY = 38;

  for (let lvl = OC_LEVEL_MIN; lvl <= OC_LEVEL_MAX; lvl++) {
    let rowY = rowStartY + lvl * rowH;
    let sel = (lvl === selectedLevel);
    if (sel) drawRowHighlight(rowY, rowH);
    let col = sel ? COLOR_HIGHLIGHT : COLOR_STONE;
    if (sel) drawText(12, rowY, ">", col, scale);
    drawText(28, rowY, overclock_level_names[lvl], col, scale);
    let pct = oclock_speed_percent(lvl);
    drawInt(lcdWidth - 70, rowY, pct, col);
    drawPctGlyph(lcdWidth - 54, rowY, col, 1);
  }
  drawSettingsFooter();
}

function drawSimSpeedScreen(selectedMode) {
  drawSettingsBackground("SIM SPEED");
  const scale = 2;
  const rowH = 7 * scale + 6;
  const rowStartY = 38;
  const desc = ["1 PHYS PER FRAME", "2 PHYS PER FRAME", "3 PHYS PER FRAME", "5 PHYS PER FRAME", "9 PHYS PER FRAME"];

  for (let m = 0; m <= SIM_SPEED_MODE_MAX; m++) {
    let rowY = rowStartY + m * rowH;
    let sel = (m === selectedMode);
    if (sel) drawRowHighlight(rowY, rowH);
    let col = sel ? COLOR_HIGHLIGHT : COLOR_STONE;
    if (sel) drawText(12, rowY, ">", col, scale);
    drawText(28, rowY, simSpeedModeNames[m], col, scale);
    let descW = textPixelWidth(desc[m], 1);
    drawText(lcdWidth - descW - 6, rowY + Math.floor((7 * scale - 7) / 2), desc[m], sel ? COLOR_HIGHLIGHT : COLOR_WALL, 1);
  }
  drawSettingsFooter();
}

function drawGrid() {
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let screenY = y * PIXEL_SIZE;

    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!dirtyGet(x, y)) continue;

      let p = getGrid(x, y);
      let color = tempViewEnabled ?
        (p === Particle.WALL ? tempToColor(TEMP_AMBIENT) : tempToColor(tempGet(x, y))) :
        getParticleColorVaried(p, x, y);

      let screenX = x * PIXEL_SIZE;

      vram[screenY * lcdWidth + screenX] = color;
      vram[screenY * lcdWidth + screenX + 1] = color;
      vram[(screenY + 1) * lcdWidth + screenX] = color;
      vram[(screenY + 1) * lcdWidth + screenX + 1] = color;
    }
  }

  dirty.fill(0);

  const UI_Y = SCREEN_HEIGHT - UI_HEIGHT;
  for (let row = UI_Y; row < SCREEN_HEIGHT; row++) {
    for (let col = 0; col < lcdWidth; col++) {
      vram[row * lcdWidth + col] = 0;
    }
  }

  for (let i = 0; i < PARTICLE_TYPE_COUNT; i++) {
    let color = getParticleColor(PARTICLE_UI_ORDER[i]);
    if (PARTICLE_UI_ORDER[i] === Particle.AIR) {
      color = COLOR_UI_AIR;
    }
    let x = UI_START_X + i * SWATCH_SPACING;

    for (let dy = 0; dy < SWATCH_SIZE; dy++) {
      for (let dx = 0; dx < SWATCH_SIZE; dx++) {
        vram[(UI_Y + dy) * lcdWidth + x + dx] = color;
      }
    }

    if (PARTICLE_UI_ORDER[i] === selectedParticle) {
      for (let dx = 0; dx < SWATCH_SIZE; dx++) {
        vram[UI_Y * lcdWidth + x + dx] = COLOR_HIGHLIGHT;
        vram[(UI_Y + SWATCH_SIZE - 1) * lcdWidth + x + dx] = COLOR_HIGHLIGHT;
      }
      for (let dy = 0; dy < SWATCH_SIZE; dy++) {
        vram[(UI_Y + dy) * lcdWidth + x] = COLOR_HIGHLIGHT;
        vram[(UI_Y + dy) * lcdWidth + x + SWATCH_SIZE - 1] = COLOR_HIGHLIGHT;
      }
    }
  }

  drawFPS();
  drawBrushSlider();

  const hintX = 262;
  const hintY = SCREEN_HEIGHT - UI_HEIGHT + Math.floor((UI_HEIGHT - 7) / 2);
  drawText(hintX, hintY, "EXE BACK", COLOR_WALL, 1);
}


// --- Input & Events ---

let selectedParticle = Particle.SAND;
let brushSize = BRUSH_SIZE_DEFAULT;
let tempViewEnabled = false;

const inputEvents = [];

let isPointerDown = false;
let lastPointerX = -1;
let lastPointerY = -1;

function placeParticle(gridX, gridY) {
  if (!isValid(gridX, gridY)) return;
  if (gridY >= GRID_UI_BOUNDARY) return;

  let halfBrush = Math.floor(brushSize / 2);

  if (selectedParticle === Particle.AIR) {
    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        let x = gridX + dx;
        let y = gridY + dy;
        if (isValid(x, y) && y < GRID_UI_BOUNDARY) {
          if (y === GRID_UI_BOUNDARY - 1) continue;
          setGrid(x, y, Particle.AIR);
          tempSet(x, y, TEMP_AMBIENT);
          dirtySet(x, y);
        }
      }
    }
    return;
  }

  for (let dy = -halfBrush; dy <= halfBrush; dy++) {
    for (let dx = -halfBrush; dx <= halfBrush; dx++) {
      let x = gridX + dx;
      let y = gridY + dy;
      if (isValid(x, y) && y < GRID_UI_BOUNDARY) {
        if (getGrid(x, y) === Particle.WALL && selectedParticle !== Particle.WALL) continue;
        setGrid(x, y, selectedParticle);
        tempSet(x, y, getParticleTemperature(selectedParticle));
        dirtySet(x, y);
      }
    }
  }
}

function initInput() {
  canvas.addEventListener('pointerdown', e => {
    isPointerDown = true;
    let rect = canvas.getBoundingClientRect();
    let touchX = Math.floor(e.clientX - rect.left);
    let touchY = Math.floor(e.clientY - rect.top);
    lastPointerX = touchX;
    lastPointerY = touchY;
    // Pushing a touch event
    inputEvents.push({ type: 'TOUCH', x: touchX, y: touchY });
  });

  canvas.addEventListener('pointermove', e => {
    if (!isPointerDown) return;
    let rect = canvas.getBoundingClientRect();
    let touchX = Math.floor(e.clientX - rect.left);
    let touchY = Math.floor(e.clientY - rect.top);
    if (touchX !== lastPointerX || touchY !== lastPointerY) {
        lastPointerX = touchX;
        lastPointerY = touchY;
        inputEvents.push({ type: 'TOUCH', x: touchX, y: touchY });
    }
  });

  canvas.addEventListener('pointerup', e => {
    isPointerDown = false;
  });

  // Use click event to simulate touch
  canvas.addEventListener('click', e => {
      let rect = canvas.getBoundingClientRect();
      let touchX = Math.floor(e.clientX - rect.left);
      let touchY = Math.floor(e.clientY - rect.top);
      inputEvents.push({ type: 'TOUCH', x: touchX, y: touchY });
  });

  document.addEventListener('keydown', e => {
    let key = e.key.toUpperCase();
    inputEvents.push({ type: 'KEY', key: key, pressed: true });
  });
}

function flushInputEvents() {
  inputEvents.length = 0;
}

// In standard JS port, we map strings instead of KEYCODE enum
// "ENTER" = EXE
// "BACKSPACE" / "ESCAPE" = CLEAR/ESC
// "ARROWUP" = UP
// "ARROWDOWN" = DOWN
// "+" = PLUS
// "-" = MINUS
// "0" = 0

function handleStartMenuInput() {
  while (inputEvents.length > 0) {
    let event = inputEvents.shift();
    if (event.type === 'TOUCH') {
      let tx = event.x, ty = event.y;
      let hit = (bx, by, bw, bh) => (tx >= bx && tx < bx + bw && ty >= by && ty < by + bh);

      if (hit(startMenuPlayBtnX, startMenuPlayBtnY, startMenuPlayBtnW, startMenuPlayBtnH)) return 1;
      if (hit(startMenuSettingsBtnX, startMenuSettingsBtnY, startMenuSettingsBtnW, startMenuSettingsBtnH)) return 2;
      if (hit(startMenuControlsBtnX, startMenuControlsBtnY, startMenuControlsBtnW, startMenuControlsBtnH)) return 3;
      if (hit(startMenuExitBtnX, startMenuExitBtnY, startMenuExitBtnW, startMenuExitBtnH)) return -1;
    } else if (event.type === 'KEY' && event.pressed) {
      if (event.key === 'ENTER') return 1;
      if (event.key === 'BACKSPACE' || event.key === 'ESCAPE') return -1;
    }
  }
  return 0;
}

function handleControlsInput() {
  while (inputEvents.length > 0) {
    let event = inputEvents.shift();
    if (event.type === 'KEY' && event.pressed) {
      if (event.key === 'ENTER' || event.key === 'BACKSPACE' || event.key === 'ESCAPE') {
        return -1;
      }
    }
  }
  return 0;
}

function handleSettingsMenuInput(stateObj) {
  while (inputEvents.length > 0) {
    let event = inputEvents.shift();
    if (event.type === 'KEY' && event.pressed) {
      if (event.key === 'ARROWUP') {
        if (stateObj.selectedItem > 0) stateObj.selectedItem--;
      } else if (event.key === 'ARROWDOWN') {
        if (stateObj.selectedItem < 1) stateObj.selectedItem++;
      } else if (event.key === 'ENTER') {
        return 1;
      } else if (event.key === 'BACKSPACE' || event.key === 'ESCAPE') {
        return -1;
      }
    }
  }
  return 0;
}

function handleOCInput(stateObj) {
  while (inputEvents.length > 0) {
    let event = inputEvents.shift();
    if (event.type === 'KEY' && event.pressed) {
      if (event.key === 'ARROWUP') {
        if (stateObj.selectedLevel > OC_LEVEL_MIN) stateObj.selectedLevel--;
      } else if (event.key === 'ARROWDOWN') {
        if (stateObj.selectedLevel < OC_LEVEL_MAX) stateObj.selectedLevel++;
      } else if (event.key === 'ENTER') {
        return 1;
      } else if (event.key === 'BACKSPACE' || event.key === 'ESCAPE') {
        return -1;
      }
    }
  }
  return 0;
}

function handleSimSpeedInput(stateObj) {
  while (inputEvents.length > 0) {
    let event = inputEvents.shift();
    if (event.type === 'KEY' && event.pressed) {
      if (event.key === 'ARROWUP') {
        if (stateObj.selectedMode > 0) stateObj.selectedMode--;
      } else if (event.key === 'ARROWDOWN') {
        if (stateObj.selectedMode < SIM_SPEED_MODE_MAX) stateObj.selectedMode++;
      } else if (event.key === 'ENTER') {
        return 1;
      } else if (event.key === 'BACKSPACE' || event.key === 'ESCAPE') {
        return -1;
      }
    }
  }
  return 0;
}

function handleInput() {
  let shouldExit = false;
  while (inputEvents.length > 0) {
    let event = inputEvents.shift();

    if (event.type === 'TOUCH') {
      let touchX = event.x;
      let touchY = event.y;

      let touchedUI = false;
      if (touchY >= SCREEN_HEIGHT - UI_HEIGHT) {
        for (let j = 0; j < PARTICLE_TYPE_COUNT; j++) {
          let x = UI_START_X + j * SWATCH_SPACING;
          if (touchX >= x && touchX < x + SWATCH_SIZE) {
            selectedParticle = PARTICLE_UI_ORDER[j];
            touchedUI = true;
            break;
          }
        }

        if (!touchedUI && touchX >= BRUSH_SLIDER_TRACK_X && touchX < BRUSH_SLIDER_TRACK_X + BRUSH_SLIDER_TRACK_W) {
          let rel = touchX - BRUSH_SLIDER_TRACK_X;
          let newSize = BRUSH_SIZE_MIN + Math.floor(rel * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN) / (BRUSH_SLIDER_TRACK_W - 1));
          if (newSize < BRUSH_SIZE_MIN) newSize = BRUSH_SIZE_MIN;
          if (newSize > BRUSH_SIZE_MAX) newSize = BRUSH_SIZE_MAX;
          if (newSize !== brushSize) {
            brushSize = newSize;
            saveSettings();
          }
          touchedUI = true;
        }
      }

      if (!touchedUI) {
        let gridX = Math.floor(touchX / PIXEL_SIZE);
        let gridY = Math.floor(touchY / PIXEL_SIZE);
        placeParticle(gridX, gridY);
      }
    } else if (event.type === 'KEY' && event.pressed) {
      if (event.key === 'BACKSPACE') {
        initGrid();
      } else if (event.key === '+' || event.key === '=') {
        if (brushSize < BRUSH_SIZE_MAX) brushSize++;
        saveSettings();
      } else if (event.key === '-' || event.key === '_') {
        if (brushSize > BRUSH_SIZE_MIN) brushSize--;
        saveSettings();
      } else if (event.key === '0') {
        tempViewEnabled = !tempViewEnabled;
        dirty.fill(0xFFFFFFFF);
      } else if (event.key === 'ENTER' || event.key === 'ESCAPE') {
        shouldExit = true;
      }
    }
  }
  return shouldExit;
}


// --- Application State & Loop ---

const APP_STATE = {
  START_MENU: 0,
  SETTINGS_MENU: 1,
  CONTROLS: 2,
  GAME: 3,
  SETTINGS_OC: 4,
  SETTINGS_SIM: 5
};

let appState = APP_STATE.START_MENU;

let overclockLevel = OC_LEVEL_MIN;
let simSpeedMode = SIM_SPEED_MODE_DEFAULT;

// Settings dummy / localStorage
function initSettings() {
  let savedBrush = localStorage.getItem('BrushSz');
  if (savedBrush !== null) brushSize = parseInt(savedBrush);

  let savedOC = localStorage.getItem('OCLevel');
  if (savedOC !== null) overclockLevel = parseInt(savedOC);

  let savedSim = localStorage.getItem('SimSpd');
  if (savedSim !== null) simSpeedMode = parseInt(savedSim);
}

function saveSettings() {
  localStorage.setItem('BrushSz', brushSize);
  localStorage.setItem('OCLevel', overclockLevel);
  localStorage.setItem('SimSpd', simSpeedMode);
}

// Global states for navigation
let stateSettings = { selectedItem: 0 };
let stateOC = { selectedLevel: 0 };
let stateSim = { selectedMode: 0 };

let frameCount = 0;

function mainLoop() {
  switch (appState) {
    case APP_STATE.START_MENU:
      drawStartMenu();
      renderVRAM();
      let rStart = handleStartMenuInput();
      if (rStart === 1) {
        vram.fill(0);
        renderVRAM();
        appState = APP_STATE.GAME;
      } else if (rStart === 2) {
        stateSettings.selectedItem = 0;
        appState = APP_STATE.SETTINGS_MENU;
      } else if (rStart === 3) {
        flushInputEvents();
        appState = APP_STATE.CONTROLS;
      }
      break;

    case APP_STATE.SETTINGS_MENU:
      drawSettingsMenu(stateSettings.selectedItem);
      renderVRAM();
      let rSet = handleSettingsMenuInput(stateSettings);
      if (rSet === 1) {
        if (stateSettings.selectedItem === 0) {
          stateOC.selectedLevel = overclockLevel;
          appState = APP_STATE.SETTINGS_OC;
        } else if (stateSettings.selectedItem === 1) {
          stateSim.selectedMode = simSpeedMode;
          appState = APP_STATE.SETTINGS_SIM;
        }
      } else if (rSet === -1) {
        appState = APP_STATE.START_MENU;
      }
      break;

    case APP_STATE.SETTINGS_OC:
      drawOCScreen(stateOC.selectedLevel);
      renderVRAM();
      let rOC = handleOCInput(stateOC);
      if (rOC === 1) {
        overclockLevel = stateOC.selectedLevel;
        saveSettings();
        appState = APP_STATE.SETTINGS_MENU;
      } else if (rOC === -1) {
        appState = APP_STATE.SETTINGS_MENU;
      }
      break;

    case APP_STATE.SETTINGS_SIM:
      drawSimSpeedScreen(stateSim.selectedMode);
      renderVRAM();
      let rSim = handleSimSpeedInput(stateSim);
      if (rSim === 1) {
        simSpeedMode = stateSim.selectedMode;
        saveSettings();
        appState = APP_STATE.SETTINGS_MENU;
      } else if (rSim === -1) {
        appState = APP_STATE.SETTINGS_MENU;
      }
      break;

    case APP_STATE.CONTROLS:
      drawControlsScreen();
      renderVRAM();
      if (handleControlsInput() === -1) {
        appState = APP_STATE.START_MENU;
      }
      break;

    case APP_STATE.GAME:
      simulate();
      updateFPS();

      let shouldRender = true;
      let skipAmt = simSkipAmounts[simSpeedMode];
      if (skipAmt > 0) {
        shouldRender = (frameCount % (skipAmt + 1)) === 0;
      }

      if (shouldRender) {
        drawGrid();
        renderVRAM();
      }

      if (handleInput()) {
        appState = APP_STATE.START_MENU;
      }

      frameCount++;
      break;
  }

  requestAnimationFrame(mainLoop);
}

// Entry point
window.onload = function() {
  initRenderer(SCREEN_WIDTH, SCREEN_HEIGHT);
  initSettings();
  initGrid();
  initInput();

  // Save Screenshot Button
  document.getElementById('saveBtn').addEventListener('click', () => {
    let a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'fallingsand_screenshot.png';
    a.click();
  });

  // Start the main loop
  requestAnimationFrame(mainLoop);
};
