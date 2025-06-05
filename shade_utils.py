import numpy as np
import datetime
import heapq
from datetime import datetime

def get_shade_hour_for_now():
    now = datetime.now()
    hour = now.hour

    if hour >= 17:
        shade_hour = 18
    elif hour >= 15:
        shade_hour = 16
    elif hour >= 13:
        shade_hour = 14
    elif hour >= 11:
        shade_hour = 12
    elif hour >= 9:
        shade_hour = 10
    else:
        shade_hour = 8

    return shade_hour

def get_combined_map(walkability_map):
    height, width = walkability_map.shape

    now = datetime.now()

    shade_hour = get_shade_hour_for_now()

    month_str = f"{now.month:02d}"
    hour_str = f"{shade_hour:02d}"

    shade_filename = f"upscaled/{month_str}{hour_str}.txt"

    try:
        shade_map = np.loadtxt(shade_filename, dtype=int)
    except Exception as e:
        print(f"[ERROR] Failed to load shade map {shade_filename}: {e}")
        shade_map = np.zeros_like(walkability_map, dtype=int)

    print(f"[INFO] walkability_map shape: {walkability_map.shape}")
    print(f"[INFO] shade_map shape: {shade_map.shape}")

    if walkability_map.shape != shade_map.shape:
        print(f"[WARNING] ⚠️ Resolution mismatch between walkability_map and shade_map!")
    else:
        print(f"[OK] ✅ Resolutions match!")

    combined_map = np.zeros_like(walkability_map, dtype=int)

    combined_map[(walkability_map == 1) & (shade_map == 1)] = 2
    combined_map[(walkability_map == 1) & (shade_map == 0)] = 1

    print(f"[INFO] Using shade map: {shade_filename}")

    return combined_map

def astar_with_shade(start, goal, grid):
    def heuristic(a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    neighbors = [(-1,0), (1,0), (0,-1), (0,1)]

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
            if 0 <= neighbor[0] < grid.shape[0] and 0 <= neighbor[1] < grid.shape[1]:
                cell_value = grid[neighbor]

                if cell_value == 2:
                    step_cost = 10
                elif cell_value == 1:
                    step_cost = 15
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
