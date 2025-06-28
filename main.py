import json
import random
import sys
import os

# --- FILE PATHS & SETUP ---

# Get the directory where the script is located to build robust paths
script_dir = os.path.dirname(os.path.abspath(__file__))
# Corrected path to use 'docs' for GitHub Pages compatibility
DOCS_DIR = os.path.join(script_dir, 'docs')

# Ensure the docs directory exists, create it if it doesn't
os.makedirs(DOCS_DIR, exist_ok=True)

CONFIG_PATH = os.path.join(script_dir, 'game_config.json')
PLAYER_PATH = os.path.join(script_dir, 'player.json')
# Corrected output path to place the results in the 'docs' folder
OUTPUT_PATH = os.path.join(DOCS_DIR, 'player_result.json')

# --- DATA LOADING ---

try:
    # Load game configuration and player state
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)

    with open(PLAYER_PATH, 'r') as f:
        player = json.load(f)
except FileNotFoundError as e:
    print(f"Error: Could not find a required game file: {e.filename}")
    sys.exit(1)


# --- GAME CONSTANTS & HELPERS ---

# Extract constants from config for easier access
START_AGE = config['ages']['startAge']
REBIRTH_AGE = config['ages']['rebirthAge']
MAX_AGE = config['ages']['maxAge']

# Night event flavor text for atmospheric logs
EVENT_FLAVOR = {
    "Villager lynch patrol": "Drunken villagers roam with torches, searching for signs of the beast.",
    "Wolf hunt opportunity": "You spot fresh tracks leading deeper into the woods.",
    "Witch circle sighting": "Flickers of firelight illuminate cloaked figures in the glade.",
    "Full moon transformation": "Your bones ache and twist beneath the silver light.",
}

XP_GAIN = 5
COIN_GAIN = 10

def get_job(job_name):
    """Finds a job dictionary from the config by its name."""
    for job in config['jobs']:
        if job['name'] == job_name:
            return job
    return None

def skill_name_from_produce(produce_str):
    """Converts a job's 'produces' string (e.g., 'strengthXP') into a skill name (e.g., 'Strength')."""
    if produce_str.lower().endswith('xp'):
        base = produce_str[:-2]
        return base.replace('_', ' ').title()
    return produce_str.title()


# --- CORE SIMULATION LOGIC ---

def apply_job_rewards(player_state):
    """Calculates and applies coin and XP gains based on the player's active job."""
    if not player_state.get('activeJob'):
        return {}, 0
        
    job = get_job(player_state['activeJob'])
    if not job:
        return {}, 0
        
    skill_changes = {}
    coin_gain = 0
    
    for item in job.get('produces', []):
        if item.lower() == 'coins':
            player_state['coins'] += COIN_GAIN
            coin_gain += COIN_GAIN
        elif item.lower().endswith('xp'):
            skill = skill_name_from_produce(item)
            # This updates the simple dictionary in player.json for internal tracking.
            # The frontend handles the more complex skill state.
            player_state['skills'][skill] = player_state['skills'].get(skill, 0) + XP_GAIN
            skill_changes[skill] = XP_GAIN
            
    return skill_changes, coin_gain

def trigger_night_event():
    """30% chance to trigger a random night event from the config."""
    if random.random() < 0.3:
        return random.choice(config.get('nightEvents', []))
    return None

def check_rebirth(player_state):
    """Checks if the player has reached rebirth age and resets them."""
    if player_state['age'] >= REBIRTH_AGE:
        player_state['rebirths'] += 1
        print(f"Rebirth #{player_state['rebirths']} at age {player_state['age']}")
        player_state['age'] = START_AGE
        # In a real game, you would also reset skills, coins, etc.
        return True
    return False

def check_prestige(player_state):
    """Checks if the player meets the conditions for prestige at max age."""
    if player_state['age'] >= MAX_AGE:
        reqs = config['reputation']['requirements']
        # Find the prestige requirement, assuming it's the last one.
        prestige_req = next((r for r in reqs if r['role'] == 'Moonborne Entity'), None)
        
        if prestige_req and \
           player_state['repVillage'] >= int(prestige_req['repVillage'].split('>=')[1]) and \
           player_state['repWolf'] >= int(prestige_req['repWolf'].split('>=')[1]) and \
           player_state['curseLevel'] >= int(prestige_req['curseLevel'].split('>=')[1]):
            player_state['prestigeUnlocked'] = True
            print('Prestige achieved! You have become a Moonborne Entity.')
        else:
            print('Max age reached but requirements not met for prestige.')
        return True
    return False

def simulate_day(day, player_state):
    """Simulates a single day, returning a log of what happened."""
    print(f"\nDay {day} - Age {player_state['age']}")
    
    skill_changes, coin_gain = apply_job_rewards(player_state)
    
    for skill, gained in skill_changes.items():
        print(f"  {skill}: +{gained} XP (total {player_state['skills'][skill]})")
    if coin_gain:
        print(f"  Coins: +{coin_gain} (total {player_state['coins']})")
        
    event = trigger_night_event()
    if event:
        flavor = EVENT_FLAVOR.get(event, '')
        print(f"  Night Event: {event} — {flavor}")
        
    player_state['age'] += 1
    
    # Check for major life events
    if check_rebirth(player_state):
        # Stop simulation for this life if reborn
        return None 
    if check_prestige(player_state):
        # Stop simulation if prestige is achieved or max age is hit
        return None

    return {
        "day": day,
        "age": player_state['age'],
        "coins": player_state['coins'],
        "coinGain": coin_gain,
        "skillChanges": skill_changes,
        "event": event,
    }

# --- SCRIPT EXECUTION ---

if __name__ == '__main__':
    day_logs = []
    day = 1
    
    print("--- Starting Lupus Ascendancy Simulation ---")
    
    # Simulate for a year or until a major life event ends the simulation
    while day <= 365:
        log_entry = simulate_day(day, player)
        if log_entry is None or player.get('prestigeUnlocked'):
            break 
        
        day_logs.append(log_entry)
        day += 1

    # Save results for the web viewer
    try:
        with open(OUTPUT_PATH, 'w') as out_file:
            json.dump(day_logs, out_file, indent=2)
        print(f"\n--- Simulation Complete ---")
        print(f"Saved {len(day_logs)} days of logs to {OUTPUT_PATH}")
    except IOError as e:
        print(f"Error: Could not write to output file at {OUTPUT_PATH}: {e}")
