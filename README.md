# The Gilded Hour

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/trolloks/gilded-hour/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/trolloks/gilded-hour/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**The Gilded Hour** is a complete 3D browser heist game set in Meridian House, 1936. Cross three art-deco floors, read the guards' sweeping vision cones, slip the cameras, cut the laser seams, take the stone, and reach the lift. It runs offline from static files: no network request, no build step.

The room, characters, furniture, sight cones, interface and score are built in code. The floor and wall textures are free CC0 scans from ambientCG, the display face is Cinzel (SIL OFL), and the renderer is [three.js](https://threejs.org) vendored under `game/vendor/` — see [ASSETS.md](ASSETS.md).

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Move with **WASD**, run with **Shift**, sneak with **Ctrl**, interact with **E**, throw smoke with **Q**, fire an EMP with **F**, toss a decoy with **R**, and open the service plan with **Tab**. The alarm gauge is the health bar: stay out of the light.

## How it is put together

| File | Job |
| --- | --- |
| `game/src/levels.js` | the three acts: walls, cover, shadow pockets, patrols, cameras, lasers, terminals and loot |
| `game/src/world.js` | the simulation: interactions, laser trips, exit, alarm and act flow |
| `game/src/guards.js` | patrol, suspicion, investigation, chase and search |
| `game/src/cameras.js` | sweeping cones, smoke blindness and EMP downtime |
| `game/src/alarm.js` | the shared alarm, its decay and the caught state |
| `game/src/tools.js` | smoke, EMP and decoy effects and their costs |
| `game/src/renderer3d.js` | the three.js room, lights, characters, cones, smoke and camera |
| `game/src/hud.js` | alarm gauge, act card, tool belt, prompts and the title/briefing/caught/victory cards |
| `game/src/audio.js` | the synthesised score and cues (Web Audio, no files) |

`main.ts` copies `game/` and `screenshots/` into the grader's output directory and writes `dossier.json` with the kit's `buildDossier`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
