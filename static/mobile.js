window.addEventListener('load', () => {

    console.log("[INFO] Mobile JS loaded!");

    // === GLOBAL VARIABLES for search.js compatibility ===
    window.clicks = [];
    window.currentLocationPoint = null;
    window.currentPath = [];

    let isFollowingUser = true;

    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d");

    const fallbackLocation = { x: 5515, y: 3249 };

    let centerX = fallbackLocation.x;
    let centerY = fallbackLocation.y;
    let zoomLevel = 3.5;

    let isDragging = false;
    let dragStartCenter = { x: 0, y: 0 };
    let dragStartFinger = { x: 0, y: 0 };
    let lastTouchDistance = null;

    // === Shade route switch sync ===
    const bottomToggle = document.getElementById("shade-toggle");
    const routeCheckbox = document.getElementById("enable-shade-route");

    if (bottomToggle && routeCheckbox) {
        bottomToggle.addEventListener("change", () => {
            routeCheckbox.checked = bottomToggle.checked;
        });

        routeCheckbox.addEventListener("change", () => {
            bottomToggle.checked = routeCheckbox.checked;
        });
    }

    function drawClickMarkers() {
        resizeCanvas();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.translate(-centerX, -centerY);

        if (mapImgLoaded) {
            ctx.drawImage(mapImg, 0, 0);
        }

        ctx.font = `${14 / zoomLevel}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        poiData.forEach(poi => {
            const x = poi.coord[0];
            const y = poi.coord[1];

            let symbol = "";
            const name = poi.name.toLowerCase();
            if (name.includes("toilet")) symbol = "🚻";
            else if (name.includes("bike")) symbol = "🚲";
            else if (name.includes("parking lot")) symbol = "🅿️";
            else if (name.includes("cafe") || name.includes("tea") || name.includes("boba") || name.includes("restaurant")) symbol = "☕";
            else if (name.includes("gallery") || name.includes("exhibition") || name.includes("hall") || name.includes("studio")) symbol = "🖼️";
            else if (name.includes("garden")) symbol = "🌸";
            else if (name.includes("library")) symbol = "📚";
            else if (name.includes("store") || name.includes("shop")) symbol = "🛍️";
            else if (name.includes("gate")) symbol = "🚪";
            else if (name.includes("picnic")) symbol = "🧺";
            else if (name.includes("research") || name.includes("lab") || name.includes("administration")) symbol = "🏢";
            else if (name.includes("bus")) symbol = "🚌";
            else if (name.includes("uber") || name.includes("taxi")) symbol = "🚕";
            else if (name.includes("celebration lawn")) symbol = "🎉";
            else if (name.includes("drinking")) symbol = "⛲";
            else if (name.includes("wheelchair")) symbol = "♿️";
            else symbol = poi.name.charAt(0).toUpperCase();

            ctx.fillStyle = "#000";
            ctx.fillText(symbol, x, y);

            const label = poi.name;
            ctx.font = `${12 / zoomLevel}px Arial`;
            const textMetrics = ctx.measureText(label);
            const padding = 4 / zoomLevel;
            const bgWidth = textMetrics.width + padding * 2;
            const bgHeight = 16 / zoomLevel;

            ctx.fillStyle = "rgba(255,255,255,0.8)";
            const rectX = x - bgWidth / 2;
            const rectY = y + 18 / zoomLevel;
            const radius = 6 / zoomLevel;

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

            const labelY = rectY + bgHeight / 2;
            ctx.fillStyle = "#114514";
            ctx.fillText(label, x, labelY);
        });

        if (window.currentPath && window.currentPath.length > 1) {
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 2 / zoomLevel;
            ctx.beginPath();
            ctx.moveTo(window.currentPath[0].x, window.currentPath[0].y);
            for (let i = 1; i < window.currentPath.length; i++) {
                ctx.lineTo(window.currentPath[i].x, window.currentPath[i].y);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    window.drawClickMarkers = drawClickMarkers;

    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            isFollowingUser = false;
            document.getElementById("recenter-button").style.display = "block";

            dragStartCenter.x = centerX;
            dragStartCenter.y = centerY;
            dragStartFinger.x = e.touches[0].clientX;
            dragStartFinger.y = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            lastTouchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        }
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - dragStartFinger.x;
            const dy = e.touches[0].clientY - dragStartFinger.y;
            centerX = dragStartCenter.x - dx / zoomLevel;
            centerY = dragStartCenter.y - dy / zoomLevel;
            drawClickMarkers();
        } else if (e.touches.length === 2) {
            const newDist = getTouchDistance(e.touches[0], e.touches[1]);
            if (lastTouchDistance !== null) {
                const zoomFactor = newDist / lastTouchDistance;
                zoomLevel = Math.max(0.5, Math.min(5, zoomLevel * zoomFactor));
                drawClickMarkers();
            }
            lastTouchDistance = newDist;
        }
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
        if (e.touches.length === 0) {
            isDragging = false;
            lastTouchDistance = null;
        }
    }, { passive: false });

    function getTouchDistance(t1, t2) {
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const mapImg = new Image();
    let mapImgLoaded = false;
    mapImg.src = "/static/huntington_map_highres_cropped_enhanced.jpg";
    mapImg.onload = () => {
        mapImgLoaded = true;
        drawClickMarkers();
    };

    let poiData = [];
    fetch("/pois.json")
        .then(res => res.json())
        .then(data => {
            poiData = data;
            drawClickMarkers();
        });

    navigator.geolocation.watchPosition(
        pos => {
            window.currentLocationPoint = fallbackLocation;
            if (isFollowingUser) {
                centerX = window.currentLocationPoint.x;
                centerY = window.currentLocationPoint.y;
                drawClickMarkers();
                document.getElementById("recenter-button").style.display = "none";
            }
        },
        () => {
            window.currentLocationPoint = fallbackLocation;
            if (isFollowingUser) {
                centerX = fallbackLocation.x;
                centerY = fallbackLocation.y;
            }
            drawClickMarkers();
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    function resizeCanvas() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
    }

    window.recenterMap = () => {
        if (window.currentLocationPoint) {
            centerX = window.currentLocationPoint.x;
            centerY = window.currentLocationPoint.y;
            isFollowingUser = true;
            document.getElementById("recenter-button").style.display = "none";
            drawClickMarkers();
        }
    };

    window.sendPathRequest = function(start, end, allowThroughObstacles) {
        fetch("/path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start, end,
                allow_through_obstacles: allowThroughObstacles,
                use_shade: document.getElementById("enable-shade-route").checked
            })
        })
        .then(res => res.json())
        .then(data => {
            if (!data.path.length && !allowThroughObstacles) {
                window.sendPathRequest(start, end, true);
                return;
            }
            window.currentPath = data.path.map(p => ({ x: p.x, y: p.y }));
            fitZoomToPath(window.currentPath);
            drawClickMarkers();
            window.clicks = [];
        });
    };

    function fitZoomToPath(path) {
        if (!path.length) return;
        let minX = Math.min(...path.map(p => p.x));
        let maxX = Math.max(...path.map(p => p.x));
        let minY = Math.min(...path.map(p => p.y));
        let maxY = Math.max(...path.map(p => p.y));
        const margin = 50;
        const scaleX = (canvas.width - 2 * margin) / (maxX - minX);
        const scaleY = (canvas.height - 2 * margin) / (maxY - minY);
        zoomLevel = Math.max(0.5, Math.min(5, Math.min(scaleX, scaleY)));
        centerX = (minX + maxX) / 2;
        centerY = (minY + maxY) / 2;
    }

});
