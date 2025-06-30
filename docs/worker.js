// This script runs in the background and is not affected by tab throttling.

// --- WORKER STATE ---
let gameConfig = {};
let playerState = {};
let legacyState = {};
let skillsState = {};
let gameLoopInterval = null;

const TICK_INTERVAL = 200;
const TICKS_PER_DAY = 24;
const YEARS_PER_TICK = 0.008;

// --- CORE LOGIC (MOVED FROM MAIN SCRIPT) ---

function getEffectiveMaxAge() {
    let maxAge = gameConfig.ages.maxAge;
    if (playerState.currentHousingTier > -1) {
        for (let i = 0; i <= playerState.currentHousingTier; i++) {
            maxAge += gameConfig.housingTiers[i].maxAgeBonus;
        }
    }
    return maxAge;
}

function gainSkillXp(skillName, xpGain, ignoreBonus = false) {
    if (!skillsState[skillName]) return;
    const skill = skillsState[skillName];
    
    // Check for the new Tome of Experience talent
    const tomeLevel = (legacyState.purchasedTalents && legacyState.purchasedTalents['tome_of_experience']) || 0;
    let finalXpGain = xpGain * (1 + (tomeLevel * 0.1));

    if (ignoreBonus) {
        finalXpGain = xpGain;
    }
    
    skill.xp += finalXpGain;

    let leveledUp = false;
    while (skill.xp >= skill.xpToNext) {
        skill.xp -= skill.xpToNext;
        skill.level += 1;
        skill.xpToNext = Math.round(skill.xpToNext * 1.5);
        leveledUp = true;
    }
    
    if (leveledUp) {
        // Notify the main thread that jobs need re-rendering
        self.postMessage({ type: 'NEEDS_JOB_RENDER' });
    }
}

function skillNameFromProduce(str) { return str.toLowerCase().endsWith('xp') ? str.slice(0, -2).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : str.replace(/\b\w/g, l => l.toUpperCase()); }

function applyJobRewards() {
    if (!playerState.activeJob) return;
    const job = gameConfig.jobs.find(j => j.name === playerState.activeJob);
    if (!job) return;
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    const jobIsActiveNow = (job.type === 'human' && !isNight) || (job.type === 'werewolf' && isNight);
    if (!jobIsActiveNow) return;

    // Use the new coinGain property from the job, default to 1 if not specified
    let coinGain = job.coinGain || 1;
    const xpGain = 0.5;
    const primalGreedLevel = legacyState.purchasedTalents ? legacyState.purchasedTalents['primal_greed'] || 0 : 0;
    if (primalGreedLevel > 0) coinGain *= (1 + (primalGreedLevel * 0.1));

    for (const item of job.produces) {
        if (item === 'coins') playerState.coins += coinGain;
        else if (item.endsWith('XP')) gainSkillXp(skillNameFromProduce(item), xpGain);
    }
    
    if (job.reputationEffects) {
        let { repVillage: vRep = 0, repWolf: wRep = 0 } = job.reputationEffects;
        const humanityCharmLevel = legacyState.purchasedTalents ? legacyState.purchasedTalents['humanity_charm'] || 0 : 0;
        const feralAffinityLevel = legacyState.purchasedTalents ? legacyState.purchasedTalents['feral_affinity'] || 0 : 0;
        if(vRep > 0 && humanityCharmLevel > 0) vRep *= (1 + (humanityCharmLevel * 0.1));
        if(wRep > 0 && feralAffinityLevel > 0) wRep *= (1 + (feralAffinityLevel * 0.1));
        playerState.repVillage += vRep / 10;
        playerState.repWolf += wRep / 10;
    }
}

function triggerNightEvent() {
    if (playerState.day % TICKS_PER_DAY !== 0) return null;

    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    if (!isNight) return null;
    const currentJob = gameConfig.jobs.find(j => j.name === playerState.activeJob);
    if (!currentJob) return null;

    if (currentJob.name === 'Seer' && Math.random() < 0.5) return { type: "Seer's Vision", flavor: "You gaze into the stars..." };
    if (currentJob.type === 'werewolf' && Math.random() < 0.4) {
        return Math.random() < 0.7 
            ? { type: "Successful Hunt", flavor: "The thrill of the hunt...", effects: { repWolf: 2, repVillage: -1 } }
            : { type: "Failed Hunt", flavor: "The prey was too swift." };
    }
    if (Math.random() < 0.2) {
        const eventTemplate = gameConfig.nightEvents[Math.floor(Math.random() * gameConfig.nightEvents.length)];
        const jobType = currentJob.type;
        const outcome = eventTemplate.effects ? eventTemplate.effects[jobType] : null;
        if (outcome) return { type: eventTemplate.name, flavor: outcome.flavor || eventTemplate.flavor, effects: { ...outcome } };
        return { type: eventTemplate.name, flavor: eventTemplate.flavor, effects: {} };
    }
    return null;
}


function gameTick() {
    const effectiveMaxAge = getEffectiveMaxAge();
    if (playerState.age >= gameConfig.ages.rebirthAge || playerState.age >= effectiveMaxAge) {
        self.postMessage({ type: 'SHOW_REBIRTH_MODAL', payload: { cause: playerState.age >= effectiveMaxAge ? "old_age" : "choice" } });
        clearInterval(gameLoopInterval);
        gameLoopInterval = null;
        return;
    }
    playerState.day++;
    playerState.age += YEARS_PER_TICK;

    applyJobRewards();
    const event = triggerNightEvent();
    if (event) {
        if (event.effects) {
            let { repVillage: vRep = 0, repWolf: wRep = 0, curseLevel: cLvl = 0 } = event.effects;
            const humanityCharmLevel = legacyState.purchasedTalents ? legacyState.purchasedTalents['humanity_charm'] || 0 : 0;
            const feralAffinityLevel = legacyState.purchasedTalents ? legacyState.purchasedTalents['feral_affinity'] || 0 : 0;
            if(vRep > 0 && humanityCharmLevel > 0) vRep *= (1 + (humanityCharmLevel * 0.1));
            if(wRep > 0 && feralAffinityLevel > 0) wRep *= (1 + (feralAffinityLevel * 0.1));
            playerState.repVillage += vRep;
            playerState.repWolf += wRep;
            playerState.curseLevel += cLvl;
        }
        self.postMessage({ type: 'EVENT_TRIGGERED', payload: event });
    } else {
        self.postMessage({ type: 'CLEAR_EVENT' });
    }

    // Send the updated state back to the main thread for UI rendering
    self.postMessage({ type: 'UPDATE', payload: { playerState, skillsState, legacyState } });
}


// --- MESSAGE HANDLING ---

self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'START':
            gameConfig = payload.gameConfig;
            playerState = payload.playerState;
            skillsState = payload.skillsState;
            legacyState = payload.legacyState;
            
            playerState.completedJobs = new Set(playerState.completedJobs);

            if (!gameLoopInterval) {
                gameLoopInterval = setInterval(gameTick, TICK_INTERVAL);
            }
            break;
        case 'STOP':
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
            break;
        case 'SET_JOB':
            playerState.activeJob = payload.jobName;
            playerState.completedJobs.add(payload.jobName);
            break;
        case 'PURCHASE_HOUSING':
            {
                const tierIndex = payload.tierIndex;
                if (tierIndex === playerState.currentHousingTier + 1) {
                    const tier = gameConfig.housingTiers[tierIndex];
                    if (tier && playerState.coins >= tier.cost) {
                        playerState.coins -= tier.cost;
                        playerState.currentHousingTier = tierIndex;
                    }
                }
            }
            break;
        case 'PURCHASE_TALENT':
            {
                const talentId = payload.talentId;
                const talent = gameConfig.talents.find(t => t.id === talentId);
                if (talent) {
                    const currentLevel = legacyState.purchasedTalents[talentId] || 0;
                    if (currentLevel < talent.maxLevel && legacyState.bloodEchoes >= talent.cost) {
                        legacyState.bloodEchoes -= talent.cost;
                        legacyState.purchasedTalents[talentId] = currentLevel + 1;
                    }
                }
            }
            break;
        case 'PERFORM_REBIRTH':
            {
                const totalLevels = Object.values(skillsState).reduce((sum, skill) => sum + skill.level, 0);
                const echoesGained = 1 + Math.floor(totalLevels / 5);
                legacyState.rebirths = (legacyState.rebirths || 0) + 1;
                legacyState.bloodEchoes = (legacyState.bloodEchoes || 0) + echoesGained;

                playerState = {
                    day: 0,
                    age: gameConfig.ages.startAge,
                    coins: 0,
                    completedJobs: new Set(['Simple Villager']),
                    activeJob: 'Simple Villager',
                    repVillage: 0,
                    repWolf: 0,
                    curseLevel: 0,
                    currentHousingTier: -1,
                };
                skillsState = JSON.parse(JSON.stringify(gameConfig.skillDefinitions));
                
                const lingeringKnowledge = legacyState.purchasedTalents ? legacyState.purchasedTalents['lingering_knowledge'] : 0;
                if (lingeringKnowledge) {
                    const talentInfo = gameConfig.talents.find(t => t.id === 'lingering_knowledge');
                    for(const skill in skillsState) {
                        gainSkillXp(skill, talentInfo.value, true);
                    }
                }
                
                if (!gameLoopInterval) {
                    gameLoopInterval = setInterval(gameTick, TICK_INTERVAL);
                }
            }
            break;
    }
};
