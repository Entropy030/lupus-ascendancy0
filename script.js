
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

let logs = [];
let activeJob = "";
let playerState = {};
let index = 0;
let activeSkill = null;
const totals = {};

function pulse(element) {
    element.classList.remove('pulse');
    void element.offsetWidth;
    element.classList.add('pulse');
}

function $(id) {
    return document.getElementById(id);
}

function renderSkillCard(name, skill) {
    const card = document.createElement('div');
    card.className = 'card skill-card';
    if (name === activeSkill) {
        card.classList.add('active-skill');
    }

    card.title = skill.effect;
    card.onclick = () => {
        activeSkill = name;
        renderSkills(sampleSkills); // re-render highlight
        console.log(`Now training: ${name}`);
    };

    const label = document.createElement('div');
    label.className = 'progress-label';
    label.innerHTML = `<span>${name} (Lv ${skill.level})</span><span>${skill.xp}/${skill.xpToNext}</span>`;

    const barContainer = document.createElement('div');
    barContainer.className = 'progress-bar';
    barContainer.style.setProperty('--progress', `${(skill.xp / skill.xpToNext) * 100}%`);

    card.appendChild(label);
    card.appendChild(barContainer);
    return card;
}

function renderSkills(skills) {
    const generalContainer = document.getElementById('general-skills');
    const jobContainer = document.getElementById('job-skills');
    if (!generalContainer || !jobContainer) return;

    generalContainer.innerHTML = '';
    jobContainer.innerHTML = '';

    for (const [name, skill] of Object.entries(skills)) {
        const card = renderSkillCard(name, skill);
        if (skill.category === 'General') {
            generalContainer.appendChild(card);
        } else {
            jobContainer.appendChild(card);
        }
    }
}

const sampleSkills = {
    "Discipline": { category: "General", level: 3, xp: 40, xpToNext: 100, effect: "Speeds up skill XP gain." },
    "Awareness": { category: "General", level: 2, xp: 20, xpToNext: 60, effect: "Reveals hidden event options." },
    "Tracking": { category: "Job", level: 4, xp: 80, xpToNext: 160, effect: "Boosts Hunter job efficiency." },
    "Lore Reading": { category: "Job", level: 1, xp: 10, xpToNext: 40, effect: "Unlocks hidden lore faster." }
};

function showEntry(entry) {
    $('day').textContent = entry.day;
    $('age').textContent = entry.age;
    $('job').textContent = activeJob;
    $('coinNum').textContent = entry.coins;
    $('coinBar').style.width = Math.min(entry.coins, 100) + '%';
    pulse($('coinBar'));

    if (entry.skillChanges) {
        for (const [skill, gain] of Object.entries(entry.skillChanges)) {
            if (!sampleSkills[skill]) continue;
            sampleSkills[skill].xp += gain;
            totals[skill] = (totals[skill] || 0) + gain;

            if (sampleSkills[skill].xp >= sampleSkills[skill].xpToNext) {
                sampleSkills[skill].level += 1;
                sampleSkills[skill].xp = 0;
                sampleSkills[skill].xpToNext = Math.round(sampleSkills[skill].xpToNext * 1.2);
            }
        }
        renderSkills(sampleSkills);
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

function generateNextDay(prevEntry) {
    const day = prevEntry.day + 1;
    const age = prevEntry.age + 1;
    const coins = prevEntry.coins + 10;
    const skillChange = activeSkill ? { [activeSkill]: 2 } : {};
    const event = (day % 4 === 0) ? "Full moon transformation" : null;
    return { day, age, coins, coinGain: 10, skillChanges: skillChange, event };
}

function nextDay() {
    if (index >= logs.length) {
        const next = generateNextDay(logs[logs.length - 1]);
        logs.push(next);
    }
    showEntry(logs[index]);
    index++;
}

function startLoop() {
    renderSkills(sampleSkills);
    nextDay();
    setInterval(nextDay, 1500); // 1 tick = 1.5s
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
        .then(r => r.ok ? r.json() : Promise.reject())
        .catch(() => [
            {day:1, age:15, coins:10, coinGain:10, skillChanges:{"Discipline":2}, event:"Wolf hunt opportunity"},
            {day:2, age:16, coins:20, coinGain:10, skillChanges:{"Discipline":2}, event:null},
            {day:3, age:17, coins:30, coinGain:10, skillChanges:{"Discipline":2}, event:null}
        ]),
    fetch('../player.json').then(r => r.json()).catch(() => ({
        activeJob: 'Woodcutter',
        repVillage: 0,
        repWolf: 0,
        curseLevel: 0,
        rebirths: 0
    }))
]).then(([data, player]) => {
    logs = data;
    playerState = player;
    activeJob = player.activeJob || 'Unknown';
    $('repVillage').textContent = player.repVillage;
    $('repWolf').textContent = player.repWolf;
    $('curseLevel').textContent = player.curseLevel;
    $('rebirths').textContent = player.rebirths;
    setupTabs();
    startLoop();
});
