let tick = 0;
const moon = document.getElementById('moonIcon');
const themeSelect = document.getElementById('themeToggle');

function applyTheme(tick) {
    const mode = themeSelect?.value || 'cycle';
    localStorage.setItem('themeMode', mode);

    const isNight = (tick % 24) >= 12;

    if (mode === 'day') {
        document.body.classList.add('day');
        document.body.classList.remove('night');
    } else if (mode === 'night') {
        document.body.classList.add('night');
        document.body.classList.remove('day');
    } else {
        document.body.classList.toggle('night', isNight);
        document.body.classList.toggle('day', !isNight);
    }

    // Rotate moon
    const deg = (tick % 24) * 15;
    if (moon) moon.style.transform = `rotate(${deg}deg)`;
}

// Restore saved mode on load
window.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem('themeMode') || 'cycle';
    const selector = document.getElementById('themeToggle');
    if (selector) selector.value = saved;
    applyTheme(tick);
});

// Simulate idle loop tick
setInterval(() => {
    tick++;
    applyTheme(tick);
}, 2000);