const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const img = new Image();
img.src = "/static/huntington_map_highres_cropped_enhanced.jpg";

// Zoom/pan state
let zoomScale = 1.0;
let offsetX = 0;
let offsetY = 0;

// Image size
let displayWidth;
let displayHeight;

img.onload = async () => {
    displayWidth = 1000;
    const scale = displayWidth / img.width;
    displayHeight = img.height * scale;

    canvas.dataset.baseScale = scale;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Initial draw
    draw();

    console.log(`Image loaded: original ${img.width}x${img.height}, display ${displayWidth}x${displayHeight}`);

    await loadAndDrawPOIs();
};

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoomScale, 0, 0, zoomScale, offsetX, offsetY);
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
}

async function loadAndDrawPOIs() {
    draw();

    const response = await fetch("/get_pois");
    const pois = await response.json();

    ctx.font = "12px Arial";
    ctx.fillStyle = "black";

    for (const poi of pois) {
        const [x, y] = poi.coord;
        const baseScale = parseFloat(canvas.dataset.baseScale);
        const x_display = x * baseScale;
        const y_display = y * baseScale;

        const x_zoomed = x_display * zoomScale + offsetX;
        const y_zoomed = y_display * zoomScale + offsetY;

        // Draw point
        ctx.beginPath();
        ctx.arc(x_display, y_display, 5 / zoomScale, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();

        // Label (fixed size)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "black";
        ctx.fillText(poi.name, x_zoomed + 6, y_zoomed - 6);

        // Restore zoom transform for next point
        ctx.setTransform(zoomScale, 0, 0, zoomScale, offsetX, offsetY);
    }
}

canvas.addEventListener("click", async (event) => {
    const rect = canvas.getBoundingClientRect();
    const x_screen = event.clientX - rect.left;
    const y_screen = event.clientY - rect.top;

    const x_display = (x_screen - offsetX) / zoomScale;
    const y_display = (y_screen - offsetY) / zoomScale;

    const baseScale = parseFloat(canvas.dataset.baseScale);
    const x_original = x_display / baseScale;
    const y_original = y_display / baseScale;

    console.log(`Clicked at display (${x_display.toFixed(2)}, ${y_display.toFixed(2)}) → original (${x_original.toFixed(2)}, ${y_original.toFixed(2)})`);

    const name = prompt(`Enter name for point (${Math.round(x_original)}, ${Math.round(y_original)}):`);
    if (name) {
        const poi = {
            name: name,
            coord: [Math.round(x_original), Math.round(y_original)]
        };

        const response = await fetch("/save_poi", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(poi)
        });

        const result = await response.json();
        alert(result.message);

        await loadAndDrawPOIs();
    }
});

// Zoom handler
canvas.addEventListener("wheel", async (event) => {
    event.preventDefault();

    const scaleFactor = 1.1;
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    if (event.deltaY < 0) {
        // Zoom in
        zoomScale *= scaleFactor;
        offsetX = mouseX - (mouseX - offsetX) * scaleFactor;
        offsetY = mouseY - (mouseY - offsetY) * scaleFactor;
    } else {
        // Zoom out
        zoomScale /= scaleFactor;
        offsetX = mouseX - (mouseX - offsetX) / scaleFactor;
        offsetY = mouseY - (mouseY - offsetY) / scaleFactor;
    }

    await loadAndDrawPOIs();
});
