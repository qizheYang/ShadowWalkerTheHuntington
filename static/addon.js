// let poiData = [];
// let poiImgLoaded = false;

// === DEG TO COMPASS ===
function degToCompass(deg) {
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[Math.round(deg / 22.5) % 16];
}

// === FETCH WEATHER DATA ===
async function fetchWeatherData() {
    const response = await fetch("/weather");
    const data = await response.json();

    const hourlyDiv = document.getElementById("hourly-forecast");
    hourlyDiv.innerHTML = "";

    if (data.error) {
        hourlyDiv.innerHTML = "Failed to load weather data.";
        return;
    }

    const laTz = "America/Los_Angeles";
    const now = new Date();
    const nowInLa = new Intl.DateTimeFormat('en-US', { timeZone: laTz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' })
        .formatToParts(now)
        .reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});

    const todayDate = parseInt(nowInLa.day, 10);
    const currentHour = parseInt(nowInLa.hour, 10);

    data.hourly.forEach((item, i) => {
        const dtUtc = new Date(item.dt * 1000);
        const dtInLa = new Intl.DateTimeFormat('en-US', { timeZone: laTz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' })
            .formatToParts(dtUtc)
            .reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});

        const dtDay = parseInt(dtInLa.day, 10);
        const dtHour = parseInt(dtInLa.hour, 10);

        if (dtDay === todayDate && dtHour >= currentHour) {
            const temp = item.temp;
            const humidity = item.humidity;
            const windSpeed = item.wind_speed;
            const windDir = degToCompass(item.wind_deg);
            const weather = item.weather.toLowerCase();

            // Check first weather for complete shadow
            if (i === 0) {
                checkForCompleteShadow(weather);
            }

            let emoji = "❓";
            if (weather.includes("clear")) emoji = "☀️";
            else if (weather.includes("cloud")) emoji = "☁️";
            else if (weather.includes("rain")) emoji = "🌧️";
            else if (weather.includes("drizzle")) emoji = "🌦️";
            else if (weather.includes("thunder")) emoji = "⛈️";
            else if (weather.includes("snow")) emoji = "❄️";
            else if (weather.includes("mist") || weather.includes("fog") || weather.includes("haze")) emoji = "🌫️";

            const entry = document.createElement("div");
            entry.style.cssText = "border-bottom:1px solid #ddd;padding:6px 4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;";
            entry.innerHTML = `
                <div style="flex: 0 0 50px; font-weight: bold;">${dtHour}:00</div>
                <div style="flex: 1 1 150px;">${emoji} ${weather}</div>
                <div style="flex: 0 0 auto;">🌡️ ${temp.toFixed(1)} °C</div>
                <div style="flex: 0 0 auto;">💨 ${windSpeed} km/h ${windDir}</div>
                <div style="flex: 0 0 auto;">💧 ${humidity}%</div>
            `;
            hourlyDiv.appendChild(entry);
        }
    });
}

// === DRAW SUN PATH PANEL ===
function drawSunPathWithSunCalc() {
    const lat = (mapTopLeft.lat + mapBottomRight.lat) / 2;
    const lng = (mapTopLeft.lon + mapBottomRight.lon) / 2;
    const canvas = document.getElementById("sunCanvas");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2 - 25;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);

    const now = new Date();
    const times = SunCalc.getTimes(now, lat, lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;
    const solarNoon = times.solarNoon;

    const sunrisePos = SunCalc.getPosition(sunrise, lat, lng);
    const sunsetPos = SunCalc.getPosition(sunset, lat, lng);

    let sunriseAzimuthDeg = (sunrisePos.azimuth * 180 / Math.PI + 180) % 360;
    let sunsetAzimuthDeg = (sunsetPos.azimuth * 180 / Math.PI + 180) % 360;

    let sunriseAngle = (sunriseAzimuthDeg - 90) * Math.PI / 180;
    let sunsetAngle = (sunsetAzimuthDeg - 90) * Math.PI / 180;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius, sunriseAngle, sunsetAngle, false);
    ctx.strokeStyle = "#fdd835";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.stroke();

    const daylightDurationMs = sunset - sunrise;
    const daylightHours = daylightDurationMs / (1000 * 60 * 60);

    ctx.font = '12px Arial';
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numSteps = Math.floor(daylightHours);

    for (let i = 0; i <= numSteps; i++) {
        const hourFraction = i / daylightHours;
        const angle = sunriseAngle + hourFraction * (sunsetAngle - sunriseAngle);

        const labelDate = new Date(sunrise.getTime() + i * 60 * 60 * 1000);
        const labelHour = labelDate.getHours();
        const label = `${labelHour.toString().padStart(2, '0')}`;

        const xOuter = (radius + 8) * Math.cos(angle);
        const yOuter = (radius + 8) * Math.sin(angle);
        const xInner = (radius - 5) * Math.cos(angle);
        const yInner = (radius - 5) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(xInner, yInner);
        ctx.lineTo(xOuter, yOuter);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = (i % 3 === 0) ? 2 : 1;
        ctx.stroke();

        if (i % 3 === 0 || i === 0 || i === numSteps) {
            const labelX = (radius - 15) * Math.cos(angle);
            const labelY = (radius - 15) * Math.sin(angle);
            ctx.fillText(label, labelX, labelY);
        }
    }

    const sunPos = SunCalc.getPosition(now, lat, lng);
    const sunAzimuth = sunPos.azimuth;
    const sunAltitude = sunPos.altitude;

    let azimuthDeg = (sunAzimuth * 180 / Math.PI + 180) % 360;
    let canvasAngle = (azimuthDeg - 90) * Math.PI / 180;

    if (sunAltitude > 0) {
        const r = radius * (1 - (sunAltitude / (Math.PI / 2)));
        const sunX = r * Math.cos(canvasAngle);
        const sunY = r * Math.sin(canvasAngle);

        ctx.beginPath();
        ctx.arc(sunX, sunY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 165, 0, 0.3)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sunX, sunY, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "orange";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    ctx.font = '14px Arial';
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -radius - 15);
    ctx.fillText('S', 0, radius + 15);
    ctx.fillText('E', radius + 15, 0);
    ctx.fillText('W', -radius - 15, 0);

    ctx.restore();

    document.getElementById("sun-times").innerHTML =
        `🌅 <b>Sunrise:</b> ${sunrise ? sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}<br>` +
        `🌇 <b>Sunset:</b> ${sunset ? sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}<br>` +
        `☀️ <b>Solar Noon:</b> ${solarNoon ? solarNoon.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}`;
}

// === DRAW SUN ON MAP ===
function drawSunOnMap() {
    const showSun = document.getElementById("show-sun-on-map").checked;
    if (!showSun) return;

    const now = new Date();
    const lat = (mapTopLeft.lat + mapBottomRight.lat) / 2;
    const lng = (mapTopLeft.lon + mapBottomRight.lon) / 2;

    const sunPos = SunCalc.getPosition(now, lat, lng);
    const sunAzimuth = sunPos.azimuth;
    const sunAltitude = sunPos.altitude;

    const azimuthDeg = (sunAzimuth * 180 / Math.PI + 180) % 360;
    const angleRad = (azimuthDeg - 90) * Math.PI / 180;

    const times = SunCalc.getTimes(now, lat, lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    const sunrisePos = SunCalc.getPosition(sunrise, lat, lng);
    const sunsetPos = SunCalc.getPosition(sunset, lat, lng);

    const sunriseAngle = ((sunrisePos.azimuth * 180 / Math.PI + 180) % 360 - 90) * Math.PI / 180;
    const sunsetAngle = ((sunsetPos.azimuth * 180 / Math.PI + 180) % 360 - 90) * Math.PI / 180;

    const fixedRadius = Math.min(canvas.width, canvas.height) * 0.25;
    const mapCenterX = canvas.width / 2;
    const mapCenterY = canvas.height / 2;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // === Full orbit
    ctx.beginPath();
    ctx.arc(mapCenterX, mapCenterY, fixedRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();

    // === Daylight arc
    ctx.beginPath();
    ctx.arc(mapCenterX, mapCenterY, fixedRadius, sunriseAngle, sunsetAngle, false);
    ctx.strokeStyle = "#fdd835";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.stroke();

    // === Sun position (on orbit)
    const sunOrbitRadius = fixedRadius;
    const sunX = mapCenterX + sunOrbitRadius * Math.cos(angleRad);
    const sunY = mapCenterY + sunOrbitRadius * Math.sin(angleRad);

    ctx.beginPath();
    ctx.arc(sunX, sunY, 10, 0, 2 * Math.PI);
    ctx.fillStyle = (sunAltitude > 0) ? "orange" : "gray";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // === Example object height (arbitrary units)
    const objectHeight = 50; // pixels for display
    const shadowLength = (sunAltitude > 0) ? objectHeight / Math.tan(sunAltitude) : 9999;

    // === Green arrow (object height) → vertical at center
    ctx.beginPath();
    ctx.moveTo(mapCenterX, mapCenterY);
    ctx.lineTo(mapCenterX, mapCenterY - objectHeight);
    ctx.strokeStyle = "green";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label for object height
    ctx.font = "12px Arial";
    ctx.fillStyle = "green";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Actual height", mapCenterX + 5, mapCenterY - objectHeight / 2);

    // === Blue arrow (shadow length) → projected in sun direction
    if (sunAltitude > 0 && shadowLength < fixedRadius * 2) {
        const shadowEndX = mapCenterX + shadowLength * Math.cos(angleRad + Math.PI); // opposite to sun azimuth
        const shadowEndY = mapCenterY + shadowLength * Math.sin(angleRad + Math.PI);

        ctx.beginPath();
        ctx.moveTo(mapCenterX, mapCenterY);
        ctx.lineTo(shadowEndX, shadowEndY);
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label for shadow length
        ctx.font = "12px Arial";
        ctx.fillStyle = "blue";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("Shadow length", shadowEndX + 5, shadowEndY);
    }

    ctx.restore();
}

// === INIT ADDON ===
fetchWeatherData();
drawSunPathWithSunCalc();

// Update sun path every 60 seconds
setInterval(drawSunPathWithSunCalc, 60000);

// // === LOAD POIS ===
// fetch('/pois.json')
//     .then(response => response.json())
//     .then(data => {
//         poiData = data;
//         poiImgLoaded = true;
//         console.log(`[INFO] Loaded ${poiData.length} POIs`);
//         drawClickMarkers(); // Redraw map with POIs after loading
//     })
//     .catch(err => {
//         console.error("[ERROR] Failed to load POIs:", err);
//     });
//
// // === POI Search Handler ===
// document.getElementById('poi-search').addEventListener('input', function() {
//     const query = this.value.trim().toLowerCase();
//     const resultsDiv = document.getElementById('poi-results');
//
//     if (query.length === 0) {
//         resultsDiv.style.display = 'none';
//         resultsDiv.innerHTML = '';
//         return;
//     }
//
//     // Filter POIs matching query
//     const matches = poiData.filter(poi => poi.name.toLowerCase().includes(query));
//
//     if (matches.length === 0) {
//         resultsDiv.style.display = 'none';
//         resultsDiv.innerHTML = '';
//         return;
//     }
//
//     // === SORT matches by distance from currentLocationPoint (if available)
//     matches.sort((a, b) => {
//         const distA = currentLocationPoint ? distanceSq(currentLocationPoint, a.coord) : 0;
//         const distB = currentLocationPoint ? distanceSq(currentLocationPoint, b.coord) : 0;
//         return distA - distB;
//     });
//
//     // === Special case: if user types "toilet" → only return closest toilet
//     let finalMatches = matches;
//     if (query === "toilet") {
//         if (matches.length > 0) {
//             finalMatches = [matches[0]];
//         }
//     }
//
//     // === Build dropdown
//     resultsDiv.style.display = 'block';
//     resultsDiv.innerHTML = '';
//
//     finalMatches.forEach(match => {
//         const div = document.createElement('div');
//         div.textContent = match.name;
//         div.style.padding = '6px';
//         div.style.cursor = 'pointer';
//         div.style.borderBottom = '1px solid #eee';
//
//         // === On click
//         div.addEventListener('click', () => {
//             console.log(`[INFO] Selected POI from search: ${match.name}`);
//
//             // === If tracking is OFF → start it first
//             if (!currentLocationPoint) {
//                 console.log("[INFO] Tracking OFF → starting tracking...");
//                 startLocationTracking();
//
//                 // Give short delay for location to arrive
//                 setTimeout(() => {
//                     if (currentLocationPoint) {
//                         // Set points and trigger path
//                         setSearchPath(currentLocationPoint, match.coord);
//                     } else {
//                         alert("⚠️ Unable to get current location. Try again.");
//                     }
//                 }, 1500); // 1.5 sec wait
//             } else {
//                 // Already tracking → set path immediately
//                 setSearchPath(currentLocationPoint, match.coord);
//             }
//
//             // Clear search UI
//             document.getElementById('poi-search').value = '';
//             resultsDiv.style.display = 'none';
//             resultsDiv.innerHTML = '';
//         });
//
//         resultsDiv.appendChild(div);
//     });
// });
//
// // === Utility: squared distance
// function distanceSq(p1, coord) {
//     const dx = p1.x - coord[0];
//     const dy = p1.y - coord[1];
//     return dx * dx + dy * dy;
// }
//
// // === Set path from current → selected POI
// function setSearchPath(startPoint, endCoord) {
//     clicks = [
//         { x: startPoint.x, y: startPoint.y },
//         { x: endCoord[0], y: endCoord[1] }
//     ];
//     currentPoint = { x: endCoord[0], y: endCoord[1] };
//
//     console.log(`[DEBUG] Path from current (${startPoint.x}, ${startPoint.y}) → POI (${endCoord[0]}, ${endCoord[1]})`);
//
//     drawClickMarkers();
//
//     if (clicks.length === 2) {
//         sendPathRequest(clicks[0], clicks[1], false);
//     }
// }
