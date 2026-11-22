// Shared numbers for The Gilded Hour. The floor is a fixed 16:9 stage so the whole
// room, its patrols and the alarm gauge share one frame at every window size.

export const WORLD = { width: 1600, height: 900 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 172,
  sneakSpeed: 92,
  runSpeed: 278,
  carryingPenalty: 0.88,
  accel: 1750,
  brake: 2100,
};

export const ALARM = {
  max: 100,
  cameraRate: 30,
  sightRate: 38,
  chaseRate: 14,
  decay: 3.2,
  decayDelay: 3.4,
  hot: 62,
  critical: 84,
};

export const TOOLS = {
  smoke: { radius: 118, life: 5.4, cooldown: 1.1, charges: 2 },
  emp: { radius: 300, life: 8.0, cooldown: 1.4, charges: 1 },
  decoy: { radius: 440, life: 4.0, cooldown: 1.0, charges: 2 },
};

export const COLORS = {
  ink: '#080b12',
  inkSoft: '#0d121c',
  slate: '#151d2b',
  slateLight: '#1e293a',
  teal: '#14343b',
  tealDeep: '#0e252c',
  brass: '#d9a441',
  brassBright: '#f2c96b',
  brassDim: '#8a6526',
  ivory: '#f1e4c8',
  ivoryDim: '#c7b795',
  red: '#e8484f',
  redDeep: '#8d1f2a',
  redGlow: 'rgba(232, 72, 79, 0.85)',
  green: '#69c9a2',
  smoke: '#b8c4c9',
  shadow: 'rgba(2, 7, 10, 0.45)',
};

export const ACT_META = [
  { numeral: 'I', act: 'The Atrium', house: 'Meridian House', hour: '11:47 PM' },
  { numeral: 'II', act: 'The Archive', house: 'The West Wing', hour: '12:26 AM' },
  { numeral: 'III', act: 'The Vault', house: 'Below Meridian', hour: '12:58 AM' },
];
