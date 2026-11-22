// Boot, screen flow and the one fixed-timestep loop. Four screens wrap the acts:
// title, briefing, play, and the caught or victory card.

import { STEP } from './config.js';
import { createLevel } from './levels.js';
import { createWorld, updateWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './renderer3d.js';
import { SHOT_LEVEL, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);
await renderer.ready;
if (document.fonts?.ready) await document.fonts.ready;

let actIndex = 0;
let world = createWorld(createLevel(actIndex));
let screen = 'title';
let paused = false;
let blueprint = false;
let sceneTime = 0;
let last = performance.now();
let accumulator = 0;
let totals = { spotted: 0, hacks: 0, time: 0, alarmsTriggered: 0 };
let announcedCaught = false;

function announce(message) {
  statusLine.textContent = message;
}

function makeWorld(index) {
  return createWorld(createLevel(index));
}

function beginBriefing() {
  world = makeWorld(actIndex);
  screen = 'briefing';
  announce(`Act ${actIndex + 1}: ${world.level.title}. ${world.level.brief}`);
}

function beginAct() {
  world = makeWorld(actIndex);
  screen = 'play';
  paused = false;
  blueprint = false;
  accumulator = 0;
  announcedCaught = false;
  audio.ensure();
  announce(`Playing act ${actIndex + 1}, ${world.level.title}. Objective: steal ${world.level.loot.name}.`);
}

function nextAct() {
  totals.spotted += world.stats.spotted;
  totals.hacks += world.stats.hacks;
  totals.time += world.stats.time;
  totals.alarmsTriggered += world.stats.alarmsTriggered;
  if (actIndex < 2) {
    actIndex += 1;
    beginBriefing();
  } else {
    screen = 'victory';
    announce(`The Gilded Hour is complete. Time ${Math.round(totals.time)} seconds, seen ${totals.spotted} times.`);
  }
}

function retryAct() {
  beginBriefing();
}

function uiAction() {
  audio.ensure();
  audio.ui();
  if (screen === 'title') {
    actIndex = 0;
    totals = { spotted: 0, hacks: 0, time: 0, alarmsTriggered: 0 };
    beginBriefing();
    return;
  }
  if (screen === 'briefing') {
    beginAct();
    return;
  }
  if (screen === 'caught') {
    retryAct();
    return;
  }
  if (screen === 'victory') {
    screen = 'title';
    world = makeWorld(0);
    announce('The Gilded Hour. Press Enter to begin.');
  }
}

function update(dt) {
  sceneTime += dt;
  if (screen === 'play') {
    const aim = input.mouse.inside ? renderer.toWorld(input.mouse.clientX, input.mouse.clientY) : null;
    updateWorld(world, dt, input, aim, audio);
    if (world.phase === 'caught' && !announcedCaught) {
      announcedCaught = true;
      screen = 'caught';
      blueprint = false;
      world.blueprint = false;
      audio.caught();
      announce(`Caught by ${world.caughtBy}. Press Enter to try again.`);
    } else if (world.phase === 'escaped') {
      nextAct();
    }
  }
}

function frame(now) {
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (input.wasPressed('KeyM')) {
    audio.setMuted(!audio.isMuted());
    announce(audio.isMuted() ? 'Sound muted.' : 'Sound on.');
  }
  if (input.wasPressed('KeyP') && screen === 'play') {
    paused = !paused;
    announce(paused ? 'Paused.' : 'Resumed.');
  }
  if (input.wasPressed('Tab') && screen === 'play' && !paused) {
    blueprint = !blueprint;
    world.blueprint = blueprint;
    announce(blueprint ? 'Service plan opened. Tab closes it.' : 'Service plan closed.');
  }
  if (input.wasPressed('Enter') || input.wasPressed('Space') || input.takeClick()) {
    if (screen !== 'play' || paused) uiAction();
  }

  if (!paused && screen === 'play' && !blueprint) {
    accumulator += raw;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      update(STEP);
      accumulator -= STEP;
      steps += 1;
    }
  } else {
    sceneTime += raw;
  }

  renderer.draw(world, paused ? 'paused' : screen, sceneTime, totals);
  input.endFrame();
  requestAnimationFrame(frame);
}

function runShot() {
  const index = SHOT_LEVEL[shotName] ?? 0;
  world = makeWorld(index);
  stageShot(world, shotName);
  if (shotName === 'blueprint') world.blueprint = true;
  screen = 'play';
  let painted = 0;
  renderer.draw(world, screen, world.time, world.stats);
  function paint() {
    renderer.draw(world, screen, world.time, world.stats);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shotName) {
  runShot();
} else {
  announce('The Gilded Hour. Press Enter to begin.');
  requestAnimationFrame(frame);
}
