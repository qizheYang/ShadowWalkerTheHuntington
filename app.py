from flask import Flask, render_template, request, jsonify, send_from_directory
import numpy as np
import heapq
import requests
import datetime
import shade_utils
import json
import os

app = Flask(__name__)

OPENWEATHER_API_KEY = "*****" # hidden. github complains on privacy

walkability_map = np.loadtxt("walkability_map.txt", dtype=int)
height, width = walkability_map.shape

def astar(start, goal, grid):
    def heuristic(a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    # === Use 8 neighbors ===
    neighbors = [(-1,0), (1,0), (0,-1), (0,1), (-1,-1), (-1,1), (1,-1), (1,1)]

    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {start: 0}
    f_score = {start: heuristic(start, goal)}

    while open_set:
        current = heapq.heappop(open_set)[1]

        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            path.reverse()
            return path

        for dx, dy in neighbors:
            neighbor = (current[0] + dx, current[1] + dy)
            if 0 <= neighbor[0] < height and 0 <= neighbor[1] < width:
                cell_value = grid[neighbor]

                if cell_value == 1:
                    step_cost = 3
                else:
                    step_cost = 10000

                if step_cost >= 10000:
                    continue

                tentative_g = g_score[current] + step_cost

                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score[neighbor] = tentative_g + heuristic(neighbor, goal)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))

    return []

def find_nearest_white(point, grid):
    from collections import deque
    queue = deque()
    visited = set()
    queue.append((point[0], point[1], 0))

    while queue:
        x, y, dist = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))

        if 0 <= x < height and 0 <= y < width:
            if grid[x, y] == 1:
                return (x, y)
            for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                queue.append((x + dx, y + dy, dist + 1))
    return point

@app.route("/")
def index():
    return render_template("index.html", width=width, height=height)

@app.route("/path", methods=["POST"])
def path():
    data = request.json
    start = (data["start"]["y"], data["start"]["x"])
    end = (data["end"]["y"], data["end"]["x"])

    use_shade = data.get("use_shade", False)
    print(f"[INFO] Path request: use_shade={use_shade}")

    start = find_nearest_white(start, walkability_map)
    end = find_nearest_white(end, walkability_map)

    if use_shade:
        grid = shade_utils.get_combined_map(walkability_map)
        path_result = shade_utils.astar_with_shade(start, end, grid)
    else:
        grid = walkability_map
        path_result = astar(start, end, grid)

    path_xy = [{"x": p[1], "y": p[0]} for p in path_result]

    return jsonify({"path": path_xy})

@app.route("/weather")
def weather():
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat=34.128&lon=-118.114&units=metric&appid={OPENWEATHER_API_KEY}"

    response = requests.get(url)

    if "application/json" in response.headers.get("Content-Type", ""):
        data = response.json()
        now = datetime.datetime.now()
        today_date = now.date()

        today_forecast = []
        for item in data["list"]:
            dt = datetime.datetime.fromtimestamp(item["dt"])
            if dt.date() == today_date and dt.hour >= now.hour:
                entry = {
                    "dt": item["dt"],
                    "temp": item["main"]["temp"],
                    "humidity": item["main"]["humidity"],
                    "wind_speed": item["wind"]["speed"],
                    "wind_deg": item["wind"]["deg"],
                    "weather": item["weather"][0]["description"]
                }
                today_forecast.append(entry)

        return jsonify({"hourly": today_forecast})
    else:
        return jsonify({"error": "Failed to fetch weather data"}), 500

@app.route('/pois.json')
def serve_pois():
    return jsonify(adjusted_pois)

@app.route('/shade_png/<path:filename>')
def serve_shade_png(filename):
    return send_from_directory('shade_png', filename)

@app.route('/shade_txt/<path:filename>')
def serve_shade_txt(filename):
    return send_from_directory('shade_txt', filename)

@app.route('/walkability')
def serve_walkability():
    return jsonify(walkability_map.tolist())

@app.route("/mobile.html")
def mobile():
    return render_template("mobile.html", width=width, height=height)

# === Preprocess POIs ===
POIS_PATH = os.path.join('static', 'pois.json')
adjusted_pois = []

if os.path.exists(POIS_PATH):
    with open(POIS_PATH, 'r', encoding='utf-8') as f:
        original_pois = json.load(f)

    for poi in original_pois:
        name = poi.get('name', 'Unknown')
        coord = poi.get('coord', [0, 0])
        y, x = coord[1], coord[0]

        if 0 <= y < height and 0 <= x < width:
            if walkability_map[y, x] != 1:
                new_y, new_x = find_nearest_white((y, x), walkability_map)
                print(f"[INFO] Adjusting POI '{name}': ({x},{y}) → ({new_x},{new_y})")
                adjusted_coord = [new_x, new_y]
            else:
                adjusted_coord = [x, y]
        else:
            print(f"[WARNING] POI '{name}' out of bounds: ({x},{y}) — skipped")
            continue

        adjusted_pois.append({
            'name': name,
            'coord': adjusted_coord
        })

    print(f"[INFO] Loaded and adjusted {len(adjusted_pois)} POIs.")
else:
    print(f"[ERROR] POI file not found: {POIS_PATH}")

if __name__ == "__main__":
    # app.run(debug=True)
    app.run(host='0.0.0.0', port=5000)
