# Agent Instruction: Lupus Ascendancy

## Purpose
Simulate a life-based idle game with werewolf and human progression mechanics. The agent manages player state, job progression, skill XP gain, reputation alignment, night events, rebirths, and prestige transitions.

---

## Data Structures

Game config is defined in a JSON file including:

- **jobs**: roles with XP/coin output, unlock conditions, and alignment (day/night)
- **skills**: categorized into `general` and `job-specific`
- **reputation**: dual-path alignment (`repVillage`, `repWolf`) affected by choices
- **nightEvents**: dynamic or conditional nightly events (e.g., blood moon, visions)
- **prestige**: life-reset system unlocking permanent bonuses

---

## Player State

```ts
interface Player {
  age: number;
  coins: number;
  skills: Record<string, Skill>; // e.g., { "Tracking": { level: 12, xp: 340 } }
  activeJob: string | null;
  repVillage: number;
  repWolf: number;
  curseLevel: number;
  rebirths: number;
  prestigeUnlocked: boolean;
  housingTier: number;
  relics: string[]; // optional boosts
}
Game Loop Logic
Time advances by day (1 tick = 1 day):

During the day:

Active job yields coins + job-specific skill XP

General skills (e.g., Discipline, Awareness) may also passively gain XP

Day visuals and sounds active

During the night:

30% base chance for a night event

Events can raise curse, trigger werewolf path, or reveal lore

Some jobs only work at night (e.g., Nightwalker, Seer)

Werewolf form may activate if curse is high

Each tick:

Player ages by 1

XP, coin gains, and event resolutions are handled

Transformation triggers, rep updates, or rebirth conditions checked

Prestige & Rebirth
Rebirth: Happens at rebirthAge (e.g., 70), restarts life, retains partial XP

Prestige: Happens at maxAge (e.g., 200) if conditions met (e.g., balance rep + curse)

Prestige unlocks permanent bonuses (e.g., XP multiplier, new relic slot)

UI and Visualization Layer
The game includes a browser-based frontend located in the web/ directory.

Goals:
Simulate passage of time automatically (1 tick = 1 day)

Display player stats: age, coins, current job, XP, night events

Animate XP and coin progression via progress bars

Reflect moon phase and curse visually (e.g., background, blood moon)

Support mobile and desktop viewports with responsive layout

Structure:
index.html — UI layout (tabs: Stats, Skills, Events, Lore)

style.css — Base theme, card layout, progress bar style

moon_theme.css — Day/night background + progress bar variations

moon_theme.js — Tick-based visual logic, moon icon rotation

script.js — Core simulation + DOM updates

player_result.json — Mock/test data for rendering

UI uses a tabbed card system. Day/night themes toggle with opacity adjustments (e.g., .card { opacity: 0.3 } in day). Progress bars are golden during the day and blood-red at night.

Planned Additions:
Skill trees with general/job categories

Rebirth/prestige UI feedback

Job unlock conditions + selectors

Lore unlock via event chain

Background upgrades (housing), item relics

Optional Extensions
Parallax scroll forest backgrounds

Dynamic audio for moon phase, events, and prestige

Transformation effects (curse threshold visual)

Save/load persistent state to local storage