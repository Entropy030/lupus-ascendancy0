let tick = 0;
const moon = document.getElementById('moonIcon');

function updateTheme() {
    tick++;
    const isNight = (tick % 24) >= 12;
    document.body.classList.toggle('night', isNight);
    document.body.classList.toggle('day', !isNight);

    // Rotate moon as clock (optional visual)
    const deg = (tick % 24) * 15; // 360° / 24
    moon.style.transform = `rotate(${deg}deg)`;
}

// Call this in your idle loop every simulated 'hour'
setInterval(updateTheme, 1000);  // Adjust timing as needed