// --- GLOBAL STATE & CONSTANTS ---

const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const SUN_PHASES = ["☀️"];
const TICK_INTERVAL = 2000;
const TICKS_PER_DAY = 24;

let gameConfig = {};
let playerState = {
    day: 0, age: 0, coins: 0, skills: {}, completedJobs: new Set(),
    activeJob: null, repVillage: 0, repWolf: 0, curseLevel: 0, rebirths: 0,
};
let skillsState = {};
let gameLoopInterval = null;
let visualTheme = 'auto'; // 'auto', 'day', 'night'

function $(id) {
    return document.getElementById(id);
}

// --- THEME AND VISUALS ---

/**
 * NEW: Updated function to apply visual theme based on player's setting.
 */
function applyVisualTheme() {
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);

    if (visualTheme === 'auto') {
        document.body.classList.toggle('night', isNight);
        document.body.classList.toggle('day', !isNight);
    } else if (visualTheme === 'day') {
        document.body.classList.add('day');
        document.body.classList.remove('night');
    } else { // night
        document.body.classList.add('night');
        document.body.classList.remove('day');
    }
}

// --- CORE GAME LOGIC ---

function skillNameFromProduce(produceStr) {
    if (produceStr.toLowerCase().endsWith('xp')) {
        const base = produceStr.slice(0, -2);
        return base.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return produceStr.replace(/\b\w/g, l => l.toUpperCase());
}

function applyJobRewards() {
    if (!playerState.activeJob) return;
    const job = gameConfig.jobs.find(j => j.name === playerState.activeJob);
    if (!job) return;

    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    const jobIsActiveNow = (job.type === 'human' && !isNight) || (job.type === 'werewolf' && isNight);
    if (!jobIsActiveNow) return;

    const coinGain = 10;
    const xpGain = 5;
    for (const item of job.produces) {
        if (item === 'coins') playerState.coins += coinGain;
        else if (item.endsWith('XP')) gainSkillXp(skillNameFromProduce(item), xpGain);
    }
    if (job.reputationEffects) {
        if (job.reputationEffects.repVillage) playerState.repVillage += job.reputationEffects.repVillage;
        if (job.reputationEffects.repWolf) playerState.repWolf += job.reputationEffects.repWolf;
    }
}

function triggerNightEvent() {
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    if (!isNight) return null;
    const currentJob = gameConfig.jobs.find(j => j.name === playerState.activeJob);
    if (!currentJob) return null;

    if (currentJob.name === 'Seer' && Math.random() < 0.5) {
        return { type: "Seer's Vision", flavor: "You gaze into the stars and a fragmented vision comes to you..." };
    }
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
                effects: { repVillage: outcome.repVillage || 0, repWolf: outcome.repWolf || 0, curseLevel: outcome.curseLevel || 0 }
            };
        }
        return { type: eventTemplate.name, flavor: eventTemplate.flavor, effects: {} };
    }
    return null;
}

// --- JOB MANAGEMENT ---

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
            const currentSkill = skillsState[skill];
            if (!currentSkill || currentSkill.level < level) skillsMet = false;
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
    let reqs = [];
    if (job.requires.length > 0) reqs.push(...job.requires);
    if (skillReqText.length > 0) reqs.push(...skillReqText);
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

function renderAllJobs() {
    const container = $('jobs');
    if (container) {
        container.innerHTML = '';
        gameConfig.jobs.forEach(job => container.appendChild(createJobCard(job)));
    }
}

// --- SKILL MANAGEMENT ---

function gainSkillXp(skillName, xpGain) {
    if (!skillsState[skillName]) return;
    const skill = skillsState[skillName];
    skill.xp += xpGain;
    while (skill.xp >= skill.xpToNext) {
        skill.xp -= skill.xpToNext;
        skill.level += 1;
        skill.xpToNext = Math.round(skill.xpToNext * 1.5);
    }
}

function renderSkillCard(name, skill) {
    const card = document.createElement('div');
    card.className = 'card skill-card';
    card.title = skill.effect;
    const label = document.createElement('div');
    label.className = 'progress-label';
    label.innerHTML = `<span>${name} (Lv ${skill.level})</span><span>${skill.xp}/${skill.xpToNext}</span>`;
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
        const card = renderSkillCard(name, skill);
        const container = sections[skill.category] || sections['Job'];
        if (container) container.appendChild(card);
    }
}

// --- UI & GAME LOOP ---

function updateUI() {
    $('day').textContent = Math.floor(playerState.day / TICKS_PER_DAY);
    $('age').textContent = playerState.age.toFixed(2);
    $('job').textContent = playerState.activeJob || 'None';
    $('coinNum').textContent = playerState.coins;
    $('coinBar').style.width = `${(playerState.coins % 100)}%`;
    $('repVillage').textContent = playerState.repVillage.toFixed(2);
    $('repWolf').textContent = playerState.repWolf.toFixed(2);
    $('curseLevel').textContent = playerState.curseLevel;
    $('rebirths').textContent = playerState.rebirths;
    const isNight = (playerState.day % TICKS_PER_DAY) >= (TICKS_PER_DAY / 2);
    $('moonIcon').textContent = isNight ? MOON_PHASES[playerState.day % MOON_PHASES.length] : SUN_PHASES[0];
    applyVisualTheme(); // Apply the theme on every UI update
    renderAllSkills();
}

function gameTick() {
    playerState.day++;
    playerState.age = gameConfig.ages.startAge + (playerState.day / (TICKS_PER_DAY * 365));
    applyJobRewards();
    const event = triggerNightEvent();
    const eventSection = $('eventPanel');
    if (event) {
        const dayNumber = Math.floor(playerState.day / TICKS_PER_DAY);
        $('nightTitle').textContent = `Night of Day ${dayNumber}`;
        $('eventFlavor').textContent = event.flavor || 'A strange feeling washes over you.';
        eventSection.classList.add('show');
        if (event.effects) {
            if (event.effects.repWolf) playerState.repWolf += event.effects.repWolf;
            if (event.effects.repVillage) playerState.repVillage += event.effects.repVillage;
            if (event.effects.curseLevel) playerState.curseLevel += event.effects.curseLevel;
        }
    } else {
        eventSection.classList.remove('show');
    }
    updateUI();
    renderAllJobs();
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
        });
    });
}

/**
 * NEW: Sets up the theme selection buttons and loads the saved theme.
 */
function setupThemeToggle() {
    const themeButtons = document.querySelectorAll('#theme-toggle button');
    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Set the new theme
            visualTheme = button.dataset.theme;
            localStorage.setItem('lupus_theme', visualTheme);

            // Update active button state
            themeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Immediately apply the new theme
            applyVisualTheme();
        });
    });

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('lupus_theme');
    if (savedTheme) {
        visualTheme = savedTheme;
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        });
    }
}

async function initializeGame() {
    try {
        const [playerResponse, configResponse] = await Promise.all([ fetch('../player.json'), fetch('../game_config.json') ]);
        if (!playerResponse.ok || !configResponse.ok) throw new Error('Failed to fetch game files.');

        const initialPlayerData = await playerResponse.json();
        gameConfig = await configResponse.json();
        
        playerState.activeJob = initialPlayerData.activeJob;
        playerState.coins = initialPlayerData.coins;
        playerState.age = gameConfig.ages.startAge;
        playerState.completedJobs.add(initialPlayerData.activeJob);

        skillsState = JSON.parse(JSON.stringify(gameConfig.skillDefinitions));

        setupTabs();
        setupThemeToggle(); // NEW: Initialize the theme buttons
        applyVisualTheme(); // Apply initial theme
        updateUI();
        renderAllJobs();
        gameLoopInterval = setInterval(gameTick, TICK_INTERVAL);
    } catch (error) {
        console.error("Error initializing game:", error);
        document.body.innerHTML = `<div style="color: white; text-align: center; padding: 50px;"><h1>Error loading game data</h1><p>Could not load game files. Please ensure player.json and game_config.json are accessible.</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', initializeGame);
