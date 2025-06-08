let logData = [];
let current = 0;

function renderNext() {
    if (current >= logData.length) return;
    const entry = logData[current++];
    const div = document.getElementById('log');
    let skillText = '';
    for (const [skill, gain] of Object.entries(entry.skillChanges || {})) {
        skillText += `${skill}: +${gain} XP\n`;
    }
    const eventText = entry.event ? `Event: ${entry.event}` : 'No event';
    div.textContent += `Day ${entry.day} (Age ${entry.age})\nCoins: +${entry.coinGain}\n${skillText}${eventText}\n\n`;
}

document.getElementById('next').addEventListener('click', renderNext);

fetch('player_result.json')
    .then(r => r.json())
    .then(data => { logData = data; })
    .catch(() => {
        // Mock data if no result file
        logData = [
            {day:1, age:15, coins:10, coinGain:10, skillChanges:{"Tracking":5}, event:"Wolf hunt opportunity"},
            {day:2, age:16, coins:20, coinGain:10, skillChanges:{"Tracking":5}, event:null}
        ];
    });

