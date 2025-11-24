// === MAP VARIABLES ===
const width = window.map_width;
const height = window.map_height;

let currentLocationPoint = null;
let locationWatchId = null;

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const img = new Image();
img.src = "/static/huntington_map_highres_cropped_enhanced.jpg";

let displayScaleX = 1.0;
let displayScaleY = 1.0;
let zoomScale = 1.2;
let offsetX = 0;
let offsetY = 0;

let currentPoint = null;
let clicks = [];
let currentPath = [];

let walkabilityMap = [];

const mapTopLeft = { lat: 34.130500, lon: -118.117000 };
const mapBottomRight = { lat: 34.127000, lon: -118.111000 };

// === GEO LOCATORS ===
const geoLocators = [
    {
        name: "Geo Locator 1",
        coord: [3461, 7191],
        gps: [-118.1150712, 34.1236327]  // [lon, lat]
    },
    {
        name: "Geo Locator 2",
        coord: [4223, 3481],
        gps: [-118.1137654, 34.1289440]
    },
    {
        name: "Geo Locator 3",
        coord: [5513, 3079],
        gps: [-118.1115612, 34.1295811]
    },
    {
        name: "Geo Locator 4",
        coord: [6332, 6124],
        gps: [-118.1101312, 34.1251678]
    }
];

// === GPS → MAP XY ===
/**
 * Converts GPS coordinates (longitude, latitude) to map grid coordinates
 * Uses geo-locator reference points for linear interpolation
 * @param {number} lon - Longitude coordinate
 * @param {number} lat - Latitude coordinate
 * @returns {{x: number, y: number}} Map grid coordinates
 */
function gpsToMap(lon, lat) {
    // Bounding box
    const minLon = Math.min(...geoLocators.map(p => p.gps[0]));
    const maxLon = Math.max(...geoLocators.map(p => p.gps[0]));
    const minLat = Math.min(...geoLocators.map(p => p.gps[1]));
    const maxLat = Math.max(...geoLocators.map(p => p.gps[1]));

    const minX = Math.min(...geoLocators.map(p => p.coord[0]));
    const maxX = Math.max(...geoLocators.map(p => p.coord[0]));
    const minY = Math.min(...geoLocators.map(p => p.coord[1]));
    const maxY = Math.max(...geoLocators.map(p => p.coord[1]));

    const x = minX + ((lon - minLon) / (maxLon - minLon)) * (maxX - minX);
    const y = minY + ((maxLat - lat) / (maxLat - minLat)) * (maxY - minY);  // Y is flipped for latitude

    // Map to grid
    const x_grid = Math.floor(x / img.width * width);
    const y_grid = Math.floor(y / img.height * height);

    return { x: x_grid, y: y_grid };
}

// === PAN STATE ===
let isPanning = false;
let wasDragging = false;
let panStart = { x: 0, y: 0 };

// === LOAD WALKABILITY MAP ===
fetch("/walkability")
    .then(response => response.json())
    .then(data => {
        walkabilityMap = data;
        console.log("[DEBUG] Walkability map loaded.");
    });

// === MAP IMAGE LOADED ===
img.onload = () => {
    const maxCanvasWidth = window.innerWidth * 0.8;
    const maxCanvasHeight = window.innerHeight * 0.8;
    const scale = Math.min(maxCanvasWidth / img.width, maxCanvasHeight / img.height);

    displayScaleX = displayScaleY = scale;
    updateCanvasSize();
    resetView();
};

// === UPDATE CANVAS SIZE ===
/**
 * Updates the canvas dimensions based on image size and display scale
 * Called when the map image loads or display scale changes
 */
function updateCanvasSize() {
    canvas.width = img.width * displayScaleX;
    canvas.height = img.height * displayScaleY;
}

// === DRAW CLICK MARKERS ===
/**
 * Main rendering function that redraws the entire map canvas including:
 * - Base map image with zoom/pan transforms
 * - Shade overlay (if enabled)
 * - POI markers with emoji symbols and labels
 * - Navigation path (lime green line)
 * - Start point (blue), end point (red), current point (green)
 * - Sun overlay and current location indicator (blue dot)
 */
function drawClickMarkers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom + pan transform
    ctx.setTransform(zoomScale, 0, 0, zoomScale, offsetX, offsetY);

    // Draw base map
    ctx.drawImage(img, 0, 0, img.width * displayScaleX, img.height * displayScaleY);

    // Draw shade map
    if (shadeToggle.checked && shadeImgLoaded) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(
            shadeImg,
            0, 0, shadeImg.width, shadeImg.height,
            0, 0, img.width * displayScaleX, img.height * displayScaleY
        );
        ctx.globalAlpha = 1.0;
    }

    // === Draw POIs if enabled
    // === Draw POIs if enabled
    const showPOIs = document.getElementById("show-pois-on-map")?.checked;
    if (showPOIs && poiImgLoaded) {
        ctx.font = `${14 / zoomScale}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        poiData.forEach(poi => {
            const x_px = poi.coord[0] * displayScaleX;
            const y_px = poi.coord[1] * displayScaleY;

            let symbol = "";
            const nameLower = poi.name.toLowerCase();

            if (nameLower.includes("toilet")) symbol = "🚻";
            else if (nameLower.includes("bike")) symbol = "🚲";
            else if (nameLower.includes("parking lot")) symbol = "🅿️";
            else if (nameLower.includes("cafe") || nameLower.includes("tea") || nameLower.includes("boba") || nameLower.includes("restaurant")) symbol = "☕";
            else if (nameLower.includes("gallery") || nameLower.includes("exhibition") || nameLower.includes("hall") || nameLower.includes("studio")) symbol = "🖼️";
            else if (nameLower.includes("garden")) symbol = "🌸";
            else if (nameLower.includes("library")) symbol = "📚";
            else if (nameLower.includes("store") || nameLower.includes("shop")) symbol = "🛍️";
            else if (nameLower.includes("gate")) symbol = "🚪";
            else if (nameLower.includes("picnic")) symbol = "🧺";
            else if (nameLower.includes("research") || nameLower.includes("lab") || nameLower.includes("administration")) symbol = "🏢";
            else if (nameLower.includes("bus")) symbol = "🚌";
            else if (nameLower.includes("uber") || nameLower.includes("taxi")) symbol = "🚕";
            else if (nameLower.includes("celebration lawn")) symbol = "🎉";
            else if (nameLower.includes("drinking")) symbol = "⛲";
            else if (nameLower.includes("wheelchair")) symbol = "♿️";
            else {
                // Unique → first letter capitalized
                symbol = poi.name.charAt(0).toUpperCase();
            }

            // === Draw emoji / symbol
            ctx.fillStyle = "#000";
            ctx.fillText(symbol, x_px, y_px);

            // === Measure name width
            const label = poi.name;
            ctx.font = `${12 / zoomScale}px Arial`;
            const textMetrics = ctx.measureText(label);
            const padding = 4 / zoomScale;
            const bgWidth = textMetrics.width + padding * 2;
            const bgHeight = 16 / zoomScale;

            // === Draw rounded rectangle background
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            const rectX = x_px - bgWidth / 2;
            const rectY = y_px + (18 / zoomScale);  // slight spacing below symbol
            const radius = 6 / zoomScale;  // scale corner radius!

            ctx.beginPath();
            ctx.moveTo(rectX + radius, rectY);
            ctx.lineTo(rectX + bgWidth - radius, rectY);
            ctx.quadraticCurveTo(rectX + bgWidth, rectY, rectX + bgWidth, rectY + radius);
            ctx.lineTo(rectX + bgWidth, rectY + bgHeight - radius);
            ctx.quadraticCurveTo(rectX + bgWidth, rectY + bgHeight, rectX + bgWidth - radius, rectY + bgHeight);
            ctx.lineTo(rectX + radius, rectY + bgHeight);
            ctx.quadraticCurveTo(rectX, rectY + bgHeight, rectX, rectY + bgHeight - radius);
            ctx.lineTo(rectX, rectY + radius);
            ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
            ctx.closePath();
            ctx.fill();

            // === Now draw the name centered in rectangle
            const labelY = rectY + bgHeight / 2;
            ctx.fillStyle = "#114514"; // iiyo!
            ctx.fillText(label, x_px, labelY);

        });
    }


    // Draw path
    if (currentPath.length) {
        drawPath(currentPath);
    }

    // Draw points
    if (clicks[0]) {
        const start = clicks[0];
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(start.x * displayScaleX * (img.width / width), start.y * displayScaleY * (img.height / height), 5 / zoomScale, 0, 2 * Math.PI);
        ctx.fill();
    }

    if (clicks[1]) {
        const end = clicks[1];
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(end.x * displayScaleX * (img.width / width), end.y * displayScaleY * (img.height / height), 5 / zoomScale, 0, 2 * Math.PI);
        ctx.fill();
    }

    if (currentPoint) {
        ctx.fillStyle = "green";
        ctx.beginPath();
        ctx.arc(currentPoint.x * displayScaleX * (img.width / width), currentPoint.y * displayScaleY * (img.height / height), 6 / zoomScale, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Draw compass
    drawSunOnMap();

    // Draw current location pin
    if (currentLocationPoint) {
        ctx.fillStyle = "dodgerblue";
        ctx.beginPath();
        ctx.arc(currentLocationPoint.x * displayScaleX * (img.width / width), currentLocationPoint.y * displayScaleY * (img.height / height), 8 / zoomScale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2 / zoomScale;
        ctx.stroke();
    }
}

// === CLICK HANDLER ===
canvas.addEventListener("click", function(e) {
    if (wasDragging) {
        console.log("[DEBUG] Ignoring click — was dragging");
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x_display = (e.clientX - rect.left - offsetX) / zoomScale;
    const y_display = (e.clientY - rect.top - offsetY) / zoomScale;

    let x_grid = Math.floor(x_display / displayScaleX * (width / img.width));
    let y_grid = Math.floor(y_display / displayScaleY * (height / img.height));

    if (x_grid < 0 || x_grid >= width || y_grid < 0 || y_grid >= height) {
        console.log("[DEBUG] Click out of bounds!");
        return;
    }

    const snapped = snapToNearestWalkable(x_grid, y_grid);
    x_grid = snapped.x;
    y_grid = snapped.y;

    clicks.push({ x: x_grid, y: y_grid });
    currentPoint = { x: x_grid, y: y_grid };

    console.log(`[DEBUG] Click ${clicks.length}: (${x_grid}, ${y_grid})`);

    drawClickMarkers();

    if (clicks.length === 2) {
        sendPathRequest(clicks[0], clicks[1], false);
    }
});

// === SNAP TO NEAREST WALKABLE ===
/**
 * Snaps a coordinate to the nearest walkable point on the map
 * Searches in expanding radius up to 20 pixels from original point
 * @param {number} x - X grid coordinate
 * @param {number} y - Y grid coordinate
 * @returns {{x: number, y: number}} Nearest walkable coordinate or original if none found
 */
function snapToNearestWalkable(x, y) {
    if (!walkabilityMap.length) return { x, y };
    if (walkabilityMap[y][x] === 1) return { x, y };

    const maxRadius = 20;
    for (let r = 1; r <= maxRadius; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    if (walkabilityMap[ny][nx] === 1) return { x: nx, y: ny };
                }
            }
        }
    }
    console.log("[WARNING] No walkable point found nearby!");
    return { x, y };
}

// === SEND PATH REQUEST ===
/**
 * Sends a pathfinding request to the server
 * Automatically retries with obstacles allowed if initial path fails
 * @param {{x: number, y: number}} start - Starting point coordinates
 * @param {{x: number, y: number}} end - Ending point coordinates
 * @param {boolean} allowThroughObstacles - Whether to allow paths through non-walkable areas
 */
function sendPathRequest(start, end, allowThroughObstacles) {
    console.log("[DEBUG] Sending path request:", start, "→", end, "allow:", allowThroughObstacles);

    fetch("/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            start,
            end,
            allow_through_obstacles: allowThroughObstacles,
            use_shade: isShadeRouteEnabled()
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log("[DEBUG] Received path response:", data);
        if (!data.path.length && !allowThroughObstacles) {
            console.log("Retrying with obstacles allowed");
            sendPathRequest(start, end, true);
            return;
        }
        currentPath = data.path;
        drawClickMarkers();
        clicks = [];
    });
}

// === DRAW PATH ===
/**
 * Draws the navigation path on the canvas as a lime green line
 * @param {Array<{x: number, y: number}>} path - Array of path coordinates
 */
function drawPath(path) {
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2 / zoomScale;
    ctx.beginPath();
    ctx.moveTo(path[0].x * displayScaleX * (img.width / width), path[0].y * displayScaleY * (img.height / height));
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * displayScaleX * (img.width / width), path[i].y * displayScaleY * (img.height / height));
    }
    ctx.stroke();
}

// === ZOOM ===
/**
 * Zooms in on the map by a factor of 1.2x
 */
function zoomIn() {
    zoomScale *= 1.2;
    drawClickMarkers();
}

/**
 * Zooms out on the map by a factor of 1.2x
 * Prevents zooming out beyond 1.0x scale
 */
function zoomOut() {
    const newZoom = zoomScale / 1.2;
    if (newZoom >= 1.0) {
        zoomScale = newZoom;
        drawClickMarkers();
    }
}

// === WHEEL ZOOM ===
canvas.addEventListener("wheel", function(e) {
    e.preventDefault();

    const scaleFactor = 1.2;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offsetX) / zoomScale;
    const mouseY = (e.clientY - rect.top - offsetY) / zoomScale;
    const zoomDirection = e.deltaY < 0 ? 1 : -1;

    let newZoom = zoomScale * (zoomDirection > 0 ? scaleFactor : 1 / scaleFactor);

    // Clamp zoom
    if (newZoom < 1.0) newZoom = 1.0;

    offsetX -= mouseX * (newZoom - zoomScale);
    offsetY -= mouseY * (newZoom - zoomScale);

    zoomScale = newZoom;
    drawClickMarkers();
}, { passive: false });

// === PAN (DRAG) ===
canvas.addEventListener("mousedown", function(e) {
    isPanning = true;
    wasDragging = false;
    panStart.x = e.clientX - offsetX;
    panStart.y = e.clientY - offsetY;
});

canvas.addEventListener("mousemove", function(e) {
    if (isPanning) {
        const dx = e.clientX - panStart.x - offsetX;
        const dy = e.clientY - panStart.y - offsetY;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            wasDragging = true;
        }

        offsetX = e.clientX - panStart.x;
        offsetY = e.clientY - panStart.y;
        drawClickMarkers();
    }
});

canvas.addEventListener("mouseup", function(e) {
    isPanning = false;
});

canvas.addEventListener("mouseleave", function(e) {
    isPanning = false;
});

// === RESET VIEW ===
/**
 * Resets the map view to default zoom (1.2x) and centers the map in the canvas
 */
function resetView() {
    zoomScale = 1.2;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const mapDisplayWidth = img.width * displayScaleX * zoomScale;
    const mapDisplayHeight = img.height * displayScaleY * zoomScale;

    offsetX = (canvasWidth - mapDisplayWidth) / 2;
    offsetY = (canvasHeight - mapDisplayHeight) / 2;

    drawClickMarkers();
}

// === RESET MAP ===
/**
 * Clears all navigation state including clicks, path, and current point
 * Triggers a redraw to show the clean map
 */
function resetMap() {
    clicks = [];
    currentPath = [];
    currentPoint = null;
    drawClickMarkers();
}

// === PRESS AND HOLD MOVE ===
let moveInterval = null;
let moveStartTime = 0;

/**
 * Starts continuous map movement in the specified direction
 * Speed accelerates over time for faster navigation
 * @param {number} dx - Horizontal direction (-1, 0, or 1)
 * @param {number} dy - Vertical direction (-1, 0, or 1)
 */
function startMove(dx, dy) {
    if (moveInterval) return;
    moveStartTime = Date.now();
    moveInterval = setInterval(() => {
        const elapsed = Date.now() - moveStartTime;
        let baseStep = 5;
        let speedFactor = 0.02;
        let step = baseStep + Math.log(1 + elapsed) * speedFactor * elapsed;
        moveMap(dx * step, dy * step);
    }, 50);
}

/**
 * Stops the continuous map movement initiated by startMove
 */
function stopMove() {
    if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
    }
}

// === MOVE MAP ===
/**
 * Moves the map by the specified pixel offset
 * @param {number} dx - Horizontal offset in pixels
 * @param {number} dy - Vertical offset in pixels
 */
function moveMap(dx, dy) {
    offsetX -= dx;
    offsetY -= dy;

    clampOffsets();
    drawClickMarkers();
}

/**
 * Clamps map offsets to prevent panning beyond map boundaries
 * Ensures the map always fills the visible canvas area
 */
function clampOffsets() {
    const mapDisplayWidth = img.width * displayScaleX * zoomScale;
    const mapDisplayHeight = img.height * displayScaleY * zoomScale;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Clamp offsetX
    const maxOffsetX = 0;
    const minOffsetX = canvasWidth - mapDisplayWidth;
    if (offsetX > maxOffsetX) offsetX = maxOffsetX;
    if (offsetX < minOffsetX) offsetX = minOffsetX;

    // Clamp offsetY
    const maxOffsetY = 0;
    const minOffsetY = canvasHeight - mapDisplayHeight;
    if (offsetY > maxOffsetY) offsetY = maxOffsetY;
    if (offsetY < minOffsetY) offsetY = minOffsetY;
}

/**
 * Starts continuous GPS location tracking using the Geolocation API
 * Updates currentLocationPoint when position changes
 * Converts GPS coordinates to map coordinates and triggers redraw
 */
function startLocationTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported.");
        return;
    }

    if (locationWatchId !== null) {
        console.log("[DEBUG] Already tracking location.");
        return;
    }

    locationWatchId = navigator.geolocation.watchPosition(success, error, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
    });

    function success(pos) {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const mapped = gpsToMap(lon, lat);

        if (mapped.x >= 0 && mapped.x < width && mapped.y >= 0 && mapped.y < height) {
            currentLocationPoint = mapped;
            console.log(`[DEBUG] Updated location: (${mapped.x}, ${mapped.y}) from GPS (${lon}, ${lat})`);
            drawClickMarkers();
        } else {
            console.log("[DEBUG] Location outside map bounds.");
            currentLocationPoint = null;
            drawClickMarkers();
        }
    }

    function error(err) {
        console.warn(`[ERROR] Location error: ${err.message}`);
        currentLocationPoint = null;
        drawClickMarkers();
    }
}

/**
 * Stops GPS location tracking and clears the current location marker
 */
function stopLocationTracking() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        currentLocationPoint = null;
        drawClickMarkers();
        console.log("[DEBUG] Stopped location tracking.");
    }
}

/**
 * Gets current GPS location once and adds it as a navigation point
 * Automatically triggers pathfinding if this is the second point
 */
function useCurrentLocation() {
    if (!navigator.geolocation) {
        console.log("[ERROR] Geolocation not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        // Convert lat/lon to map X/Y
        const mapped = latLonToMapCoords(lat, lon);
        if (mapped) {
            clicks.push(mapped);
            currentPoint = mapped;
            console.log(`[DEBUG] Placed point at current location: (${mapped.x}, ${mapped.y})`);

            drawClickMarkers();

            // If two clicks now, auto send path
            if (clicks.length === 2) {
                sendPathRequest(clicks[0], clicks[1], false);
            }
        } else {
            console.log("[WARNING] Could not map current location to map coordinates");
        }
    }, error => {
        console.log("[ERROR] Geolocation error:", error);
    });
}
//
// function latLonToMapCoords(lat, lon) {
//     // Transform function
//     const latFrac = (mapTopLeft.lat - lat) / (mapTopLeft.lat - mapBottomRight.lat);
//     const lonFrac = (lon - mapTopLeft.lon) / (mapBottomRight.lon - mapTopLeft.lon);
//
//     const x = Math.floor(lonFrac * width);
//     const y = Math.floor(latFrac * height);
//
//     // Clamp to bounds
//     const xClamped = Math.max(0, Math.min(width - 1, x));
//     const yClamped = Math.max(0, Math.min(height - 1, y));
//
//     return { x: xClamped, y: yClamped };
// }

