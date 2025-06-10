# Shadow Walker - The Huntington

## Overview

**Shadow Walker** is an interactive web app that helps visitors navigate The Huntington Library, Art Museum, and Botanical Gardens while minimizing sun exposure.

The app calculates **shade-optimized walking routes** in real time based on:

- **Walkable areas** (roads, paths, lawns)
- **Time-specific shade maps** generated from sun angles and terrain/building/tree data
- **Current weather** (to detect cloud cover)
- **User preferences** (shade vs. shortest route)

---

## Features

✅ Dynamic A* pathfinding with shade-aware cost function  
✅ Hourly-updated shade maps using [ShadeMap.app](https://www.shademap.app)  
✅ Interactive UI with zoomable map and compass  
✅ Points of Interest (POIs) search and display  
✅ Weather integration (OpenWeather API) to auto-detect "full shade" conditions  
✅ Mobile and desktop versions  
✅ "Cheat code" Easter egg to force-enable shade routing  

---

## Architecture

### Backend

- **Language:** Python 3
- **Framework:** Flask
- **Main logic:**
    - `app.py`  
      Handles web routes, REST API for pathfinding, POI serving, weather API integration
    - `shade_utils.py`  
      Provides shade-aware pathfinding (`astar_with_shade`), combined shade+walkability maps
    - **Data:**
      - `walkability_map_forbidden_city.txt` — walkable areas (1 = walkable, 0 = blocked)
      - `upscaled/MMHH.txt` — shade maps per month & hour (1 = shaded, 0 = sun)

### Frontend

- **Languages:** HTML5, CSS3, JavaScript
- **Core files:**
    - `index.html` — Main UI
    - `style.css` — Styles
    - `shade.js` — Shade map logic and display
    - `search.js` — POI search and dynamic UI behavior
    - `shade_png/MMHH.png` — Visual shade overlay images (optional display)
    - `pois.json` — List of Points of Interest with coordinates  

### Routing

| Route                      | Purpose                          |
|----------------------------|----------------------------------|
| `/`                        | Main UI                          |
| `/path` (POST)             | Calculate path (with or w/o shade)|
| `/walkability`             | Serve walkability map (JSON)     |
| `/shade_png/<filename>`    | Serve shade map image            |
| `/shade_txt/<filename>`    | Serve shade map raw text         |
| `/pois.json`               | Serve POI data                   |
| `/weather`                 | Serve current weather forecast   |

---

## How it works

1. **Walkability Map**  
   Pre-extracted via computer vision from high-res map `huntington_map_highres_cropped_enhanced.jpg` → `walkability_map_forbidden_city.txt`.

2. **Shade Maps**  
   Downloaded from [ShadeMap.app](https://www.shademap.app), processed into 72 time slots (per 2-hour band), upscaled to 8000×7800 resolution to match the walkability map.

3. **Real-Time Combination**  
   At runtime, the backend combines the walkability map + the current shade map into a **combined cost grid**:
   - 2 = walkable and shaded (lowest cost)
   - 1 = walkable but sunny (higher cost)
   - 0 = not walkable (blocked)

4. **Pathfinding**  
   - If "Enable Shade Route" is checked, uses `shade_utils.astar_with_shade()`  
   - Otherwise uses simple A* on walkability map.

5. **POIs**  
   POIs from `pois.json` are loaded, adjusted to nearest walkable pixel if needed, and searchable from the UI. Toilets are specially handled to always suggest the closest one.

6. **Weather Integration**  
   If cloud cover implies "complete shadow", the app disables shade route & shade map overlays.

---

## Usage

### Running Locally

```bash
# Install dependencies (Python 3.x, Flask, numpy, requests)
pip install flask numpy requests

# Run server
python app.py

# Visit http://127.0.0.1:5000
```

---

## Limitations & Future Work

- Shade maps are based on predicted sun angle, not real-time obstructions (cars, temporary tents, etc.)

- Cloud cover effect is a simple threshold — future versions may better model diffused light.

- Current A* heuristic is basic Manhattan distance — could be improved with more accurate geospatial scaling.

---

## Credits

- Shade data from [ShadeMap.app](https://www.shademap.app)

- Map visual base from The Huntington

- Weather data from [OpenWeatherMap](https://openweathermap.org/)

- App development: Custom by Qizhe (Charles) Yang

---

## License

This project is licensed under the [MIT License](LICENSE).

You are free to use, modify, and distribute this software under the terms of the MIT license.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)