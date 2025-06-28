// --- GLOBAL STATE & CONSTANTS ---

// Constants for UI and game logic
const EVENT_FLAVOR = {
    "Villager lynch patrol": "Drunken villagers roam with torches, searching for signs of the beast.",
    "Wolf hunt opportunity": "You spot fresh tracks leading deeper into the woods.",
    "Witch circle sighting": "Flickers of firelight illuminate cloaked figures in the glade.",
    "Full moon transformation": "Your bones ache and twist beneath the silver light."
};

const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

// Game state variables
let gameConfig = {};
let playerState = {};
let dayLogs = [];
let skillsState = {}; // This will hold the dynamic state of all skills
let dayIndex = 0;
let activeJob = "";
let gameTick = 0;

// Utility function for getting DOM elements
function $(id) {
    return document.getElementById(id);
}

// --- THEME AND VISUALS ---

/**
 * Applies the day or night theme based on the current game tick.
 * A day is 24 ticks long. The first 12 are day, the next 12 are night.
 */
function applyTheme() {
    const isNight = (gameTick % 24) >= 12;
    document.body.classList.toggle('night', isNight);
    document.body.classList.toggle('day', !isNight);
}

// --- SKILL MANAGEMENT ---

/**
 * Renders a single skill card in the UI.
 * @param {string} name - The name of the skill.
 * @param {object} skill - The skill's state object (level, xp, etc.).
 */
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

/**
 * Renders all skill cards into their appropriate sections (General, Job, etc.).
 */
function renderAllSkills() {
    // Clear existing skill sections
    const sections = ['general-skills', 'job-skills', 'wolf-skills', 'human-skills'];
    sections.forEach(id => {
        if ($(id)) $(id).innerHTML = '';
    });

    for (const [name, skill] of Object.entries(skillsState)) {
        const card = renderSkillCard(name, skill);
        const category = skill.category.toLowerCase();

        // Place card in the correct category container
        const containerId = `${category}-skills`;
        let container = $(containerId);
        
        // A fallback for Job/Human/Wolf skills if specific containers don't exist
        if (!container) {
            if(category === 'human' || category === 'wolf') {
                 container = $('job-skills');
            } else {
                 container = $('general-skills');
            }
        }
        
        if (container) {
            container.appendChild(card);
        }
    }
}

/**
 * Processes XP gain for a skill, handling level-ups.
 * @param {string} skillName - The name of the skill gaining XP.
 * @param {number} xpGain - The amount of XP to add.
 */
function gainSkillXp(skillName, xpGain) {
    if (!skillsState[skillName]) {
        console.warn(`Attempted to gain XP for an unknown skill: ${skillName}`);
        return;
    }

    const skill = skillsState[skillName];
    skill.xp += xpGain;

    // Handle level up
    while (skill.xp >= skill.xpToNext) {
        skill.xp -= skill.xpToNext;
        skill.level += 1;
        skill.xpToNext = Math.round(skill.xpToNext * 1.5); // Increase XP requirement for next level
        // Here you could add a visual effect for level up
    }
}


// --- MAIN GAME LOOP & UI UPDATES ---

/**
 * Updates all UI elements with the data from a single day's log entry.
 * @param {object} entry - The log object for the current day.
 */
function showEntry(entry) {
    // Update basic stats
    $('day').textContent = entry.day;
    $('age').textContent = entry.age;
    $('job').textContent = activeJob;
    $('coinNum').textContent = entry.coins;

    // Animate coin bar
    $('coinBar').style.width = Math.min(entry.coins % 100, 100) + '%';

    // Update skills based on the log
    if (entry.skillChanges) {
        for (const [skill, gained] of Object.entries(entry.skillChanges)) {
            gainSkillXp(skill, gained);
        }
        renderAllSkills(); // Re-render skills to show XP changes
    }

    // Update event panel
    const eventSection = $('eventPanel');
    if (entry.event) {
        $('nightTitle').textContent = `Night ${entry.day}`;
        $('eventFlavor').textContent = EVENT_FLAVOR[entry.event] || 'A strange feeling washes over you.';
        eventSection.classList.add('show');
    } else {
        eventSection.classList.remove('show');
    }

    // Update moon icon
    const phase = MOON_PHASES[entry.day % MOON_PHASES.length];
    $('moonIcon').textContent = phase;
}

/**
 * Advances the game by one day and updates the theme.
 */
function nextDay() {
    if (dayIndex >= dayLogs.length) {
        // Optional: stop the loop or generate new data if logs run out
        console.log("End of simulation logs.");
        clearInterval(gameLoopInterval);
        return;
    }
    
    showEntry(dayLogs[dayIndex]);
    applyTheme();

    dayIndex++;
    gameTick++;
}

// --- INITIALIZATION ---

/**
 * Sets up the tab navigation functionality.
 */
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
 * Initializes the game by fetching all necessary data files.
 */
async function initializeGame() {
    try {
        const [logsResponse, playerResponse, configResponse] = await Promise.all([
            fetch('player_result.json', { cache: 'no-store' }),
            fetch('../player.json', { cache: 'no-store' }),
            fetch('../game_config.json', { cache: 'no-store' })
        ]);

        if (!logsResponse.ok || !playerResponse.ok || !configResponse.ok) {
            throw new Error('Failed to fetch one or more game files.');
        }

        dayLogs = await logsResponse.json();
        playerState = await playerResponse.json();
        gameConfig = await configResponse.json();
        
        // Populate the dynamic skillsState from the config
        skillsState = JSON.parse(JSON.stringify(gameConfig.skillDefinitions)); // Deep copy

        // Update UI with initial player state
        activeJob = playerState.activeJob || 'Unemployed';
        $('repVillage').textContent = playerState.repVillage;
        $('repWolf').textContent = playerState.repWolf;
        $('curseLevel').textContent = playerState.curseLevel;
        $('rebirths').textContent = playerState.rebirths;

        // Setup UI and start the game loop
        setupTabs();
        renderAllSkills();
        
        // Start the main game loop
        nextDay(); // Show the first day immediately
        setInterval(nextDay, 2000); // Subsequent days every 2 seconds

    } catch (error) {
        console.error("Error initializing game:", error);
        document.body.innerHTML = `<div style="color: white; text-align: center; padding: 50px;">
            <h1>Error loading game data</h1>
            <p>Could not load game files. Please check the console for details and ensure all files are in the correct location.</p>
        </div>`;
    }
}

// Start the game once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeGame);
