# 🍺 Poisoned Pints

A fantasy tavern game of strategy, chaos and mystery, playable in the browser on phone or laptop.

You run a tavern in the city of Ashveil. **By day** you drag your crew to jobs: the bar, the door, or the mission map to sneak into rival taverns. **By night** you play live: serve guests, catch hooded spies sneaking into *your* tavern, and pick up the clues they drop. **In the morning** you see what happened and use your clues to accuse the rival behind each attack.

## Play
**Live:** https://hratika-23.github.io/Poisoned-Pints/

## Project layout
| Path | What it is |
|---|---|
| `index.html` | Animated home page |
| `play/index.html` | The game: 3D tavern room, day planning, live night, morning report |
| `play/engine.js` | Rules engine (no graphics): staff & quirks, missions, blind all-pay bribes, fair clues, accusations, traitors, bot personalities, comeback rules. |
| `play/net.js` | Online rooms. The host's phone is the referee: it runs the engine and sends each player only what they're allowed to see. Messages travel through a free public MQTT relay (HiveMQ, with EMQX as backup), so there is no server to run or pay for. |
| `play/mqtt.min.js` | MQTT.js 5 (MIT licence), bundled so the game doesn't depend on a CDN |
| `archive/` | Earlier versions kept for reference: `classic/` (menu-based), `prototype/` (first 3D look test), `realtime-minigames.html` (sneak/brawl/pickpocket mini-games) |

## Tech
Plain HTML/JS + [Three.js r128](https://threejs.org/) from a CDN. No build step, no server. Hosted free on GitHub Pages.

## Roadmap
1. ~~Online multiplayer with room codes~~ ✅ done (2–5 players, bots fill empty seats, rejoin after a reload)
2. Mini-games for your own missions (sneak, brawl, pickpocket)
3. More events, staff and tavern upgrades
