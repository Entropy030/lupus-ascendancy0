import json
import random

# Load game configuration and player state
with open('game_config.json', 'r') as f:
    config = json.load(f)

with open('player.json', 'r') as f:
    player = json.load(f)

start_age = config['ages']['startAge']
rebirth_age = config['ages']['rebirthAge']
max_age = config['ages']['maxAge']

# Night event flavor text for atmospheric logs
EVENT_FLAVOR = {
    "Villager lynch patrol": "Drunken villagers roam with torches, searching for signs of the beast.",
    "Wolf hunt opportunity": "You spot fresh tracks leading deeper into the woods.",
    "Witch circle sighting": "Flickers of firelight illuminate cloaked figures in the glade.",
    "Full moon transformation": "Your bones ache and twist beneath the silver light.",
}

def get_job(job_name):
    for job in config['jobs']:
        if job['name'] == job_name:
            return job
    return None

# Simple conversion from produced XP label to skill name
def skill_name_from_produce(produce):
    if produce.lower().endswith('xp'):
        base = produce[:-2]
        return base.title().replace('_', ' ')
    return produce.title()

XP_GAIN = 5
COIN_GAIN = 10

def apply_job_rewards(player):
    if not player.get('activeJob'):
        return {}, 0
    job = get_job(player['activeJob'])
    if not job:
        return {}, 0
    skill_changes = {}
    coin_gain = 0
    for item in job.get('produces', []):
        if item.lower() == 'coins':
            player['coins'] += COIN_GAIN
            coin_gain += COIN_GAIN
        elif item.lower().endswith('xp'):
            skill = skill_name_from_produce(item)
            old = player['skills'].get(skill, 0)
            player['skills'][skill] = old + XP_GAIN
            skill_changes[skill] = XP_GAIN
    return skill_changes, coin_gain

def trigger_night_event():
    if random.random() < 0.3:
        return random.choice(config.get('nightEvents', []))
    return None

def check_rebirth(player):
    if player['age'] >= rebirth_age:
        player['rebirths'] += 1
        print(f"Rebirth #{player['rebirths']} at age {player['age']}")
        player['age'] = start_age
        return True
    return False

def check_prestige(player):
    if player['age'] >= max_age:
        if (
            player['repVillage'] >= 30
            and player['repWolf'] >= 60
            and player['curseLevel'] >= 100
        ):
            player['prestigeUnlocked'] = True
            print('Prestige achieved!')
        else:
            print('Max age reached but requirements not met for prestige.')
        return True
    return False

day_logs = []

def simulate_day(day, player):
    print(f"\nDay {day} - Age {player['age']}")
    skill_changes, coin_gain = apply_job_rewards(player)
    for skill, gained in skill_changes.items():
        print(f"  {skill}: +{gained} XP (total {player['skills'][skill]})")
    if coin_gain:
        print(f"  Coins: +{coin_gain} (total {player['coins']})")
    event = trigger_night_event()
    if event:
        flavor = EVENT_FLAVOR.get(event, '')
        print(f"  Night Event: {event} — {flavor}")
    player['age'] += 1
    if check_rebirth(player):
        return
    check_prestige(player)
    day_logs.append({
        "day": day,
        "age": player['age'],
        "coins": player['coins'],
        "coinGain": coin_gain,
        "skillChanges": skill_changes,
        "event": event,
    })

if __name__ == '__main__':
    # Example simulation: run until prestige unlocked or 365 days
    day = 1
    while day <= 365 and not player.get('prestigeUnlocked'):
        simulate_day(day, player)
        day += 1

    # Save results for web viewer
    with open('web/player_result.json', 'w') as out:
        json.dump(day_logs, out, indent=2)

