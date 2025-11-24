// === SHADE MAP CONTROL ===

const shadeToggle = document.getElementById("shadeToggle");

// For drawing shade inside canvas
const shadeImg = new Image();
let shadeImgLoaded = false;

// Add listener for checkbox
shadeToggle.addEventListener("change", updateShadeLayer);

// === UPDATE SHADE LAYER ===
/**
 * Updates the shade overlay based on current time
 * Selects the appropriate shade PNG file based on month and 2-hour time interval
 * File naming format: MMHH.png (e.g., "0512.png" for May at noon)
 * Triggers map redraw after loading the shade image
 */
function updateShadeLayer() {
    const now = new Date();
    const hour = now.getHours();

    // === SAME LOGIC AS PYTHON ===
    let shadeHour = 8;

    if (hour >= 17) {
        shadeHour = 18;
    } else if (hour >= 15) {
        shadeHour = 16;
    } else if (hour >= 13) {
        shadeHour = 14;
    } else if (hour >= 11) {
        shadeHour = 12;
    } else if (hour >= 9) {
        shadeHour = 10;
    } else {
        shadeHour = 8;
    }

    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hourStr = String(shadeHour).padStart(2, '0');
    const filename = `${month}${hourStr}.png`;

    console.log(`[DEBUG] Time: ${hour}:${now.getMinutes()} → Using shade file: ${filename}`);

    if (shadeToggle.checked) {
        shadeImg.src = `/shade_png/${filename}`;
        shadeImg.onload = () => {
            shadeImgLoaded = true;
            drawClickMarkers();  // Trigger full redraw
        };
    } else {
        shadeImgLoaded = false;
        drawClickMarkers();
    }
}

// === SHADE ROUTE HELPER ===
/**
 * Checks if shade-optimized routing is enabled
 * @returns {boolean} True if the "enable-shade-route" checkbox is checked
 */
function isShadeRouteEnabled() {
    return document.getElementById("enable-shade-route").checked;
}

// === WEATHER CHECK FOR COMPLETE SHADOW ===
/**
 * Checks weather conditions and disables shade features if fully overcast
 * Shows alert and disables shade map/route toggles when not sunny
 * Re-enables controls when sunny conditions return
 * @param {string} currentWeather - Current weather description from API
 */
function checkForCompleteShadow(currentWeather) {
    const weather = currentWeather.toLowerCase();

    if (!weather.includes("clear") && !weather.includes("sun")) {
        alert("Complete Shadow Now!");

        // Disable "Show Shade Map"
        shadeToggle.checked = false;
        shadeToggle.disabled = true;
        updateShadeLayer();

        // Disable "Enable Shade Route"
        const shadeRoute = document.getElementById("enable-shade-route");
        shadeRoute.checked = false;
        shadeRoute.disabled = true;
    } else {
        // Sunny → re-enable controls
        shadeToggle.disabled = false;
        const shadeRoute = document.getElementById("enable-shade-route");
        shadeRoute.disabled = false;
    }
}
