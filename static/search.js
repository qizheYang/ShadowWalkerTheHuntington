let poiData = [];
let poiImgLoaded = false;

let selectedStartCoord = null;
let selectedEndCoord = null;

// === LOAD POIS ===
fetch('/pois.json')
    .then(response => response.json())
    .then(data => {
        poiData = data;
        poiImgLoaded = true;
        console.log(`[INFO] Loaded ${poiData.length} POIs`);
        drawClickMarkers();
    })
    .catch(err => {
        console.error("[ERROR] Failed to load POIs:", err);
    });

// === Attach input & focus listeners
["start", "end"].forEach(type => {
    const input = document.getElementById(`${type}-search`);
    input.addEventListener("input", () => {
        handleSearchInput(input.value.trim().toLowerCase(), type);
    });
    input.addEventListener("focus", () => {
        handleSearchInput(input.value.trim().toLowerCase(), type);
    });
});

/**
 * Handles search input for start/end location fields
 * Filters POIs by query, sorts by distance, and shows results dropdown
 * Special handling for toilet/drinking fountain keywords (returns closest match)
 * @param {string} query - Search query (lowercase, trimmed)
 * @param {string} type - Either 'start' or 'end' to identify which field
 */
function handleSearchInput(query, type) {
    const resultsDiv = document.getElementById(`${type}-results`);
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '';

    let isSpecial = false;
    let specialLabel = '';

    const toiletKeywords = ['toilet', 'restroom', 'bathroom', 'wc', 'lavatory'];
    const drinkingKeywords = ['drinking fountain', 'water', 'hydration', 'hydrant'];

    let canonicalQuery = query;
    let categoryRedirect = null;

    // Improved partial keyword match
    for (const k of toiletKeywords) {
        if (k.includes(query) || query.includes(k) || k.startsWith(query) || query.startsWith(k)) {
            canonicalQuery = 'toilet';
            categoryRedirect = 'toilet';
            break;
        }
    }
    if (!categoryRedirect) {
        for (const k of drinkingKeywords) {
            if (k.includes(query) || query.includes(k) || k.startsWith(query) || query.startsWith(k)) {
                canonicalQuery = 'drinking fountain';
                categoryRedirect = 'drinking fountain';
                break;
            }
        }
    }

    // Add "Your location" shortcut
    if (currentLocationPoint) {
        const locDiv = document.createElement('div');
        locDiv.style.padding = '6px';
        locDiv.style.cursor = 'pointer';
        locDiv.style.borderBottom = '1px solid #eee';
        locDiv.innerHTML = `<span style="font-size: 16px;">📍</span> Your location`;

        locDiv.addEventListener('click', () => {
            document.getElementById(`${type}-search`).value = "Your location";
            applySearchSelection(type, [currentLocationPoint.x, currentLocationPoint.y]);
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        });

        resultsDiv.appendChild(locDiv);
    }

    if (canonicalQuery.length === 0) return;

    let matches = poiData.filter(poi => poi.name.toLowerCase().includes(canonicalQuery));
    if (matches.length === 0) return;

    let referencePoint = (type === 'end' && clicks[0]) ? clicks[0] : currentLocationPoint;
    if (referencePoint) {
        matches.sort((a, b) => distanceSq(referencePoint, a.coord) - distanceSq(referencePoint, b.coord));
    }

    if (categoryRedirect === 'toilet' || categoryRedirect === 'drinking fountain') {
        matches = [matches[0]];
        isSpecial = true;
        specialLabel = `closest ${categoryRedirect}`;
    }

    matches.forEach((match, index) => {
        const div = document.createElement('div');
        div.style.padding = '6px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';

        const nameDiv = document.createElement('div');
        nameDiv.textContent = match.name;
        div.appendChild(nameDiv);

        if (isSpecial && index === 0) {
            const hintDiv = document.createElement('div');
            hintDiv.textContent = specialLabel;
            hintDiv.style.fontSize = '12px';
            hintDiv.style.fontStyle = 'italic';
            hintDiv.style.color = 'gray';
            div.appendChild(hintDiv);
        }

        div.addEventListener('click', () => {
            document.getElementById(`${type}-search`).value = match.name;
            applySearchSelection(type, match.coord);
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
            console.log(`[INFO] Selected POI from ${type} search: ${match.name} at (${match.coord[0]}, ${match.coord[1]})`);
        });

        resultsDiv.appendChild(div);
    });
}

// === Apply selected coordinates
/**
 * Applies the selected POI coordinates to the navigation state
 * Updates clicks array and triggers map redraw
 * @param {string} type - Either 'start' or 'end'
 * @param {number[]} coord - [x, y] coordinates of the selected POI
 */
function applySearchSelection(type, coord) {
    if (type === 'start') {
        clicks[0] = { x: coord[0], y: coord[1] };
        selectedStartCoord = clicks[0];
    } else {
        clicks[1] = { x: coord[0], y: coord[1] };
        selectedEndCoord = clicks[1];
    }
    drawClickMarkers();
}

// === Utility: squared distance
/**
 * Calculates squared Euclidean distance between a point and coordinate array
 * Uses squared distance to avoid expensive sqrt operation for comparisons
 * @param {{x: number, y: number}} p1 - First point object
 * @param {number[]} coord - [x, y] coordinate array
 * @returns {number} Squared distance between the two points
 */
function distanceSq(p1, coord) {
    const dx = p1.x - coord[0];
    const dy = p1.y - coord[1];
    return dx * dx + dy * dy;
}

// === Handle Find Path
document.getElementById('find-path-btn').addEventListener('click', () => {
    const startText = document.getElementById('start-search').value.trim();
    const endText = document.getElementById('end-search').value.trim();

    if (!startText && !endText) {
        alert("No Input");
        return;
    }
    if (!endText) {
        alert("Please select a destination");
        return;
    }

    let startPoint = selectedStartCoord || (startText === "Your location" ? currentLocationPoint : findCoord(startText));
    let endPoint = selectedEndCoord || (endText === "Your location" ? currentLocationPoint : findCoord(endText));

    if (!startPoint || !endPoint) {
        alert("Start or end point not recognized");
        return;
    }

    clicks[0] = startPoint;
    clicks[1] = endPoint;

    console.log(`[DEBUG] Sending path: (${startPoint.x}, ${startPoint.y}) → (${endPoint.x}, ${endPoint.y})`);
    drawClickMarkers();
    sendPathRequest(startPoint, endPoint, false);
});

// === Fallback lookup by name
/**
 * Finds POI coordinates by exact name match (case-insensitive)
 * Used as fallback when coordinates weren't captured from dropdown selection
 * @param {string} name - POI name to search for
 * @returns {{x: number, y: number}|null} Coordinates object or null if not found
 */
function findCoord(name) {
    const match = poiData.find(p => p.name.toLowerCase() === name.toLowerCase());
    return match ? { x: match.coord[0], y: match.coord[1] } : null;
}
