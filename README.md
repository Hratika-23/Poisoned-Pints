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
| `play/engine.js` | Rules engine (no graphics): staff & quirks, missions, blind all-pay bribes, fair clues, accusations, traitors, bot personalities, comeback rules. Ready to run on a multiplayer host later. |
| `archive/` | Earlier versions kept for reference: `classic/` (menu-based), `prototype/` (first 3D look test), `realtime-minigames.html` (sneak/brawl/pickpocket mini-games) |

## Tech
Plain HTML/JS + [Three.js r128](https://threejs.org/) from a CDN. No build step, no server. Hosted free on GitHub Pages.

## Roadmap
1. Online multiplayer with room codes (friends play their own taverns; bots fill empty seats)
2. Mini-games for your own missions (sneak, brawl, pickpocket)
3. More events, staff and tavern upgrades
