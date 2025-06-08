# Agent Instruction: Lupus Ascendancy

## Purpose
Simulate a life-based idle game with werewolf and human progression mechanics. The agent manages player state, job progression, skill XP gain, reputation updates, night events, and rebirth/prestige transitions.

---

## Data Structures

Game config is defined in a JSON file (see `Werewolf Progress Knight`) including:
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
```

---

## Game Loop Logic

- Time advances by day (or hour)
- During the day: active job provides XP and coins
- During the night:
  - Chance of event from `nightEvents`
  - Possible transformations or curse gain
- Age increases daily
- At `rebirthAge` (70+), allow rebirth with XP multipliers
- At `maxAge` (200), allow prestige if all requirements met

---

## Codex Tasks

Codex should:
1. Parse game config JSON
2. Initialize `Player` object
3. On each tick:
   - Apply job rewards (XP/coins)
   - Trigger night event if applicable
   - Update reputation based on job/event
   - Age the player
4. Handle rebirth and prestige logic
5. Output player state (for display or logging)

---

## Visual Style

The visual theme should reflect the tone and palette of the attached concept image (e.g., dusk-lit forest, muted tones, vintage illustration style). Future UI components or splash screens should draw on this mood board to maintain thematic consistency.