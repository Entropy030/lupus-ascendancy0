// --- GLOBAL STATE & CONSTANTS ---

const MOON_PHASES = ["🌕"];
const SUN_PHASES = ["☀️"];
const TICK_INTERVAL = 2000;
const TICKS_PER_DAY = 24;
const YEARS_PER_TICK = 0.08;

let gameConfig = {};
let playerState = {};
let legacyState = {
    rebirths: 0,
    bloodEchoes: 0,
    purchasedTalents: {}, 
};

let skillsState = {};
let gameLoopInterval = null;
let visualTheme = 'auto';

function $(id) {
    return document.getElementById(id);
}

// --- SAVE & LOAD ---

function saveGame() {
    localStorage.setItem('lupus_legacy_save', JSON.stringify(legacyState));
}

function loadGame() {
    const savedData = localStorage.getItem('lupus_legacy_save');
    if (savedData) {
        const loadedState = JSON.parse(savedData);
        legacyState = { ...{ rebirths: 0, bloodEchoes: 0, purchasedTalents: {} }, ...loadedState };
        console.log("Loaded permanent progress:", legacyState);
    }
}

// --- REBIRTH & TALENT LOGIC ---

function performRebirth(cause = "choice") {
    let totalLevels = 0;
    for (const skill in skillsState) {
        totalLevels += skillsState[skill].level;
    }
    const echoesGained = Math.floor(totalLevels / 10);

    legacyState.rebirths += 1;
    legacyState.bloodEchoes += echoesGained;

    resetPlayerState();
    $('rebirth-container').style.display = 'none';
    saveGame();
    updateUI();
    renderAllTalents(); 

    let deathMessage = cause === "old_age" 
        ? "You have died of old age and are reborn."
        : `Rebirth #${legacyState.rebirths} complete!`;
    
    console.log(`${deathMessage} You gained ${echoesGained} Blood Echoes.`);
}

function resetPlayerState() {
    playerState = {
        day: 0,
        age: gameConfig.ages.startAge,
        coins: 0,
        completedJobs: new Set(),
        activeJob: 'Simple Villager',
        repVillage: 0,
        repWolf: 0,
        curseLevel: 0,
    };
    playerState.completedJobs.add('Simple Villager');
    skillsState = JSON.parse(JSON.stringify(gameConfig.skillDefinitions));
    
    const lingeringKnowledge = legacyState.purchasedTalents['lingering_knowledge'];
    if (lingeringKnowledge) {
        const talentInfo = gameConfig.talents.find(t => t.id === 'lingering_knowledge');
        for(const skill in skillsState) {
            gainSkillXp(skill, talentInfo.value);
        }
    }
}

// --- TALENT SYSTEM ---

function purchaseTalent(talentId) {
    const talent = gameConfig.talents.find(t => t.id === talentId);
    if (!talent) return;
    const currentLevel = legacyState.purchasedTalents[talentId] || 0;
    if (currentLevel >= talent.maxLevel) return;

    if (legacyState.bloodEchoes >= talent.cost) {
        legacyState.bloodEchoes -= talent.cost;
        legacyState.purchasedTalents[talentId] = currentLevel + 1;
        saveGame();
        renderAllTalents();
        updateUI();
    }
}

function createTalentCard(talent) {
    const card = document.createElement('div');
    card.className = 'card talent-card';
    const currentLevel = legacyState.purchasedTalents[talent.id] || 0;
    const isMaxed = currentLevel >= talent.maxLevel;
    const canAfford = legacyState.bloodEchoes >= talent.cost;

    if(isMaxed) card.classList.add('maxed');
    if(!canAfford && !isMaxed) card.classList.add('unaffordable');

    const title = document.createElement('div');
    title.className = 'talent-title';
    title.textContent = talent.name;

    const level = document.createElement('div');
    level.className = 'talent-level';
    level.textContent = `Level: ${currentLevel} / ${talent.maxLevel}`;

    const desc = document.createElement('div');
    desc.className = 'talent-desc';
    desc.textContent = talent.description;

    const cost = document.createElement('div');
    cost.className = 'talent-cost';
    cost.innerHTML = `Cost: <span style="color: var(--talent-accent);">${talent.cost}</span> 🩸`;

    const action = document.createElement('div');
    action.className = 'talent-action';
    const button = document.createElement('button');
    button.textContent = isMaxed ? 'Maxed Out' : 'Purchase';
    button.disabled = isMaxed || !canAfford;
    if (!isMaxed) button.onclick = () => purchaseTalent(talent.id);
    action.appendChild(button);

    card.append(title, level, desc, cost, action);
    return card;
}

function renderAllTalents() {
    const container = $('talents');
    if (container) {
        container.innerHTML = '';
        gameConfig.talents.forEach(talent => container.appendChild(createTalentCard(talent)));
    }
}

// --- THEME ---
function applyVisualTheme() {
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    if (visualTheme === 'auto') {
        document.body.classList.toggle('night', isNight);
        document.body.classList.toggle('day', !isNight);
    } else { document.body.className = visualTheme; }
}

// --- CORE GAME LOGIC ---

function skillNameFromProduce(str) { return str.toLowerCase().endsWith('xp') ? str.slice(0, -2).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : str.replace(/\b\w/g, l => l.toUpperCase()); }

function applyJobRewards() {
    if (!playerState.activeJob) return;
    const job = gameConfig.jobs.find(j => j.name === playerState.activeJob);
    if (!job) return;

    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    const jobIsActiveNow = (job.type === 'human' && !isNight) || (job.type === 'werewolf' && isNight);
    if (!jobIsActiveNow) return;

    let coinGain = 10;
    const xpGain = 5;

    const primalGreedLevel = legacyState.purchasedTalents['primal_greed'] || 0;
    if (primalGreedLevel > 0) coinGain *= (1 + (primalGreedLevel * 0.1));

    for (const item of job.produces) {
        if (item === 'coins') playerState.coins += coinGain;
        else if (item.endsWith('XP')) gainSkillXp(skillNameFromProduce(item), xpGain);
    }
    
    if (job.reputationEffects) {
        let { repVillage: villageRepGain = 0, repWolf: wolfRepGain = 0 } = job.reputationEffects;
        const humanityCharmLevel = legacyState.purchasedTalents['humanity_charm'] || 0;
        const feralAffinityLevel = legacyState.purchasedTalents['feral_affinity'] || 0;
        if(villageRepGain > 0 && humanityCharmLevel > 0) villageRepGain *= (1 + (humanityCharmLevel * 0.1));
        if(wolfRepGain > 0 && feralAffinityLevel > 0) wolfRepGain *= (1 + (feralAffinityLevel * 0.1));
        playerState.repVillage += villageRepGain;
        playerState.repWolf += wolfRepGain;
    }
}

function triggerNightEvent() {
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
        if (outcome) {
            return {
                type: eventTemplate.name,
                flavor: outcome.flavor || eventTemplate.flavor,
                effects: { ...outcome }
            };
        }
        return { type: eventTemplate.name, flavor: eventTemplate.flavor, effects: {} };
    }
    return null;
}

// --- JOB & SKILL RENDERING ---

function setActiveJob(jobName) {
    playerState.activeJob = jobName;
    playerState.completedJobs.add(jobName);
    renderAllJobs();
    updateUI();
}

function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'card job-card';
    const previousJobsMet = job.requires.length === 0 || job.requires.every(req => playerState.completedJobs.has(req));
    let skillsMet = true;
    let skillReqText = [];
    if (job.skillRequires) {
        for (const [skill, level] of Object.entries(job.skillRequires)) {
            if (!skillsState[skill] || skillsState[skill].level < level) skillsMet = false;
            skillReqText.push(`${skill} (Lv. ${level})`);
        }
    }
    const isUnlocked = previousJobsMet && skillsMet;
    const isActive = playerState.activeJob === job.name;
    if (!isUnlocked) card.classList.add('locked');
    if (isActive) card.classList.add('active-job');
    const title = document.createElement('div');
    title.className = 'job-title';
    title.textContent = job.name;
    const details = document.createElement('div');
    details.className = 'job-details';
    details.textContent = `Produces: ${job.produces.map(p => skillNameFromProduce(p)).join(', ')}`;
    const requirements = document.createElement('div');
    requirements.className = 'job-details';
    let reqs = [...job.requires, ...skillReqText];
    requirements.textContent = `Requires: ${reqs.join(', ') || 'None'}`;
    const action = document.createElement('div');
    action.className = 'job-action';
    const button = document.createElement('button');
    button.textContent = isActive ? 'Active' : 'Select Job';
    button.disabled = !isUnlocked || isActive;
    if (isUnlocked && !isActive) button.onclick = () => setActiveJob(job.name);
    action.appendChild(button);
    card.append(title, details, requirements, action);
    return card;
}

function renderAllJobs() { if ($('jobs')) { $('jobs').innerHTML = ''; gameConfig.jobs.forEach(job => $('jobs').appendChild(createJobCard(job))); } }

function gainSkillXp(skillName, xpGain) {
    if (!skillsState[skillName]) return;
    const skill = skillsState[skillName];
    skill.xp += xpGain * (legacyState.xpBonus || 1);
    if (skill.xp >= skill.xpToNext) {
        while (skill.xp >= skill.xpToNext) {
            skill.xp -= skill.xpToNext;
            skill.level += 1;
            skill.xpToNext = Math.round(skill.xpToNext * 1.5);
        }
        renderAllSkills();
        renderAllJobs();
    }
}

function renderSkillCard(name, skill) {
    const card = document.createElement('div');
    card.className = 'card skill-card';
    card.title = skill.effect;
    const label = document.createElement('div');
    label.className = 'progress-label';
    label.innerHTML = `<span>${name} (Lv ${skill.level})</span><span>${skill.xp.toFixed(0)}/${skill.xpToNext}</span>`;
    const barContainer = document.createElement('div');
    barContainer.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${(skill.xp / skill.xpToNext) * 100}%`;
    barContainer.appendChild(bar);
    card.appendChild(label);
    card.appendChild(barContainer);
    return card;
}

function renderAllSkills() {
    const sections = { 'General': $('general-skills'), 'Human': $('human-skills'), 'Wolf': $('wolf-skills'), 'Job': $('job-skills') };
    Object.values(sections).forEach(s => { if(s) s.innerHTML = ''});
    for (const [name, skill] of Object.entries(skillsState)) {
        const container = sections[skill.category] || sections['Job'];
        if (container) container.appendChild(renderSkillCard(name, skill));
    }
}

// --- UI & GAME LOOP ---

function updateUI() {
    if ($('age')) $('age').textContent = Math.floor(playerState.age);
    if ($('job')) $('job').textContent = playerState.activeJob || 'None';
    if ($('coinNum')) $('coinNum').textContent = Math.floor(playerState.coins);
    if ($('coinBar')) $('coinBar').style.width = `${(playerState.coins % 100)}%`;
    if ($('repVillage')) $('repVillage').textContent = playerState.repVillage.toFixed(2);
    if ($('repWolf')) $('repWolf').textContent = playerState.repWolf.toFixed(2);
    if ($('curseLevel')) $('curseLevel').textContent = playerState.curseLevel;
    if ($('rebirths')) $('rebirths').textContent = legacyState.rebirths;
    if ($('bloodEchoes')) $('bloodEchoes').textContent = legacyState.bloodEchoes;
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    if ($('moonIcon')) $('moonIcon').textContent = isNight ? MOON_PHASES[0] : SUN_PHASES[0];
    applyVisualTheme();
}

function gameTick() {
    if (playerState.age >= gameConfig.ages.maxAge) { performRebirth("old_age"); return; }
    playerState.day++;
    playerState.age += YEARS_PER_TICK;
    applyJobRewards();
    const event = triggerNightEvent();
    const eventSection = $('eventPanel');
    if (playerState.age >= gameConfig.ages.rebirthAge) $('rebirth-container').style.display = 'block';
    if (event) {
        const dayNumber = Math.floor(playerState.day / TICKS_PER_DAY);
        $('nightTitle').textContent = `Night of Day ${dayNumber}`;
        $('eventFlavor').textContent = event.flavor || 'A strange feeling washes over you.';
        eventSection.classList.add('show');
        if (event.effects) {
            let { repVillage: vRep = 0, repWolf: wRep = 0, curseLevel: cLvl = 0 } = event.effects;
            const humanityCharmLevel = legacyState.purchasedTalents['humanity_charm'] || 0;
            const feralAffinityLevel = legacyState.purchasedTalents['feral_affinity'] || 0;
            if(vRep > 0 && humanityCharmLevel > 0) vRep *= (1 + (humanityCharmLevel * 0.1));
            if(wRep > 0 && feralAffinityLevel > 0) wRep *= (1 + (feralAffinityLevel * 0.1));
            playerState.repVillage += vRep;
            playerState.repWolf += wRep;
            playerState.curseLevel += cLvl;
        }
    } else {
        eventSection.classList.remove('show');
    }
    updateUI();
}

// --- SETUP FUNCTIONS ---

function setupTabs() {
    const buttons = document.querySelectorAll('nav button');
    const sections = document.querySelectorAll('main > section');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            btn.classList.add('active');
            const target = $(btn.dataset.tab);
            if (target) target.classList.add('active');
            switch(btn.dataset.tab) {
                case 'jobs': renderAllJobs(); break;
                case 'skills': renderAllSkills(); break;
                case 'talents': renderAllTalents(); break;
            }
        });
    });
}

function setupThemeToggle() {
    const themeButtons = document.querySelectorAll('#theme-toggle button');
    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            visualTheme = button.dataset.theme;
            localStorage.setItem('lupus_theme', visualTheme);
            themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === visualTheme));
            applyVisualTheme();
        });
    });
    const savedTheme = localStorage.getItem('lupus_theme') || 'auto';
    visualTheme = savedTheme;
    themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === savedTheme));
}

async function initializeGame() {
    loadGame();
    try {
        // CORRECTED PATHS FOR GITHUB PAGES
        const configResponse = await fetch('./game_config.json');
        if (!configResponse.ok) throw new Error('Failed to fetch game_config.json.');
        gameConfig = await configResponse.json();
        
        // This is no longer needed as we moved the file
        // const playerResponse = await fetch('./player.json');

        resetPlayerState();
        setupTabs();
        setupThemeToggle();
        $('rebirth-button').addEventListener('click', () => performRebirth("choice"));
        applyVisualTheme();
        updateUI();
        renderAllJobs();
        renderAllTalents();
        setInterval(saveGame, 10000);
        gameLoopInterval = setInterval(gameTick, TICK_INTERVAL);
    } catch (error) {
        console.error("Error initializing game:", error);
        document.body.innerHTML = `<div style="color: white; text-align: center; padding: 50px;"><h1>Error loading game data</h1><p>${error.message}</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', initializeGame);
