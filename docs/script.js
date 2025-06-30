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

const TICKS_PER_DAY = 24;

let gameConfig = {};
let playerState = {};
let legacyState = {};
let skillsState = {};
let visualTheme = 'auto';
let lastIsNightState = null;

let worker; // The Web Worker

function $(id) {
    const sanitizedId = id.replace(/\s+/g, '-');
    return document.getElementById(sanitizedId);
}

// --- SAVE & LOAD ---

function saveGame() {
    const fullSaveState = {
        player: playerState,
        skills: skillsState,
        legacy: legacyState,
        timestamp: Date.now()
    };
    // To save the Set, we convert it to an array
    if (fullSaveState.player.completedJobs) {
        fullSaveState.player.completedJobs = Array.from(fullSaveState.player.completedJobs);
    }
    localStorage.setItem('lupus_full_save', JSON.stringify(fullSaveState));
    console.log("Game saved at", new Date(fullSaveState.timestamp).toLocaleTimeString());
}

function loadGame() {
    const savedData = localStorage.getItem('lupus_full_save');
    if (savedData) {
        const loadedState = JSON.parse(savedData);
        playerState = loadedState.player;
        playerState.completedJobs = new Set(playerState.completedJobs);
        skillsState = loadedState.skills;
        legacyState = loadedState.legacy;
        return loadedState.timestamp;
    }
    return null;
}

// --- REBIRTH & DEATH LOGIC ---

function showRebirthModal(cause) {
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
    worker.postMessage({ type: 'PERFORM_REBIRTH' });
    $('modal-overlay').style.display = 'none';
}

function resetPlayerState() {
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
    legacyState = { rebirths: 0, bloodEchoes: 0, purchasedTalents: {} };
}

// --- TALENT SYSTEM & HOUSING ---

function purchaseTalent(talentId) {
    worker.postMessage({ type: 'PURCHASE_TALENT', payload: { talentId } });
}

function createTalentCard(talent) {
    const card = document.createElement('div');
    card.className = 'card talent-card';
    const currentLevel = (legacyState.purchasedTalents && legacyState.purchasedTalents[talent.id]) || 0;
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

function purchaseHousing(tierIndex) {
    worker.postMessage({ type: 'PURCHASE_HOUSING', payload: { tierIndex } });
}

function createHousingCard(tier, index) {
    const card = document.createElement('div');
    card.className = 'card job-card';
    const isPurchased = playerState.currentHousingTier >= index;
    const canAfford = playerState.coins >= tier.cost;
    const isNext = playerState.currentHousingTier === index - 1;

    if (isPurchased) card.classList.add('active-job');
    if (!isPurchased && (!isNext || !canAfford)) card.classList.add('locked');

    const title = document.createElement('div');
    title.className = 'job-title';
    title.textContent = tier.name;
    
    const desc = document.createElement('div');
    desc.className = 'job-details';
    desc.textContent = tier.description;

    const bonus = document.createElement('div');
    bonus.className = 'job-details';
    bonus.textContent = `Benefit: +${tier.maxAgeBonus} years to max age.`;

    const cost = document.createElement('div');
    cost.className = 'job-details';
    cost.innerHTML = `Cost: ${tier.cost.toLocaleString()} Coins`;

    const action = document.createElement('div');
    action.className = 'job-action';
    const button = document.createElement('button');
    button.textContent = isPurchased ? 'Purchased' : 'Purchase';
    button.disabled = isPurchased || !isNext || !canAfford;

    if (!isPurchased) {
        button.onclick = () => purchaseHousing(index);
    }
    action.appendChild(button);
    card.append(title, desc, bonus, cost, action);
    return card;
}

function renderAllHousing() {
    const container = $('housing');
    if (container) {
        container.innerHTML = '';
        gameConfig.housingTiers.forEach((tier, index) => {
            container.appendChild(createHousingCard(tier, index));
        });
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

// --- JOB & SKILL RENDERING ---

function setActiveJob(jobName) {
    worker.postMessage({ type: 'SET_JOB', payload: { jobName } });
}

function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'card job-card';
    const previousJobsMet = job.requires.length === 0 || Array.from(playerState.completedJobs).every(req => playerState.completedJobs.has(req));
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
    details.textContent = `Produces: ${job.produces.map(p => p.replace('XP', ' XP')).join(', ')}`;
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

function renderSkillCard(name, skill) {
    const card = document.createElement('div');
    card.className = 'card skill-card';
    card.title = skill.effect;

    const label = document.createElement('div');
    label.className = 'progress-label';

    const nameSpan = document.createElement('span');
    const sanitizedName = name.replace(/\s+/g, '-');
    nameSpan.id = `skill-name-${sanitizedName}`;
    nameSpan.textContent = `${name} (Lv ${skill.level})`;

    const xpSpan = document.createElement('span');
    xpSpan.id = `skill-xp-${sanitizedName}`;
    xpSpan.textContent = `${skill.xp.toFixed(0)}/${skill.xpToNext}`;

    label.append(nameSpan, xpSpan);

    const barContainer = document.createElement('div');
    barContainer.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.id = `skill-bar-${sanitizedName}`;
    bar.style.width = `${(skill.xp / skill.xpToNext) * 100}%`;
    
    barContainer.appendChild(bar);
    card.append(label, barContainer);
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

function updateSkill(name, skill) {
    const sanitizedName = name.replace(/\s+/g, '-');
    const nameEl = $(`skill-name-${sanitizedName}`);
    if (nameEl) nameEl.textContent = `${name} (Lv ${skill.level})`;

    const xpEl = $(`skill-xp-${sanitizedName}`);
    if (xpEl) xpEl.textContent = `${skill.xp.toFixed(0)}/${skill.xpToNext}`;

    const barEl = $(`skill-bar-${sanitizedName}`);
    if (barEl) barEl.style.width = `${(skill.xp / skill.xpToNext) * 100}%`;
}

function updateAllSkills() {
    if (!skillsState) return;
    for (const [name, skill] of Object.entries(skillsState)) {
        updateSkill(name, skill);
    }
}

// --- UI & GAME LOOP ---

function updateUI() {
    if (!playerState || !legacyState) return;
    
    if ($('age')) $('age').textContent = Math.floor(playerState.age);
    if ($('job')) $('job').textContent = playerState.activeJob || 'None';
    if ($('coinNum')) $('coinNum').textContent = Math.floor(playerState.coins).toLocaleString();
    if ($('coinBar')) $('coinBar').style.width = `${(playerState.coins % 100)}%`;
    if ($('repVillage')) $('repVillage').textContent = playerState.repVillage.toFixed(2);
    if ($('repWolf')) $('repWolf').textContent = playerState.repWolf.toFixed(2);
    if ($('curseLevel')) $('curseLevel').textContent = playerState.curseLevel;
    if ($('rebirths')) $('rebirths').textContent = legacyState.rebirths || 0;
    if ($('bloodEchoes')) $('bloodEchoes').textContent = legacyState.bloodEchoes || 0;

    const currentHousingName = playerState.currentHousingTier > -1 ? gameConfig.housingTiers[playerState.currentHousingTier].name : 'None';
    if ($('currentHousing')) $('currentHousing').textContent = currentHousingName;
    
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    if (isNight !== lastIsNightState) {
        $('sun-icon-wrapper').style.display = isNight ? 'none' : 'block';
        $('moon-icon-wrapper').style.display = isNight ? 'block' : 'none';
        lastIsNightState = isNight;
    }

    applyVisualTheme();
    updateAllSkills();
}

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
            // Re-render on tab switch to ensure data is fresh
            switch(btn.dataset.tab) {
                case 'jobs': renderAllJobs(); break;
                case 'talents': renderAllTalents(); break;
                case 'housing': renderAllHousing(); break;
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
    try {
        const configResponse = await fetch('game_config.json');
        if (!configResponse.ok) throw new Error('Failed to fetch game_config.json.');
        gameConfig = await configResponse.json();
        
        worker = new Worker('worker.js');

        worker.onmessage = function(e) {
            const { type, payload } = e.data;
            switch(type) {
                case 'UPDATE':
                    playerState = payload.playerState;
                    playerState.completedJobs = new Set(playerState.completedJobs);
                    skillsState = payload.skillsState;
                    legacyState = payload.legacyState;
                    updateUI();
                    // BUG FIX: Re-render jobs on every update to catch unlocks
                    renderAllJobs();
                    break;
                case 'EVENT_TRIGGERED':
                    const eventSection = $('eventPanel');
                    const dayNumber = Math.floor(playerState.day / TICKS_PER_DAY);
                    $('nightTitle').textContent = `Night of Day ${dayNumber}`;
                    $('eventFlavor').textContent = payload.flavor || 'A strange feeling washes over you.';
                    eventSection.classList.add('show');
                    break;
                case 'CLEAR_EVENT':
                    $('eventPanel').classList.remove('show');
                    break;
                case 'NEEDS_JOB_RENDER':
                    renderAllJobs();
                    break;
                case 'SHOW_REBIRTH_MODAL':
                    worker.postMessage({ type: 'STOP' });
                    showRebirthModal(payload.cause);
                    break;
            }
        };

        const lastTimestamp = loadGame();
        if (!lastTimestamp) {
            resetPlayerState();
        }

        const payload = {
            gameConfig,
            playerState: { ...playerState, completedJobs: Array.from(playerState.completedJobs) }, // Convert Set to array for worker
            skillsState,
            legacyState
        };
        worker.postMessage({ type: 'START', payload });

        $('sun-icon-wrapper').innerHTML = ICON_SUN;
        $('moon-icon-wrapper').innerHTML = ICON_MOON;

        setupTabs();
        setupThemeToggle();
        $('modal-rebirth-button').addEventListener('click', performRebirth);

        renderAllSkills();
        renderAllHousing();
        renderAllJobs();
        renderAllTalents();
        
        applyVisualTheme();
        updateUI(); 
        
        setInterval(saveGame, 5000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                saveGame();
            }
        });

    } catch (error) {
        console.error("Error initializing game:", error);
        document.body.innerHTML = `<div style="color: white; text-align: center; padding: 50px;"><h1>Error loading game data</h1><p>${error.message}</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', initializeGame);
