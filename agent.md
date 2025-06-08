## UI and Visualization Layer

The game includes a browser-based frontend located in the `web/` directory, which displays the current player state in real time.

### Goals:
- Automatically simulate the passage of time (1 tick ≈ 1 day)
- Display the player’s age, coins, XP, current job, and night events
- Animate XP and coin progression using styled progress bars
- Support both desktop and mobile viewports using responsive design
- Display thematic elements (e.g. moon phase icon, flavor text)

### Structure:
- `index.html` — Main structure
- `style.css` — Theme and layout, using dark forest aesthetics
- `script.js` — Idle loop logic and DOM updates
- `player_result.json` — Used for mock/testing visualization data

The UI will be expanded to include animations, flavor text effects, and responsive layout.
Once you add that, Codex will have the full mental map of your current architecture, which means its generated HTML/CSS/JS will match your intent more closely.

Would you like me to write this directly into your agent.md or give you a ready-to-paste version of the updated full file?






You said:
yes give me a ready to copy paste version of the updated agend.md


ChatGPT said:
Here’s your updated full agent.md, ready to copy and paste:

markdown
Copy
Edit
# Agent Instruction: Lupus Ascendancy

## Purpose
Simulate a life-based idle game with werewolf and human progression mechanics. The agent manages player state, job progression, skill XP gain, reputation updates, night events, and rebirth/prestige transitions.

---

## Data Structures

Game config is defined in a JSON file including:
- **jobs**: list of roles with XP/coin output and requirements
- **skills**: categorized XP types
- **reputation**: two-path alignment (`repVillage`, `repWolf`) affected by actions
- **nightEvents**: randomized or triggered nightly happenings
- **prestige**: system based on age and conditions

---

## Player State

```ts
interface Player {
  age: number;
  coins: number;
  skills: Record<string, number>; // e.g. { "Tracking": 12 }
  activeJob: string | null;
  repVillage: number;
  repWolf: number;
  curseLevel: number;
  rebirths: number;
  prestigeUnlocked: boolean;
}
Game Loop Logic
Time advances by day (or hour)

During the day:

Active job provides XP and coins

During the night:

30% chance for a night event

Some events increase curse level or change reputation

Player ages by 1 per tick

Rebirth possible at rebirthAge (e.g., 70)

Prestige possible at maxAge (e.g., 200) if reputation and curse conditions are met

Codex Tasks
Codex should:

Parse game_config.json and player.json

Simulate daily progression and event handling

Update and save player_result.json

Help generate or modify the game’s visual interface

UI and Visualization Layer
The game includes a browser-based frontend located in the web/ directory.

Goals:
Automatically simulate the passage of time (1 tick ≈ 1 day)

Display the player’s age, coins, XP, current job, and night events

Animate XP and coin progression using styled progress bars

Support both desktop and mobile viewports using responsive design

Display thematic elements (e.g. moon phase icon, flavor text)

Structure:
index.html — Main structure

style.css — Theme and layout, using dark forest aesthetics

script.js — Idle loop logic and DOM updates

player_result.json — Used for mock/testing visualization data

The UI will be expanded to include animations, flavor text effects, and responsive layout.

Optional Extensions
Background art + parallax scroll

Audio effects on prestige / moon transformation

Job selector and active skill upgrades

Save/load persistent player state

yaml
Copy
Edit

---

You can now paste this into `agent.md` and safely proceed with the visual UI prompt you asked for earlier.

Let me know when you’re ready to iterate on the CSS/theme or want a mobile layout test.