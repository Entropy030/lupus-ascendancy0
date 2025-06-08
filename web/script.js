const EVENT_FLAVOR = {
    "Villager lynch patrol": "Drunken villagers roam with torches, searching for signs of the beast.",
    "Wolf hunt opportunity": "You spot fresh tracks leading deeper into the woods.",
    "Witch circle sighting": "Flickers of firelight illuminate cloaked figures in the glade.",
    "Full moon transformation": "Your bones ache and twist beneath the silver light."
};

const MOON_PHASES = ["\u{1F311}","\u{1F312}","\u{1F313}","\u{1F314}","\u{1F315}","\u{1F316}","\u{1F317}","\u{1F318}"];

let logs = [];
let activeJob = "";
let index = 0;
const totals = {};

function $(id) { return document.getElementById(id); }

function createSkillBar(skill) {
    const container = document.createElement('div');
    container.className = 'stat';
    container.dataset.skill = skill;

    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `${skill}: <span class="num">0</span>`;

    const progress = document.createElement('div');
    progress.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'bar';
    progress.appendChild(bar);

    container.appendChild(label);
    container.appendChild(progress);
    $('skills').appendChild(container);
}

function updateSkill(skill, value) {
    let container = document.querySelector(`[data-skill="${skill}"]`);
    if (!container) {
        createSkillBar(skill);
        container = document.querySelector(`[data-skill="${skill}"]`);
    }
    const num = container.querySelector('.num');
    const bar = container.querySelector('.bar');
    num.textContent = value;
    bar.style.width = Math.min(value, 100) + '%';
}

function showEntry(entry) {
    $('day').textContent = entry.day;
    $('age').textContent = entry.age;
    $('job').textContent = activeJob;

    $('coinNum').textContent = entry.coins;
    $('coinBar').style.width = Math.min(entry.coins, 100) + '%';

    if (entry.skillChanges) {
        for (const [skill, gain] of Object.entries(entry.skillChanges)) {
            totals[skill] = (totals[skill] || 0) + gain;
            updateSkill(skill, totals[skill]);
        }
    }

    if (entry.event) {
        $('eventName').textContent = entry.event;
        $('eventFlavor').textContent = EVENT_FLAVOR[entry.event] || '';
    } else {
        $('eventName').textContent = '';
        $('eventFlavor').textContent = '';
    }

    const phase = MOON_PHASES[entry.day % MOON_PHASES.length];
    $('moon').textContent = phase;
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

Promise.all([
    fetch('player_result.json').then(r => r.json()).catch(() => [
        {day:1, age:15, coins:10, coinGain:10, skillChanges:{"Strength":5}, event:"Wolf hunt opportunity"},
        {day:2, age:16, coins:20, coinGain:10, skillChanges:{"Strength":5}, event:null}
    ]),
    fetch('../player.json').then(r => r.json()).catch(() => ({activeJob:'Woodcutter'}))
]).then(([data, player]) => {
    logs = data;
    activeJob = player.activeJob || 'Unknown';
    startLoop();
});