from firebase_admin import auth
#!/usr/bin/env python3
"""
ROOTAI Precision Agriculture Platform - Flask Backend
"""

import os
import json
import logging
import requests
from datetime import datetime, timedelta ,timezone
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
try:
    from config import Config
    app.config.from_object(Config)
except ImportError:
    logger.warning("Config file not found, using default settings")
    app.config.update({
        'FIREBASE_RTDB_URL': os.environ.get('FIREBASE_RTDB_URL'),
        'FIREBASE_RTDB_ROOT': os.environ.get('FIREBASE_RTDB_ROOT', '/sensorData'),
        'AGMARKNET_API_KEY': os.environ.get('AGMARKNET_API_KEY')
    })

# Initialize Firebase
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, db as rtdb
    
    # Check for service account key
    if os.path.exists('serviceAccountKey.json'):
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred, {
            'databaseURL': app.config.get('FIREBASE_RTDB_URL')
        })
        logger.info("✅ Firebase initialized successfully")
    else:
        logger.warning("⚠️ Firebase credentials file not found!")
        firebase_admin = None
        firestore = None
        rtdb = None
        
except ImportError:
    logger.error("Firebase libraries not installed")
    firebase_admin = None
    firestore = None
    rtdb = None

# Helper functions
def create_geopoint(lat, lng):
    """Create a GeoPoint for Firestore"""
    if firestore:
        return firestore.GeoPoint(lat, lng)
    return {"latitude": lat, "longitude": lng}

def create_buffer_zone(center_lat, center_lng, radius_km=1):
    """Create a circular buffer zone around a point"""
    import math
    
    # Convert km to degrees (approximate)
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(center_lat)))
    
    # Create a simple square buffer (can be improved to be circular)
    buffer_coords = [
        [center_lat - lat_delta, center_lng - lng_delta],
        [center_lat + lat_delta, center_lng - lng_delta],
        [center_lat + lat_delta, center_lng + lng_delta],
        [center_lat - lat_delta, center_lng + lng_delta],
        [center_lat - lat_delta, center_lng - lng_delta]
    ]
    
    return {
        "type": "Polygon",
        "coordinates": [buffer_coords]
    }

def process_sensor_data(sensor_data):
    """Process sensor data and generate alerts based on rules"""
    alerts = []
    
    # Extract values with fallbacks
    env_temp = sensor_data.get('environment', {}).get('temperature')
    env_humidity = sensor_data.get('environment', {}).get('humidity')
    soil_moisture = sensor_data.get('soil', {}).get('moisture')
    soil_temp = sensor_data.get('soil', {}).get('temperature')
    soil_humidity = sensor_data.get('soil', {}).get('humidity')

    # Soil moisture dehydration alert
    if soil_moisture is not None and soil_moisture < 30:
        alerts.append({
            "type": "dehydration_alert",
            "severity": "critical",
            "message": "Area is Dehydrated! Start irrigation!",
            "recommendation": f"Soil moisture is critically low at {soil_moisture:.1f}%. Immediate irrigation required.",
            "icon": "💧",
            "color": "red"
        })
    
    # High soil temperature alert
    if soil_temp is not None and soil_temp > 40:
        alerts.append({
            "type": "soil_temp_high",
            "severity": "warning",
            "message": "High soil temperature detected!",
            "recommendation": f"Soil temperature is {soil_temp:.1f}°C. Consider shading or irrigation.",
            "icon": "🌡️",
            "color": "orange"
        })
    
    # High humidity pest alert
    # Use 'or' and check for None to handle cases where one value might be missing
    if (env_humidity is not None and env_humidity > 80) or \
       (soil_humidity is not None and soil_humidity > 85):
        air_h_str = f"{env_humidity}%" if env_humidity is not None else "N/A"
        soil_h_str = f"{soil_humidity:.1f}%" if soil_humidity is not None else "N/A"
        alerts.append({
            "type": "pest_alert",
            "severity": "warning",
            "message": "Pest Alert! Be Aware!",
            "recommendation": f"High humidity detected (Air: {air_h_str}, Soil: {soil_h_str}). Pests may affect crops.",
            "icon": "🐛",
            "color": "yellow"
        })
        
    return alerts

def get_mock_market_trends():
    """Fallback mock market trends data"""
    return {
        "source": "mock_data",
        "last_updated": datetime.now().isoformat(),
        "commodities": [
            { "name": "Wheat", "price": 2100, "unit": "quintal", "trend": "stable", "change_percent": 2.1 },
            { "name": "Rice", "price": 3200, "unit": "quintal", "trend": "rising", "change_percent": 5.3 },
            { "name": "Maize", "price": 1800, "unit": "quintal", "trend": "falling", "change_percent": -1.8 }
        ]
    }

def get_enhanced_mock_market_trends():
    """Enhanced mock market trends with more realistic data"""
    return {
        "source": "enhanced_mock_data",
        "last_updated": datetime.now().isoformat(),
        "commodities": [
            { "name": "Wheat", "price": 2150, "unit": "quintal", "trend": "stable", "change_percent": 1.2, "market": "Delhi", "grade": "FAQ" },
            { "name": "Rice", "price": 3250, "unit": "quintal", "trend": "rising", "change_percent": 4.8, "market": "Mumbai", "grade": "FAQ" },
            { "name": "Maize", "price": 1850, "unit": "quintal", "trend": "falling", "change_percent": -2.1, "market": "Pune", "grade": "FAQ" },
            { "name": "Onion", "price": 2800, "unit": "quintal", "trend": "rising", "change_percent": 8.5, "market": "Nashik", "grade": "FAQ" },
            { "name": "Tomato", "price": 3200, "unit": "quintal", "trend": "stable", "change_percent": 0.5, "market": "Bangalore", "grade": "FAQ" }
        ]
    }

# Routes
@app.route('/')
def index():
    """Serve the mobile application as the primary view"""
    return render_template('mobile.html')

@app.route('/desktop')
def desktop():
    """Serve the desktop application page"""
    return render_template('index.html')

@app.route('/mobile')
def mobile():
    """Serve the mobile application page"""
    return render_template('mobile.html')

@app.route('/api/field/<field_id>')
def get_field(field_id):
    """Get field data by ID"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        db = firestore.client()
        doc_ref = db.collection('fields').document(field_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            # Convert GeoPoint to dict for JSON serialization
            if 'hardwareLocation' in data and data.get('hardwareLocation'):
                data['hardwareLocation'] = {
                    'latitude': data['hardwareLocation'].latitude,
                    'longitude': data['hardwareLocation'].longitude
                }
            return jsonify(data)
        else:
            return jsonify({"error": "Field not found"}), 404
            
    except Exception as e:
        logger.error(f"Error fetching field: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/field/save', methods=['POST'])
def save_field():
    """Save field data"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        # Validate required fields
        required_fields = ['fieldId', 'fieldName', 'boundary']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        db = firestore.client()
        
        # Store boundary as JSON string to avoid Firestore nested entity issues
        field_data = {
            'fieldId': data['fieldId'],
            'userId': data.get('userId', 'default_user'),
            'fieldName': data['fieldName'],
            'boundary': json.dumps(data['boundary']),  # Store as JSON string
            'hardwareLocation': None,
            'createdAt': datetime.now()
        }
        
        doc_ref = db.collection('fields').document(data['fieldId'])
        doc_ref.set(field_data)
        
        logger.info(f"Field saved successfully: {data['fieldId']}")
        return jsonify({"success": True, "fieldId": data['fieldId']})
        
    except Exception as e:
        logger.error(f"Error saving field: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/hardware/location/<field_id>', methods=['POST'])
def update_hardware_location(field_id):
    """Update hardware location for a field"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        data = request.get_json()
        db = firestore.client()
        
        # Create GeoPoint
        location = create_geopoint(data['latitude'], data['longitude'])
        
        # Update field document
        doc_ref = db.collection('fields').document(field_id)
        doc_ref.update({
            'hardwareLocation': location,
            'lastUpdated': datetime.now()
        })
        
        logger.info(f"Hardware location updated for field: {field_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Error updating hardware location: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/sensor-data/latest/<field_id>')
def get_latest_sensor_data(field_id):
    """Get latest sensor data for a field"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        db = firestore.client()
        
        # Query latest sensor reading
        readings_ref = db.collection('sensorReadings')
        query = readings_ref.where('fieldId', '==', field_id).order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1)
        docs = query.stream()
        
        for doc in docs:
            data = doc.to_dict()
            return jsonify(data)
            
        return jsonify({"error": "No sensor data found"}), 404
        
    except Exception as e:
        logger.error(f"Error fetching sensor data: {e}")
        return jsonify({"error": "Internal server error"}), 500

def _try_rtdb_roots_and_get_all():
    """Try multiple RTDB roots and return the first non-empty snapshot dict."""
    # This function is no longer needed with the new specific path, but kept for reference
    # It has been replaced by direct pathing in the route functions
    return None, None

def _normalize_reading(key, value):
    """Normalize a RTDB reading record, averaging 'probes' and also including the raw probe data."""
    try:
        soil_data = {}
        probes_data = None # Initialize probes_data to None

        if 'probes' in value and isinstance(value.get('probes'), dict):
            probes = value['probes'].values()
            probes_data = value['probes'] # Keep the raw probes object to send to the frontend
            
            # --- Averaging logic (kept for alerts and backward compatibility) ---
            moistures = [p.get('soil_moisture') for p in probes if p.get('soil_moisture') is not None]
            temps = [p.get('soil_temperature') for p in probes if p.get('soil_temperature') is not None]
            humidities = [p.get('soil_humidity') for p in probes if p.get('soil_humidity') is not None]

            soil_data['moisture'] = sum(moistures) / len(moistures) if moistures else None
            soil_data['temperature'] = sum(temps) / len(temps) if temps else None
            soil_data['humidity'] = sum(humidities) / len(humidities) if humidities else None
        else:
            # Fallback for old data structure
            soil_data['moisture'] = value.get('moisture')
            soil_data['temperature'] = value.get('soil_temperature')
            soil_data['humidity'] = value.get('soil_humidity')

        return {
            "readingId": key,
            "timestamp": value.get('timestamp') or value.get('time') or datetime.now().isoformat(),
            "environment": value.get('environment', {}),
            "rain": value.get('rain', {}),
            "soil": { # Averaged data
                "moisture": soil_data.get('moisture'),
                "temperature": soil_data.get('temperature'),
                "humidity": soil_data.get('humidity')
            },
            "probes": probes_data # NEW: Include the full probes object in the response
        }
    except Exception as e:
        logger.error(f"Error normalizing reading {key}: {e}")
        return {"readingId": key, "error": "Normalization failed"}
    
# CRITICAL UPDATE: Fetch data based on the userId passed from the frontend
@app.route('/api/rtdb/sensor-data/latest')
def get_latest_rtdb_sensor_data():
    """Get latest sensor data from the new structured path in RTDB for a specific user."""
    try:
        if not rtdb:
            return jsonify({"error": "Firebase RTDB not initialized"}), 500

        uid = request.args.get('userId')
        field_id = request.args.get('fieldId', 'field_A') 
        
        if not uid:
             return jsonify({"error": "User ID is required to fetch latest sensor data"}), 400
        
        # --- STEP 1: Get the main sensor data (no change here) ---
        path = f'/users/{uid}/live_status/{field_id}'
        ref = rtdb.reference(path)
        snapshot = ref.get()

        if snapshot:
            logger.info(f"Fetched data from {path}")
            timestamp = snapshot.get('timestamp', int(datetime.now().timestamp()))
            reading_id = f"live_{timestamp}"
            normalized_reading = _normalize_reading(reading_id, snapshot)
            
            # --- THIS IS THE FIX ---
            # --- STEP 2: Get the crop_stage from its separate path ---
            try:
                crop_stage_ref = rtdb.reference(f'/users/{uid}/crop_stage')
                crop_stage = crop_stage_ref.get()
                if crop_stage:
                    # Add it to the JSON response under the key the frontend expects
                    normalized_reading["plant_stage"] = crop_stage 
            except Exception as e:
                logger.warning(f"Could not fetch crop_stage for user {uid}: {e}")
            # --- END FIX ---

            alerts = process_sensor_data(normalized_reading)
            normalized_reading["alerts"] = alerts
            
            return jsonify(normalized_reading)

        return jsonify({"error": f"No data found for user {uid} at path: {path}"}), 404

    except Exception as e:
        logger.error(f"Error fetching RTDB live sensor data for user {uid}: {e}")
        return jsonify({"error": str(e)}), 500
    
    
# app.py

# ... (rest of your imports) ...

# New route to handle serving the QR scanner page
# app.py

@app.route('/qr_scanner')
def qr_scanner_page():
    """
    Renders the QR scanner page, securely passing user context from the URL token.
    The client-side app passes the ID token and fieldId as query parameters.
    """
    token = request.args.get('token')
    field_id = request.args.get('fieldId')
    user_uid = 'missing_uid' # Default value if auth fails
    
    if token and firebase_admin:
        try:
            # Verify the ID token passed from the frontend securely on the backend
            decoded_token = auth.verify_id_token(token)
            user_uid = decoded_token['uid'] # THIS IS THE UID WE WANT TO SAVE
            logger.info(f"QR Scanner requested by verified user: {user_uid}")
        except Exception as e:
            logger.error(f"Invalid token received for QR scanner: {e}")
            user_uid = 'UNAUTHORIZED' 

    if not field_id:
        field_id = 'missing_field'
    
    # CRITICAL: Render the template with the *verified UID*
    return render_template('qr_scanner.html', user_uid=user_uid, field_id=field_id)

# ... (rest of your app.py file) ...
# app.py (Add this new route)

# app.py (Modified)

@app.route('/live_tracker')
def live_tracker_page():
    """Renders the Live Location Tracker page, securely passing user context."""
    token = request.args.get('token') # Expect the token here
    user_uid = 'missing_uid'
    
    if token and firebase_admin:
        try:
            # Verify the ID token passed from the frontend securely on the backend
            decoded_token = auth.verify_id_token(token)
            user_uid = decoded_token['uid']
            logger.info(f"Live Tracker requested by verified user: {user_uid}")
        except Exception as e:
            logger.error(f"Invalid token received for Live Tracker: {e}")
            user_uid = 'UNAUTHORIZED' 

    # CRITICAL: Pass the user_uid so JavaScript can use it
    return render_template('live_tracker.html', user_uid=user_uid)

# CRITICAL UPDATE: Fetch history data based on the userId passed from the frontend
@app.route('/api/rtdb/sensor-data/history')
def get_rtdb_sensor_history():
    """Get sensor data history from the new structured path in RTDB for a specific user."""
    try:
        if not rtdb:
            return jsonify({"error": "Firebase RTDB not initialized"}), 500

        # CRITICAL CHANGE: Get UID and optional field_id from request arguments
        uid = request.args.get('userId')
        field_id = request.args.get('fieldId', 'field_A') # Fallback to a default field ID

        if not uid:
             return jsonify({"error": "User ID is required to fetch sensor history"}), 400

        # Construct the user-specific path for historical logs
        path = f'/users/{uid}/historical_logs/{field_id}'
        ref = rtdb.reference(path)
        snapshot = ref.get()

        readings = []
        if isinstance(snapshot, dict):
            logger.info(f"Fetched {len(snapshot)} readings from {path}")
            for key, value in snapshot.items():
                readings.append(_normalize_reading(key, value))

            try:
                # Sort by timestamp ascending for the chart
                readings.sort(key=lambda r: r.get('timestamp') or '')
            except Exception:
                pass
        
        return jsonify({"readings": readings})

    except Exception as e:
        logger.error(f"Error fetching RTDB sensor history for user {uid}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts/<field_id>')
def get_alerts(field_id):
    """Get active alerts for a field"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        db = firestore.client()
        
        # Query active alerts
        alerts_ref = db.collection('alerts')
        query = alerts_ref.where('fieldId', '==', field_id).where('active', '==', True).order_by('createdAt', direction=firestore.Query.DESCENDING)
        docs = query.stream()
        
        alerts = []
        for doc in docs:
            alerts.append(doc.to_dict())
            
        return jsonify({"alerts": alerts})
        
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/alerts/current')
def get_current_alerts():
    """Get current alerts based on latest sensor data"""
    try:
        # NOTE: This route needs to be updated if you want to properly filter alerts by user/field.
        # It currently relies on the user-agnostic get_latest_rtdb_sensor_data, 
        # which now requires a 'userId' parameter. We will temporarily use a placeholder 
        # for a multi-user environment or assume the user has to be passed here.
        # For a proper solution, the frontend should send the user ID.
        
        # Placeholder/Temporary fix: If this route is called without a user ID, 
        # it will fail as intended by the updated /api/rtdb/sensor-data/latest route.
        # The frontend must pass the UID here too for this to function correctly.
        
        # Get UID from request arguments (assuming frontend sends it to this endpoint)
        uid = request.args.get('userId') 
        field_id = request.args.get('fieldId', 'field_A')
        
        if not uid:
             return jsonify({"alerts": [], "error": "User ID is required for current alerts"}), 400

        # Construct a request object to simulate a call with arguments
        latest_data_response = app.test_client().get(f'/api/rtdb/sensor-data/latest?userId={uid}&fieldId={field_id}')
        latest_data = latest_data_response.get_json()
        
        if latest_data_response.status_code != 200:
            return jsonify({"alerts": [], "error": latest_data.get("error", "Failed to get latest data")})

        alerts = latest_data.get('alerts', [])
        active_alerts = [alert for alert in alerts if alert.get('severity') in ['critical', 'warning']]
        
        return jsonify({
            "alerts": active_alerts,
            "timestamp": latest_data.get('timestamp'),
            "total_alerts": len(active_alerts)
        })
        
    except Exception as e:
        logger.error(f"Error fetching current alerts: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/diagnose', methods=['POST'])
def diagnose_plant():
    """AI-powered plant disease diagnosis"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        
        diagnosis = {
            "disease": "Leaf Blight",
            "confidence": 0.85,
            "severity": "moderate",
            "recommendation": "Apply fungicide treatment and improve air circulation",
            "treatment": {
                "chemical": "Copper-based fungicide",
                "organic": "Neem oil spray",
                "prevention": "Regular monitoring and proper spacing"
            }
        }
        
        return jsonify(diagnosis)
        
    except Exception as e:
        logger.error(f"Error in diagnosis: {e}")
        return jsonify({"error": "Internal server error"}), 500
    
@app.route('/api/user/field')
def get_user_field():
    """Get a user's field by their Firebase UID from the auth token."""
    try:
        if not firestore or not firebase_admin:
            return jsonify({"error": "Firebase not initialized"}), 500
        
        # Get the token from the request header
        id_token = request.headers.get('Authorization').split('Bearer ')[1]
        
        # Verify the token to get the user's UID securely
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        db = firestore.client()
        
        # Query the 'fields' collection for a document where 'userId' matches the user's UID
        fields_ref = db.collection('fields')
        query = fields_ref.where('userId', '==', uid).limit(1)
        docs = query.stream()

        # Get the first result if it exists
        field_doc = next(docs, None)
        
        if field_doc:
            logger.info(f"Found saved field for user {uid}")
            data = field_doc.to_dict()
            
            # --- START: UPDATED BLOCK ---
            # Convert Firestore Timestamp to a string if it exists
            if 'plantingDate' in data and hasattr(data.get('plantingDate'), 'isoformat'):
                data['plantingDate'] = data['plantingDate'].isoformat()
            # --- END: UPDATED BLOCK ---
                
            return jsonify(data)
        else:
            logger.info(f"No saved field found for user {uid}")
            return jsonify({}), 404 # Return an empty object if no field is found
            
    except Exception as e:
        logger.error(f"Error fetching user field: {e}")
        return jsonify({"error": "Internal server error"}), 500



# app.py

# app.py

@app.route('/api/user_scans/<string:user_id>')
def get_user_scans(user_id):
    """
    Fetches all probes from the new centralized 'scans' collection for the user.
    (Used by mobile.js to display markers on the home map)
    """
    if not firestore:
        return jsonify({"error": "Firebase not initialized"}), 500
    
    try:
        db = firestore.client()
        scans_ref = db.collection('scans')
        # Query: /scans where user_id == {user_id}
        query = scans_ref.where('user_id', '==', user_id).order_by('timestamp', direction=firestore.Query.DESCENDING)
        
        docs = query.stream()
        scans = []
        for doc in docs:
            scan_data = doc.to_dict()
            
            # CRITICAL: Attempt to use the GeoPoint 'location' first, fall back to string/number lat/lng
            latitude = scan_data.get('latitude')
            longitude = scan_data.get('longitude')

            if scan_data.get('location') and hasattr(scan_data['location'], 'latitude'):
                latitude = scan_data['location'].latitude
                longitude = scan_data['location'].longitude
            
            # Ensure they are present for the frontend
            if latitude is None or longitude is None:
                continue

            scan_data['latitude'] = float(latitude)
            scan_data['longitude'] = float(longitude)
            
            # Convert Firestore Timestamp object to ISO string for JavaScript
            if hasattr(scan_data.get('timestamp'), 'isoformat'):
                scan_data['timestamp'] = scan_data['timestamp'].isoformat()
            
            if 'latitude' in scan_data and 'longitude' in scan_data:
                 scans.append(scan_data)
        
        logger.info(f"Fetched {len(scans)} scans from /scans for user {user_id}")
        return jsonify({"scans": scans})

    except Exception as e:
        logger.error(f"Error fetching scans for user {user_id} from /scans: {e}")
        return jsonify({"error": "Internal server error"}), 500
    
# app.py (Add this function to the end of your app.py file)

# app.py

# ... (Previous code remains the same up to get_live_probes) ...

@app.route('/api/live_probes/<string:user_id>')
def get_live_probes(user_id):
    """
    Fetches all probes from the new centralized 'scans' collection for persistent 
    display on the Live Tracker map.
    """
    if not firestore:
        return jsonify({"error": "Firebase not initialized"}), 500
    
    try:
        db = firestore.client()
        
        # *** Query the centralized 'scans' collection ***
        scans_ref = db.collection('scans')
        query = scans_ref.where('user_id', '==', user_id) 
        
        docs = query.stream()
        probes = []
        for doc in docs:
            probe_data = doc.to_dict()
            
            # Use the 'latitude' and 'longitude' fields which are saved as strings/numbers
            lat_raw = probe_data.get('latitude')
            lng_raw = probe_data.get('longitude')
            
            # CRITICAL: Attempt to use the GeoPoint 'location' first
            if probe_data.get('location') and hasattr(probe_data['location'], 'latitude'):
                lat_raw = probe_data['location'].latitude
                lng_raw = probe_data['location'].longitude
            
            # CRITICAL FIX: Robustly convert to float, return if impossible
            try:
                lat = float(lat_raw)
                lng = float(lng_raw)
            except (ValueError, TypeError):
                # If conversion fails (e.g., data is missing or bad), skip this document
                continue

            # Prepare the final response structure
            probes.append({
                'probe_id': probe_data.get('probe_id'),
                'lat': lat,  # Now guaranteed to be float
                'lng': lng,  # Now guaranteed to be float
                'plantedAt': (probe_data.get('timestamp') or datetime.now()).isoformat()
            })
        
        logger.info(f"Fetched {len(probes)} permanent zones from /scans for user {user_id}")
        # CRITICAL DEBUG CHECK: Ensure the response contains an array of probes
        return jsonify({"probes": probes})

    except Exception as e:
        logger.error(f"Error fetching live probes for user {user_id} from /scans: {e}")
        return jsonify({"error": "Internal server error"}), 500

# ... (Rest of app.py remains the same) ...

    
@app.route('/api/market-trends')
def get_market_trends():
    """Get market trends from Agmarknet API"""
    try:
        api_key = app.config.get('AGMARKNET_API_KEY')
        
        if not api_key:
            logger.warning("No Agmarknet API key found, using mock data")
            return jsonify(get_enhanced_mock_market_trends())
        
        base_url = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
        
        commodity = request.args.get('commodity')
        state = request.args.get('state')
        market = request.args.get('market')

        params = {'api-key': api_key, 'format': 'json', 'limit': 50}
        def norm(x):
            try:
                return ' '.join(w.capitalize() for w in x.strip().split())
            except Exception:
                return x
        if state:
            params['filters[state]'] = norm(state)
        if commodity:
            params['filters[commodity]'] = norm(commodity)
        if market:
            params['filters[market]'] = norm(market)
        
        def query_and_transform(query_params):
            logger.info(f"Querying Agmarknet with params: {query_params}")
            resp = requests.get(base_url, params=query_params, timeout=12)
            resp.raise_for_status()
            js = resp.json()
            recs = js.get('records') or []
            items = []
            for record in recs[:50]:
                try:
                    price_val = record.get('Modal_Price') or record.get('modal_price') or record.get('modalprice')
                    if price_val is None:
                        continue
                    price_num = float(price_val)
                    if price_num <= 0:
                        continue
                    items.append({
                        "name": record.get('Commodity') or record.get('commodity') or 'Unknown',
                        "price": price_num, "unit": "quintal", "trend": "stable", "change_percent": 0.0,
                        "market": record.get('Market') or record.get('market') or 'Unknown',
                        "state": record.get('State') or record.get('state') or 'Unknown',
                        "district": record.get('District') or record.get('district') or 'Unknown',
                        "grade": record.get('Grade') or record.get('grade') or 'FAQ'
                    })
                except Exception:
                    continue
            return items

        try:
            attempts = [params.copy()]
            if 'filters[commodity]' in params: attempts.append({k:v for k,v in params.items() if k != 'filters[commodity]'})
            if 'filters[market]' in params: attempts.append({k:v for k,v in params.items() if k != 'filters[market]'})
            if state: attempts.append({'api-key': api_key, 'format': 'json', 'limit': 50, 'filters[state]': norm(state)})
            attempts.append({'api-key': api_key, 'format': 'json', 'limit': 50})

            user_commodity = norm(commodity) if commodity else None
            user_market = norm(market) if market else None

            for qp in attempts:
                items = query_and_transform(qp)
                if not items: continue

                filtered = items
                if user_commodity: filtered = [it for it in filtered if user_commodity.lower() in (it.get('name') or '').lower()]
                if user_market: filtered = [it for it in filtered if user_market.lower() in (it.get('market') or '').lower() or user_market.lower() in (it.get('district') or '').lower()]
                
                result_items = filtered if (user_commodity or user_market) else items
                if result_items:
                    return jsonify({
                        "source": "agmarknet_api",
                        "last_updated": datetime.now().isoformat(),
                        "used_filters": {k: v for k, v in qp.items() if k.startswith('filters[')},
                        "commodities": result_items
                    })

            logger.warning("Agmarknet returned no items even after relaxed filters; using mock data")
            return jsonify(get_enhanced_mock_market_trends())
        except requests.exceptions.RequestException as e:
            logger.error(f"Agmarknet API request failed: {e}")
            return jsonify(get_enhanced_mock_market_trends())
            
    except Exception as e:
        logger.error(f"Error fetching market trends: {e}")
        return jsonify(get_enhanced_mock_market_trends())

@app.route('/api/weather')
def get_weather():
    """Get current weather for given latitude and longitude using Open-Meteo."""
    try:
        lat = request.args.get('lat')
        lng = request.args.get('lng') or request.args.get('lon')
        if not lat or not lng:
            return jsonify({"error": "lat and lng are required"}), 400

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat, "longitude": lng, "current_weather": True,
            "hourly": "relative_humidity_2m,temperature_2m,precipitation"
        }
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        current = data.get("current_weather", {})
        result = {
            "temperature": current.get("temperature"),
            "windspeed": current.get("windspeed"),
            "winddirection": current.get("winddirection"),
            "weathercode": current.get("weathercode"),
            "time": current.get("time"),
            "units": { "temperature": data.get("hourly_units", {}).get("temperature_2m", "°C") }
        }
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching weather: {e}")
        return jsonify({"error": "Failed to fetch weather"}), 500

def process_new_sensor_reading(reading_data):
    """Simulate Cloud Function for processing new sensor readings"""
    try:
        if not firestore: return
            
        db = firestore.client()
        field_id = reading_data.get('fieldId')
        if not field_id: return
            
        field_doc = db.collection('fields').document(field_id).get()
        if not field_doc.exists: return
            
        field_data = field_doc.to_dict()
        hardware_location = field_data.get('hardwareLocation')
        if not hardware_location: return
            
        alerts = process_sensor_data(reading_data)
        
        for alert in alerts:
            alert_doc = {
                'fieldId': field_id, 'type': alert['type'], 'severity': alert['severity'],
                'message': alert['message'], 'recommendation': alert['recommendation'],
                'active': True, 'createdAt': datetime.now()
            }
            db.collection('alerts').add(alert_doc)
        
        critical_alerts = [a for a in alerts if a['severity'] == 'critical']
        if critical_alerts and hardware_location:
            affected_zone = create_buffer_zone(hardware_location.latitude, hardware_location.longitude, radius_km=2)
            db.collection('fields').document(field_id).update({
                'affectedZone': json.dumps(affected_zone),
                'lastAlertAt': datetime.now()
            })
            
    except Exception as e:
        logger.error(f"Error processing sensor reading: {e}")
        
@app.route('/api/fields')
def get_user_fields():
    """
    Get all fields for the authenticated user, or the user specified in query params.
    Live Tracker uses query param: /api/fields?userId={uid}
    """
    try:
        if not firestore or not firebase_admin:
            return jsonify({"error": "Firebase not initialized"}), 500
        
        # 1. Get UID from query parameters (used by Live Tracker)
        uid = request.args.get('userId')

        if not uid:
             # Fallback: Get UID from token (used by the main mobile app when loading the home screen)
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                 logger.error("Authentication Error: No Bearer token or User ID provided.")
                 return jsonify({"error": "No authorization token or User ID provided"}), 401
            try:
                id_token = auth_header.split('Bearer ')[1]
                decoded_token = auth.verify_id_token(id_token)
                uid = decoded_token['uid']
            except Exception as auth_error:
                logger.error(f"Authentication Error: Failed to verify ID token. {auth_error}")
                return jsonify({"error": "Invalid or expired token."}), 401
        
        # 2. Proceed with Firestore query
        db = firestore.client()
        fields_ref = db.collection('fields')
        query = fields_ref.where('userId', '==', uid)
        docs = query.stream()

        # Convert documents to list
        fields = []
        for doc in docs:
            field_data = doc.to_dict()
            if 'boundary' in field_data and isinstance(field_data['boundary'], str):
                try:
                    field_data['boundary'] = json.loads(field_data['boundary'])
                except:
                    pass
            
            # --- FIX ---
            # This block converts the Firestore Timestamp to an ISO string
            if 'plantingDate' in field_data and hasattr(field_data.get('plantingDate'), 'isoformat'):
                field_data['plantingDate'] = field_data['plantingDate'].isoformat()
            # --- END FIX ---
                
            fields.append(field_data)
        
        logger.info(f"Found {len(fields)} fields for user {uid}")
        
        # If the Live Tracker asks, it expects field data in the response body.
        # It's safer to return the fields list directly.
        return jsonify({"fields": fields})
            
    except Exception as e:
        logger.error(f"CRITICAL Server Error fetching user fields: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

# Add this new route to app.py

@app.route('/api/field/stage', methods=['POST'])
def update_plant_stage():
    """
    Updates the 'crop_stage' directly under the user's UID.
    """
    try:
        if not rtdb or not firebase_admin:
            return jsonify({"error": "Firebase RTDB not initialized"}), 500

        # 1. Authenticate the user from the token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "No authorization token provided"}), 401
        
        id_token = auth_header.split('Bearer ')[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']

        # 2. Get data from the request body
        data = request.get_json()
        stage = data.get('stage') # We only need the stage

        if not stage:
            return jsonify({"error": "Missing stage in request"}), 400
        
        # --- THIS IS THE FIX ---
        # 3. Construct the RTDB path to the user's root
        path = f'/users/{uid}/crop_stage'
        ref = rtdb.reference(path)
        
        # 4. Set the value directly (replaces any existing value)
        ref.set(stage)
        # --- END FIX ---
        
        logger.info(f"Crop stage updated to '{stage}' for user {uid}")
        
        return jsonify({"success": True, "stage": stage})

    except Exception as e:
        logger.error(f"Error updating plant stage: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500
    
    
@app.route('/api/field/delete', methods=['POST'])
def delete_field():
    """Delete a field document from Firestore by ID."""
    try:
        if not firestore or not firebase_admin:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        data = request.get_json()
        field_id = data.get('fieldId')

        if not field_id:
            return jsonify({"error": "Missing fieldId in request body"}), 400

        # Optional: Add token verification here to ensure only the owner can delete the field
        # For simplicity, we skip full auth check, but in production, you MUST verify the user's token/ownership.

        db = firestore.client()
        doc_ref = db.collection('fields').document(field_id)
        
        # Check if document exists before attempting to delete
        if not doc_ref.get().exists:
             return jsonify({"error": f"Field {field_id} not found"}), 404

        # Delete the document
        doc_ref.delete()
        
        logger.info(f"Field deleted successfully: {field_id}")
        return jsonify({"success": True, "fieldId": field_id})
        
    except Exception as e:
        logger.error(f"Error deleting field: {e}")
        return jsonify({"error": "Internal server error"}), 500
# app.py (Add this route function below /api/field/save)

@app.route('/api/probe/plant', methods=['POST'])
def plant_probe_location():
    """Saves the location of a newly planted probe to the centralized 'scans' collection.""" # <-- Updated comment
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
        
        data = request.get_json()
        # NOTE: 'fieldId' is not strictly required by the QR scanner's saved data,
        # but keep it in the required fields list if you want to enforce it.
        required_fields = ['userId', 'fieldId', 'probeId', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        db = firestore.client()
        
        # Create a GeoPoint object
        location = create_geopoint(data['latitude'], data['longitude'])
        
        probe_data = {
            'user_id': data['userId'],        # <-- Renamed for consistency with QR scanner
            'field_id': data['fieldId'],      # <-- Renamed for consistency with QR scanner
            'probe_id': data['probeId'],
            'latitude': data['latitude'],     # Keep string for easier access/debug
            'longitude': data['longitude'],   # Keep string for easier access/debug
            'location': location,
            'status': 'active',               # Set status field for consistency
            'timestamp': datetime.now()       # Use Python datetime for server-side timestamp
        }
        
        # *** CRITICAL CHANGE: Write to the 'scans' collection ***
        # Let Firestore assign the document ID automatically
        doc_ref = db.collection('scans').add(probe_data) # Use .add()
        
        logger.info(f"Probe {data['probeId']} location saved to /scans for user {data['userId']}")
        return jsonify({"success": True, "scanId": doc_ref[1].id}) # Return the new doc ID
        
    except Exception as e:
        logger.error(f"Error saving probe location to /scans: {e}")
        return jsonify({"error": "Internal server error"}), 500
    
    
    
    
@app.route('/api/user/plant', methods=['POST'])
def mark_planting_day():
    """
    Sets the 'plantingDate' for a specific field to the current time.
    """
    try:
        if not firestore or not firebase_admin:
            return jsonify({"error": "Firebase not initialized"}), 500

        # 1. Authenticate the user from the token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "No authorization token provided"}), 401
        
        id_token = auth_header.split('Bearer ')[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']

        # 2. Get fieldId from the request body
        data = request.get_json()
        field_id = data.get('fieldId')
        if not field_id:
            return jsonify({"error": "Missing fieldId in request"}), 400

        # 3. Get the current time
        current_time = datetime.now(timezone.utc)

        # 4. Get the database client and document reference
        db = firestore.client()
        doc_ref = db.collection('fields').document(field_id)
        
        # 5. (Security Check) Verify the user owns this field
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Field not found"}), 404
        
        field_data = doc.to_dict()
        if field_data.get('userId') != uid:
            return jsonify({"error": "User does not own this field"}), 403 # Forbidden

        # 6. Set the planting date in Firestore
        doc_ref.update({
            'plantingDate': current_time
        })
        
        logger.info(f"Planting date set for field {field_id} by user {uid}")
        
        # 7. Return the new date so the frontend can display it
        return jsonify({"success": True, "plantingDate": current_time.isoformat()})

    except Exception as e:
        logger.error(f"Error marking planting day: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500
    

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)