# Shadow Path App Proposal

This app aims to create a "Shadowed" path for any user who wishes to visit The Huntington without being exposed to direct sunlight, eliminating the need for hats or umbrellas.

---

## Data Required

* **3D Map**: A detailed 3D model of The Huntington's buildings and landscape (from ArcGIS Pro or AutoCAD extrusions).
* **Sun Location Information**: Real-time sun position (azimuth and altitude), accessed through an API such as SunCalc or OpenWeather.
* **Walkable Paths**: Footpath network from GIS or manually defined over map tiles.
* **User Location**: Via browser geolocation or manual pinning.

---

## App Structure

### User Inputs

* **Time**: Automatically fetched from system clock.
* **Start**: User-selected or GPS auto-detected location.
* **Destination**: Chosen building/garden entrance.

### Core Classes

```javascript
class ShadowMap {
  WalkablePaths roads; // 2D walkable path network
  ShadowArea shade;    // 2D grid of shadow regions
  // Final shaded path is the intersection of the two
}

class Map3D {
  List<Building> buildings; // Contains footprint polygons and heights
}

class Location {
  double latitude;
  double longitude;
}

class Path {
  List<Location> nodes; // Waypoints in the walking path
}

class SunLocation {
  double azimuth;
  double altitude;
  DateTime timestamp;
}
```

### Algorithms

1. `shadowCalcMap(Map3D mapTheHuntington, SunLocation sunLocation) => ShadowMap`

   * Casts shadows based on building height, sun azimuth, and altitude.
   * Produces a rasterized shadow mask overlay.
2. `aStar(ShadowMap map, Location start, Location end) => Path`

   * Pathfinding algorithm with cost penalty for unshaded tiles.
   * Optionally, add user setting to allow short sun exposure if necessary.

---

## Languages and Frameworks

### Frontend (Web)

* **HTML / CSS**
* **React.js**
* **Leaflet.js** for map rendering
* **SunCalc.js** for local sun position

### Backend (Server)

* **Node.js**
* **Express.js** (API endpoints)
* **Optional Python microservice** for intensive shadow calculations using Shapely or PyVista

---

## Deployment Plan

* Final webpage will be hosted on `huntington.org`
* Use GitHub for version control
* CI/CD pipeline using GitHub Actions or Netlify
* Deployment target: subpage like `huntington.org/shadowpath`

---

## Future Enhancements

* Precomputed shadow maps for fixed time intervals to improve performance
* Real-time mode for mobile GPS-based pathfinding
* Accessibility options: allow wider paths, avoid stairs
* Multilingual support (e.g., English, Spanish, Chinese)
* Integration with Huntington's official map layer or tour app

---
