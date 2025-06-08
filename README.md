# Lupus Ascendancy

A werewolf-themed idle life simulator inspired by Progress Knight.  
You begin as a simple villager—or cursed soul—and evolve across lifetimes toward your final form: the Moonborne Entity.

### Core Features
- Dynamic job and skill trees (human & werewolf)
- Dual-path reputation system
- Aging, rebirth, and prestige
- Night events and curse progression

### Project Files
- `agent.md` — Codex instructions for simulation behavior
- `game_config.json` — Core game definitions (jobs, skills, prestige)
- `player.json` — Player save state template
- `main.py` — Simulation script (to be developed)

### Deployment
This game can be hosted using GitHub Pages or run via Python CLI tools.
### Web UI
The `web/` folder hosts a simple viewer built with HTML, CSS, and JavaScript. It runs an automated loop to display each day from `player_result.json`, and includes an image placeholder located at `web/assets/lupus_ui_mockup.png`.
