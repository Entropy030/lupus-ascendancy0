// --- GLOBAL STATE & CONSTANTS ---

const ICON_SUN = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" id="sun-icon-svg">
  <defs>
    <filter id="sun-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g class="sun-body">
    <circle cx="50" cy="50" r="25" fill="#FFD700" filter="url(#sun-glow-filter)"/>
  </g>
  <g class="sun-rays">
    <line x1="50" y1="10" x2="50" y2="25" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="50" y1="75" x2="50" y2="90" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="10" y1="50" x2="25" y2="50" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="75" y1="50" x2="90" y2="50" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="22" x2="33" y2="33" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="67" y1="67" x2="78" y2="78" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="78" x2="33" y2="67" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <line x1="67" y1="33" x2="78" y2="22" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>
`;

const ICON_MOON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" id="moon-icon-svg">
  <defs>
    <filter id="moon-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.7 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g transform="translate(5 5) scale(0.9)" class="moon-group" filter="url(#moon-glow-filter)">
    <path class="moon-path" d="M 75 50 A 40 40 0 1 1 50 25 A 30 30 0 1 0 75 50 Z" fill="#F1FAEE"/>
    <circle class="star" cx="20" cy="20" r="2" fill="#F1FAEE"/>
    <circle class="star" cx="35" cy="70" r="1.5" fill="#F1FAEE"/>
    <circle class="star" cx="80" cy="80" r="1" fill="#F1FAEE"/>
  </g>
</svg>
`;

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
let lastIsNightState = null; // NEW: Tracks the previous day/night state

let rebirthModalShown = false; 

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

// --- REBIRTH & DEATH LOGIC ---

function showRebirthModal(cause) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;

    const modalOverlay = $('modal-overlay');
    const modalTitle = $('modal-title');
    const modalText = $('modal-text');
    const modalStats = $('modal-stats');

    const totalLevels = Object.values(skillsState).reduce((sum, skill) => sum + skill.level, 0);
    const echoesGained = 1 + Math.floor(totalLevels / 5);

    if (cause === 'old_age') {
        modalTitle.textContent = "Your Life Fades";
        modalText.textContent = "You have reached the end of your mortal lifespan. Your body withers, but your essence carries on. It is time to be reborn.";
    } else {
        modalTitle.textContent = "Your Time Has Come";
        modalText.textContent = "You have reached the age of rebirth. Your mortal coil weakens, but your essence can be born anew, stronger than before.";
    }

    modalStats.innerHTML = `You will gain <span style="color: var(--talent-accent);">${echoesGained}</span> 🩸 Blood Echoes.`;
    modalOverlay.style.display = 'flex';
}

function performRebirth() {
    let totalLevels = 0;
    for (const skill in skillsState) {
        totalLevels += skillsState[skill].level;
    }
    const echoesGained = 1 + Math.floor(totalLevels / 5);
    legacyState.rebirths += 1;
    legacyState.bloodEchoes += echoesGained;

    resetPlayerState();
    $('modal-overlay').style.display = 'none';
    saveGame();
    updateUI();
    renderAllTalents();
    
    if (!gameLoopInterval) {
        gameLoopInterval = setInterval(gameTick, TICK_INTERVAL);
    }
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
    rebirthModalShown = false; 
    playerState.completedJobs.add('Simple Villager');
    skillsState = JSON.parse(JSON.stringify(gameConfig.skillDefinitions));
    
    const lingeringKnowledge = legacyState.purchasedTalents['lingering_knowledge'];
    if (lingeringKnowledge) {
        const talentInfo = gameConfig.talents.find(t => t.id === 'lingering_knowledge');
        for(const skill in skillsState) {
            gainSkillXp(skill, talentInfo.value, true); // Pass true to ignore xpBonus
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
        let { repVillage: vRep = 0, repWolf: wRep = 0 } = job.reputationEffects;
        const humanityCharmLevel = legacyState.purchasedTalents['humanity_charm'] || 0;
        const feralAffinityLevel = legacyState.purchasedTalents['feral_affinity'] || 0;
        if(vRep > 0 && humanityCharmLevel > 0) vRep *= (1 + (humanityCharmLevel * 0.1));
        if(wRep > 0 && feralAffinityLevel > 0) wRep *= (1 + (feralAffinityLevel * 0.1));
        playerState.repVillage += vRep;
        playerState.repWolf += wRep;
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
        if (outcome) return { type: eventTemplate.name, flavor: outcome.flavor || eventTemplate.flavor, effects: { ...outcome } };
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

function gainSkillXp(skillName, xpGain, ignoreBonus = false) {
    if (!skillsState[skillName]) return;
    const skill = skillsState[skillName];
    const finalXpGain = ignoreBonus ? xpGain : xpGain * (legacyState.xpBonus || 1); // Fallback to 1 if xpBonus is not defined
    skill.xp += finalXpGain;
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
    
    applyVisualTheme();
    renderAllSkills();
}

function gameTick() {
    if (!rebirthModalShown && playerState.age >= gameConfig.ages.rebirthAge) {
        const cause = playerState.age >= gameConfig.ages.maxAge ? "old_age" : "choice";
        showRebirthModal(cause);
        rebirthModalShown = true; 
        return; 
    }
    playerState.day++;
    playerState.age += YEARS_PER_TICK;

    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    if (isNight !== lastIsNightState) {
        $('sun-icon-wrapper').style.display = isNight ? 'none' : 'block';
        $('moon-icon-wrapper').style.display = isNight ? 'block' : 'none';
        lastIsNightState = isNight;
    }

    applyJobRewards();
    const event = triggerNightEvent();
    const eventSection = $('eventPanel');
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
        const configResponse = await fetch('game_config.json');
        if (!configResponse.ok) throw new Error('Failed to fetch game_config.json.');
        gameConfig = await configResponse.json();
        
        $('sun-icon-wrapper').innerHTML = ICON_SUN;
        $('moon-icon-wrapper').innerHTML = ICON_MOON;

        resetPlayerState(); 
        setupTabs();
        setupThemeToggle();
        $('modal-rebirth-button').addEventListener('click', performRebirth);

        applyVisualTheme();
        updateUI(); 
        renderAllJobs();
        renderAllTalents();
        
        lastIsNightState = null;
        gameTick(); 

        setInterval(saveGame, 10000);
        gameLoopInterval = setInterval(gameTick, TICK_INTERVAL);
    } catch (error) {
        console.error("Error initializing game:", error);
        document.body.innerHTML = `<div style="color: white; text-align: center; padding: 50px;"><h1>Error loading game data</h1><p>${error.message}</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', initializeGame);
