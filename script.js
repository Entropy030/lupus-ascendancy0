const EVENT_FLAVOR = {
    "Villager lynch patrol": "Drunken villagers roam with torches, searching for signs of the beast.",
    "Wolf hunt opportunity": "You spot fresh tracks leading deeper into the woods.",
    "Witch circle sighting": "Flickers of firelight illuminate cloaked figures in the glade.",
    "Full moon transformation": "Your bones ache and twist beneath the silver light."
};

const MOON_PHASES = [
    "\u{1F311}", "\u{1F312}", "\u{1F313}", "\u{1F314}",
    "\u{1F315}", "\u{1F316}", "\u{1F317}", "\u{1F318}"
];

// Fallback skill data if player_result.json lacks it
const SAMPLE_SKILLS = {
    "Discipline": { category: "General", level: 3, xp: 40, xpToNext: 100, effect: "Speeds up skill XP gain" },
    "Awareness": { category: "General", level: 2, xp: 30, xpToNext: 80, effect: "Improves event detection" },
    "Tracking": { category: "Job", level: 5, xp: 120, xpToNext: 200, effect: "Improves Hunter job efficiency" },
    "Lore Reading": { category: "Job", level: 1, xp: 20, xpToNext: 50, effect: "Unlocks story clues" }
};

let logs = [];
let activeJob = "";
let index = 0;
const totals = {};
let playerState = {};

function pulse(element) {
    element.classList.remove('pulse');
    // force reflow to restart animation
    void element.offsetWidth;
    element.classList.add('pulse');
}

function $(id) { return document.getElementById(id); }

function createSkillCard(name, data, parent) {
    const container = document.createElement('div');
    container.className = 'stat';
    container.dataset.skill = name;
    if (data.effect) container.title = data.effect;

    const label = document.createElement('div');
    label.className = 'label';
    const levelSpan = document.createElement('span');
    levelSpan.className = 'level';
    levelSpan.textContent = `Lv ${data.level}`;
    label.textContent = name + ' ';
    label.appendChild(levelSpan);

    const progress = document.createElement('div');
    progress.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = Math.min(100, (data.xp / data.xpToNext) * 100) + '%';
    progress.appendChild(bar);

    container.appendChild(label);
    container.appendChild(progress);
    parent.appendChild(container);
}

function renderSkills(skills) {
    const general = $('generalSkillsList');
    const job = $('jobSkillsList');
    if (!general || !job) return;
    general.innerHTML = '';
    job.innerHTML = '';

    Object.entries(skills).forEach(([name, data]) => {
        const parent = data.category && data.category.toLowerCase() === 'general' ? general : job;
        createSkillCard(name, data, parent);
    });
}

// legacy function for numeric stat updates
function updateSkill(skill, value) {
    let container = document.querySelector(`[data-skill="${skill}"]`);
    if (!container) return;
    const num = container.querySelector('.num');
    const bar = container.querySelector('.bar');
    if (num) num.textContent = value;
    if (bar) {
        bar.style.width = Math.min(value, 100) + '%';
        pulse(bar);
    }
}

function showEntry(entry) {
    $('day').textContent = entry.day;
    $('age').textContent = entry.age;
    $('job').textContent = activeJob;

    $('coinNum').textContent = entry.coins;
    $('coinBar').style.width = Math.min(entry.coins, 100) + '%';
    pulse($('coinBar'));

    if (entry.skillChanges) {
        for (const [skill, gain] of Object.entries(entry.skillChanges)) {
            totals[skill] = (totals[skill] || 0) + gain;
            updateSkill(skill, totals[skill]);
        }
    }

    const strengthTotal = totals['Strength'] || 0;
    $('strengthNum').textContent = strengthTotal;
    $('strengthBar').style.width = Math.min(strengthTotal, 100) + '%';
    pulse($('strengthBar'));

    const eventSection = $('eventPanel');
    if (entry.event) {
        $('nightTitle').textContent = `Night ${entry.day}`;
        $('eventFlavor').textContent = EVENT_FLAVOR[entry.event] || '';
        eventSection.classList.add('show');
    } else {
        $('nightTitle').textContent = '';
        $('eventFlavor').textContent = '';
        eventSection.classList.remove('show');
    }

    const phase = MOON_PHASES[entry.day % MOON_PHASES.length];
    $('moonIcon').textContent = phase;
}

function nextDay() {
    if (index >= logs.length) return;
    showEntry(logs[index]);
    index++;
}

function startLoop() {
    nextDay();
    setInterval(nextDay, 1500);
}

function setupTabs() {
    const buttons = document.querySelectorAll('nav button');
    const sections = document.querySelectorAll('main > section');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
        });
    });
}

Promise.all([
    fetch('player_result.json', {cache: 'no-store'})
        .then(r => r.json())
        .catch(() => ({
            logs: [
                {day:1, age:15, coins:10, coinGain:10, skillChanges:{"Strength":5}, event:"Wolf hunt opportunity"},
                {day:2, age:16, coins:20, coinGain:10, skillChanges:{"Strength":5}, event:null}
            ],
            skills: SAMPLE_SKILLS
        })),
    fetch('../player.json').then(r => r.json()).catch(() => ({activeJob:'Woodcutter'}))
]).then(([data, player]) => {
    if (Array.isArray(data)) {
        logs = data;
        renderSkills(SAMPLE_SKILLS);
    } else {
        logs = data.logs || [];
        renderSkills(data.skills || SAMPLE_SKILLS);
    }
    playerState = player;
    activeJob = player.activeJob || 'Unknown';
    $('repVillage').textContent = player.repVillage;
    $('repWolf').textContent = player.repWolf;
    $('curseLevel').textContent = player.curseLevel;
    $('rebirths').textContent = player.rebirths;
    setupTabs();
    startLoop();
});
