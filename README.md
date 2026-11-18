# 🍺 Poisoned Pints

A 2–5 player fantasy tavern game of strategy, chaos and mystery, playable in the browser on phone or laptop.

Run a rival tavern in the city of Ashveil. Hire shady staff, send them to poison, rob and brawl at rival taverns, and secretly bribe the Guard Captain. Every attack is anonymous: use fair clues to work out who hit you, and watch out for traitors in your own crew.

## Play
- **Live:** https://hratika-23.github.io/Poisoned-Pints/
- `/play/` – **the main game**: your 3D tavern room. Day: drag crew to the bar, door or mission map. Night (live): serve guests, catch hooded spies, collect clues. Morning: results + evidence board.
- `/prototype/` – the first close-up 3D day screen (drag crew onto rivals, drag coins onto the Captain, tap crew to talk, night preview)
- `/game/` – the full playable game: 7 nights vs bots, tutorial mode, case file, crew moods & quirks, comeback mechanics

## Project layout
| Path | What it is |
|---|---|
| `game/engine.js` | Rules engine (no graphics): staff, missions, blind all-pay bribes, fair clues, accusations, traitors, bot personalities. Ready to run on a multiplayer server later. |
| `game/index.html` | Full game UI (built from `game-src/`) |
| `game-src/` | Source parts of the game UI (`head.html` + `core.js` + `game.js`) |
| `prototype/index.html` | New chunky 3D day-screen prototype |
| `archive/` | Parked real-time version with sneak/brawl/pickpocket mini-games |

## Tech
Plain HTML/JS + [Three.js r128](https://threejs.org/) from a CDN. No build step and no server needed. Hosted free on GitHub Pages.

## Roadmap
1. Bring the full game onto the new 3D look
2. Night scenes and optional mini-games
3. Online multiplayer (room codes, reconnect, bots fill empty seats)
