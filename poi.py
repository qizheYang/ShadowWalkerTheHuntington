import os
import json
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Path to pois.json relative to this project folder
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
POI_FILE = os.path.join(PROJECT_ROOT, 'static', 'pois.json')

@app.route('/')
def index():
    return render_template('poiHelper.html')

# Get POIs
@app.route('/get_pois', methods=['GET'])
def get_pois():
    if not os.path.exists(POI_FILE):
        pois = []
    else:
        with open(POI_FILE, "r") as f:
            try:
                pois = json.load(f)
            except json.JSONDecodeError:
                pois = []
    return jsonify(pois)

# Save POI
@app.route('/save_poi', methods=['POST'])
def save_poi():
    data = request.json
    print(f"Saving POI: {data}")

    if not os.path.exists(POI_FILE):
        pois = []
    else:
        with open(POI_FILE, "r") as f:
            try:
                pois = json.load(f)
            except json.JSONDecodeError:
                pois = []

    # Always append new POI
    pois.append(data)

    with open(POI_FILE, "w") as f:
        json.dump(pois, f, indent=2)
        print("pois.json updated!")

    return jsonify({
        "status": "success",
        "message": "POI added!"
    })

if __name__ == '__main__':
    app.run(debug=True)
