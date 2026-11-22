// Three acts of Meridian House. Each level is a fixed 1600 x 900 floor: walls,
// cover that breaks sight, shadow pockets, patrol routes, cameras, lasers,
// a terminal and the night's loot. Coordinates are in world pixels.

const OUTER = 36;

function wall(x, y, w, h) {
  return { x, y, w, h };
}

function makeBase() {
  return {
    walls: [
      wall(0, 0, 1600, OUTER),
      wall(0, 864, 740, OUTER),
      wall(860, 864, 740, OUTER),
      wall(0, 0, OUTER, 900),
      wall(1564, 0, OUTER, 900),
    ],
    cover: [],
    shadows: [],
    vents: [],
    lasers: [],
    terminals: [],
    doors: [],
    cameras: [],
    guards: [],
  };
}

/** Act I: the winter exhibition, a marble hall, the Gilded Moth on its plinth. */
function createAtriumLevel() {
  const level = makeBase();
  level.id = 'atrium';
  level.act = 0;
  level.title = 'The Atrium';
  level.house = 'Meridian House';
  level.hour = '11:47 PM';
  level.brief = 'The Gilded Moth is on its plinth in the north alcove. Cross the marble, read the patrols, and be gone before the clock strikes twelve.';
  level.decor = 'atrium';
  level.palette = {
    floor: '#142631',
    floorAlt: '#0e1c24',
    carpet: '#451923',
    wall: '#243a4a',
    wallTop: '#45647a',
    trim: '#e3b154',
    accent: '#f6d583',
  };
  level.start = { x: 800, y: 782 };
  level.loot = { x: 800, y: 126, name: 'The Gilded Moth', hold: 2.3, plaque: 'THE GILDED MOTH · 1928' };
  level.exit = { x: 748, y: 818, w: 104, h: 44, label: 'The Street' };

  level.walls.push(
    // north alcove
    wall(656, OUTER, 36, 170),
    wall(908, OUTER, 36, 170),
    // display walls left and right of the hall
    wall(OUTER, 206, 292, 26),
    wall(1272, 206, 292, 26),
    // side galleries, each with a central doorway
    wall(420, 280, 26, 160),
    wall(420, 560, 26, 200),
    wall(1180, 280, 26, 160),
    wall(1180, 560, 26, 200),
    // gallery back walls, so each side reads as a room
    wall(OUTER, 760, 338, 26),
    wall(1226, 760, 338, 26),
    // vent wall on the east side: a crawl route behind the hall
    wall(1470, 300, 24, 240),
    wall(1470, 620, 24, 220),
  );

  level.cover.push(
    { x: 520, y: 404, w: 64, h: 64, kind: 'column' },
    { x: 1016, y: 404, w: 64, h: 64, kind: 'column' },
    { x: 520, y: 636, w: 64, h: 64, kind: 'column' },
    { x: 1016, y: 636, w: 64, h: 64, kind: 'column' },
    { x: 236, y: 446, w: 132, h: 46, kind: 'case' },
    { x: 1232, y: 446, w: 132, h: 46, kind: 'case' },
    { x: 370, y: 242, w: 110, h: 42, kind: 'case' },
    { x: 1120, y: 242, w: 110, h: 42, kind: 'case' },
    { x: 676, y: 596, w: 248, h: 34, kind: 'bench' },
    { x: 200, y: 640, w: 96, h: 96, kind: 'desk' },
    { x: 1250, y: 640, w: 146, h: 76, kind: 'piano' },
  );

  // The plinth itself: low, solid, and the thing the loot sits on.
  level.cover.push({ x: 782, y: 112, w: 36, h: 40, kind: 'plinth' });

  level.shadows.push(
    { x: OUTER, y: 232, w: 230, h: 90 },
    { x: 1240, y: 232, w: 230, h: 90 },
    { x: OUTER, y: 692, w: 220, h: 130 },
    { x: 1344, y: 236, w: 120, h: 64 },
    { x: 1470, y: 300, w: 94, h: 540, vent: true },
  );

  level.vents.push({ x: 1494, y: 310, w: 70, h: 520, label: 'SERVICE CRAWL' });

  level.guards.push(
    {
      name: 'Warden Pike',
      path: [[330, 318], [1270, 318]],
      speed: 68,
      range: 255,
      fov: 1.15,
      wait: 1.1,
    },
    {
      name: 'Warden Voss',
      path: [[124, 760], [340, 760], [340, 336], [124, 336]],
      speed: 62,
      range: 235,
      fov: 1.05,
      wait: 1.4,
    },
  );

  level.cameras.push(
    { x: 116, y: 118, base: 0.9, sweep: 0.78, speed: 0.55, range: 348, fov: 1.02, name: 'NORTH-WEST' },
    { x: 1484, y: 118, base: 2.24, sweep: 0.78, speed: 0.47, range: 348, fov: 1.02, name: 'NORTH-EAST' },
    { x: 700, y: 110, base: 1.24, sweep: 0.64, speed: 0.4, range: 320, fov: 0.9, name: 'GALLERY' },
  );

  return level;
}

/** Act II: the archive, a maze of stacks, a locked reading room and a laser seam. */
function createArchiveLevel() {
  const level = makeBase();
  level.id = 'archive';
  level.act = 1;
  level.title = 'The Archive';
  level.house = 'The West Wing';
  level.hour = '12:26 AM';
  level.brief = 'The Black Ledger is sealed in the reading room. The lock answers to the catalog terminal; the staff corridor behind the stacks does not.';
  level.decor = 'archive';
  level.palette = {
    floor: '#1b1c21',
    floorAlt: '#14151a',
    carpet: '#35251a',
    wall: '#3b3228',
    wallTop: '#5c4c38',
    trim: '#d4aa63',
    accent: '#f0c87c',
  };
  level.start = { x: 246, y: 778 };
  level.loot = { x: 1332, y: 154, name: 'The Black Ledger', hold: 2.5, plaque: 'LEDGER · WEST WING' };
  level.exit = { x: 120, y: 818, w: 104, h: 44, label: 'The Colonnade' };

  level.walls.push(
    // reading room, with a keyed door in its south wall
    wall(1100, OUTER, 30, 250),
    wall(1100, 286, 160, 26),
    wall(1360, 286, 204, 26),
    // the stacks themselves
    wall(320, 260, 580, 28),
    wall(320, 400, 580, 28),
    wall(320, 540, 580, 28),
    wall(320, 680, 580, 28),
    // service corridor on the far west
    wall(180, 300, 22, 200),
    wall(180, 600, 22, 180),
    // catalog nook
    wall(900, 720, 24, 108),
  );

  level.doors.push({ id: 'reading', x: 1260, y: 286, w: 100, h: 26, label: 'READING ROOM' });

  level.cover.push(
    { x: 980, y: 742, w: 118, h: 52, kind: 'cabinet' },
    { x: 1180, y: 700, w: 170, h: 52, kind: 'desk' },
    { x: 470, y: 180, w: 120, h: 54, kind: 'desk' },
    { x: 760, y: 180, w: 120, h: 54, kind: 'desk' },
    { x: 240, y: 470, w: 70, h: 70, kind: 'column' },
    { x: 1000, y: 180, w: 70, h: 70, kind: 'column' },
    { x: 640, y: 760, w: 150, h: 48, kind: 'cabinet' },
  );

  level.shadows.push(
    { x: OUTER, y: 320, w: 130, h: 240, vent: true },
    { x: 180, y: 300, w: 140, h: 480, vent: true },
    { x: 320, y: 700, w: 170, h: 100 },
    { x: 1180, y: 600, w: 170, h: 84 },
    { x: 1180, y: 36, w: 380, h: 90 },
  );

  level.vents.push({ x: 200, y: 310, w: 110, h: 470, label: 'STAFF CRAWL' });

  level.terminals.push({
    x: 1018,
    y: 806,
    label: 'CUT THE LASER SEAM',
    action: 'lasers',
    hold: 1.6,
  });

  level.lasers.push(
    { x1: 1010, y1: 320, x2: 1010, y2: 500, key: 'seam' },
    { x1: 1010, y1: 520, x2: 1010, y2: 720, key: 'seam' },
  );

  level.guards.push(
    {
      name: 'Archivist Bell',
      path: [[360, 332], [860, 332]],
      speed: 64,
      range: 235,
      fov: 1.1,
      wait: 0.9,
    },
    {
      name: 'Warden Crowe',
      path: [[860, 612], [360, 612]],
      speed: 66,
      range: 240,
      fov: 1.12,
      wait: 1.2,
    },
    {
      name: 'Warden Hale',
      path: [[1170, 190], [1500, 190]],
      speed: 58,
      range: 230,
      fov: 1.0,
      wait: 1.6,
    },
  );

  level.cameras.push(
    { x: 992, y: 84, base: 2.02, sweep: 0.72, speed: 0.5, range: 330, fov: 1.0, name: 'STACKS' },
    { x: 520, y: 820, base: -1.42, sweep: 0.66, speed: 0.62, range: 315, fov: 0.96, name: 'CATALOG' },
  );

  return level;
}

/** Act III: the vault under the house, the Sunstone, and the last run to the lift. */
function createVaultLevel() {
  const level = makeBase();
  level.id = 'vault';
  level.act = 2;
  level.title = 'The Vault';
  level.house = 'Below Meridian';
  level.hour = '12:58 AM';
  level.brief = 'The Sunstone sits in the lower vault behind a grid and a time lock. One terminal, one window, one lift. This is the last of it.';
  level.decor = 'vault';
  level.palette = {
    floor: '#111b20',
    floorAlt: '#0c1418',
    carpet: '#3e281b',
    wall: '#2d4048',
    wallTop: '#4d6b76',
    trim: '#c69a49',
    accent: '#f4cc78',
  };
  level.start = { x: 800, y: 786 };
  level.loot = { x: 800, y: 392, name: 'The Sunstone', hold: 2.6, plaque: 'THE SUNSTONE · LOWER VAULT' };
  level.exit = { x: 748, y: 818, w: 104, h: 44, label: 'The Lift' };

  level.walls.push(
    // the vault room
    wall(600, 260, 36, 320),
    wall(964, 260, 36, 320),
    wall(600, 260, 400, 36),
    wall(600, 544, 150, 30),
    wall(850, 544, 150, 30),
    // approach buttresses
    wall(420, 620, 150, 26),
    wall(1030, 620, 150, 26),
    // side service bays
    wall(250, 260, 26, 160),
    wall(250, 560, 26, 170),
    wall(1324, 260, 26, 160),
    wall(1324, 560, 26, 170),
  );

  level.doors.push({ id: 'vault', x: 750, y: 544, w: 100, h: 30, label: 'VAULT' });

  level.cover.push(
    { x: 452, y: 400, w: 92, h: 62, kind: 'crate' },
    { x: 1056, y: 400, w: 92, h: 62, kind: 'crate' },
    { x: 448, y: 730, w: 128, h: 48, kind: 'desk' },
    { x: 1024, y: 730, w: 128, h: 48, kind: 'desk' },
    { x: 300, y: 700, w: 74, h: 74, kind: 'column' },
    { x: 1226, y: 700, w: 74, h: 74, kind: 'column' },
    { x: 782, y: 376, w: 36, h: 40, kind: 'plinth' },
  );

  level.shadows.push(
    { x: OUTER, y: 240, w: 200, h: 160 },
    { x: 1364, y: 240, w: 200, h: 160 },
    { x: OUTER, y: 700, w: 240, h: 120 },
    { x: 1324, y: 700, w: 240, h: 120 },
    { x: 600, y: 300, w: 36, h: 240, vent: true },
    { x: 964, y: 300, w: 36, h: 240, vent: true },
  );

  level.vents.push({ x: 258, y: 270, w: 66, h: 450, label: 'DUCT' });

  level.terminals.push({
    x: 300,
    y: 348,
    label: 'BURN THE VAULT GRID',
    action: 'vault',
    hold: 1.8,
  });

  level.lasers.push(
    { x1: 620, y1: 616, x2: 980, y2: 616, key: 'grid' },
    { x1: 620, y1: 674, x2: 980, y2: 674, key: 'grid' },
  );

  level.guards.push(
    {
      name: 'Captain Rourke',
      path: [[360, 238], [1240, 238], [1240, 770], [360, 770]],
      speed: 70,
      range: 260,
      fov: 1.16,
      wait: 0.8,
    },
    {
      name: 'Warden Ashe',
      path: [[470, 128], [1130, 128]],
      speed: 64,
      range: 240,
      fov: 1.08,
      wait: 1.2,
    },
    {
      name: 'Warden Quill',
      path: [[186, 360], [186, 700]],
      speed: 60,
      range: 235,
      fov: 1.06,
      wait: 1.5,
    },
  );

  level.cameras.push(
    { x: 92, y: 86, base: 0.76, sweep: 0.74, speed: 0.58, range: 350, fov: 1.02, name: 'WEST STAIR' },
    { x: 1508, y: 86, base: 2.38, sweep: 0.74, speed: 0.51, range: 350, fov: 1.02, name: 'EAST STAIR' },
  );

  return level;
}

export const LEVELS = [createAtriumLevel(), createArchiveLevel(), createVaultLevel()];

export function createLevel(index) {
  const source = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
  return structuredClone(source);
}
