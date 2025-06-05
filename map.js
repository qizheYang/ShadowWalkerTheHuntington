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
function updateCanvasSize() {
    canvas.width = img.width * displayScaleX;
    canvas.height = img.height * displayScaleY;
}

// === DRAW CLICK MARKERS ===
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
function zoomIn() {
    zoomScale *= 1.2;
    drawClickMarkers();
}

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
function resetMap() {
    clicks = [];
    currentPath = [];
    currentPoint = null;
    drawClickMarkers();
}

// === PRESS AND HOLD MOVE ===
let moveInterval = null;
let moveStartTime = 0;

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

function stopMove() {
    if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
    }
}

// === MOVE MAP ===
function moveMap(dx, dy) {
    offsetX -= dx;
    offsetY -= dy;
    drawClickMarkers();
}

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

        const x_frac = (lon - mapTopLeft.lon) / (mapBottomRight.lon - mapTopLeft.lon);
        const y_frac = (mapTopLeft.lat - lat) / (mapTopLeft.lat - mapBottomRight.lat);

        let x_grid = Math.floor(x_frac * width);
        let y_grid = Math.floor(y_frac * height);

        if (x_grid >= 0 && x_grid < width && y_grid >= 0 && y_grid < height) {
            currentLocationPoint = { x: x_grid, y: y_grid };
            console.log(`[DEBUG] Updated location: (${x_grid}, ${y_grid})`);
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

function stopLocationTracking() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        currentLocationPoint = null;
        drawClickMarkers();
        console.log("[DEBUG] Stopped location tracking.");
    }
}

// function useCurrentLocation() {
//     if (!navigator.geolocation) {
//         console.log("[ERROR] Geolocation not supported");
//         return;
//     }
//
//     navigator.geolocation.getCurrentPosition(position => {
//         const lat = position.coords.latitude;
//         const lon = position.coords.longitude;
//
//         // Convert lat/lon to map X/Y
//         const mapped = latLonToMapCoords(lat, lon);
//         if (mapped) {
//             clicks.push(mapped);
//             currentPoint = mapped;
//             console.log(`[DEBUG] Placed point at current location: (${mapped.x}, ${mapped.y})`);
//
//             drawClickMarkers();
//
//             // If two clicks now, auto send path
//             if (clicks.length === 2) {
//                 sendPathRequest(clicks[0], clicks[1], false);
//             }
//         } else {
//             console.log("[WARNING] Could not map current location to map coordinates");
//         }
//     }, error => {
//         console.log("[ERROR] Geolocation error:", error);
//     });
// }
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
