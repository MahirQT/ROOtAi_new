/**
 * Formats a single sensor reading into an HTML card for display.
 * @param {object} data - A single sensor reading object.
 * @param {string} title - The title for the card (e.g., "Live Status" or a timestamp).
 * @returns {string} - An HTML string representing the card.
 * @param {string} probeId -The ID read from the QR code (e.g., "P-42-W").
 * @param {number} lat - Center latitude.
 * @param {number} lng - Center longitude.
 * @param {number} sizeMeters - Side length of the square (e.g., 5 meters).
 * @returns {Array<Array<number>>} Leaflet coordinates (array of [lat, lng]).
 * @param {string} plantingDateISO - The ISO string of the planting date from Firestore.
 * @param {string} stage  stage as the golbal variable
 * @param {string} metricPath - The metric name (e.g., "environment.temperature")
 * @returns {object} - An object with { border, background } colors.
 *
 * 
 * 
 */
// mobile.js (Near the top or global helper functions)
if (!Math.radians) {
    Math.radians = function(degrees) { return degrees * Math.PI / 180; };
}

function launchQRScanner() {
    // currentFieldId is set when the user saves a field (or loads one)
    if (!currentUser || !authToken || !currentFieldId) {
        alert("Please log in and save a field boundary (Home screen map) before planting probes.");
        return;
    }
    
    // We pass the token for backend verification and the fieldId for context.
    window.location.href = `/qr_scanner?token=${authToken}&fieldId=${currentFieldId}`;
}

function formatSensorDataForDisplay(data, title) {
    const env = data.environment || {};
    const rain = data.rain || {};
    
    // --- Add this line ---
    const plantStage = data.plant_stage || 'N/A';

    const temp = env.temperature !== undefined ? `${env.temperature}°C` : 'N/A';
    const humidity = env.humidity !== undefined ? `${env.humidity}%` : 'N/A';
    const rainCount = (rain.precipitation !== undefined ? rain.precipitation : (rain.count !== undefined ? rain.count : 'N/A'));

    let probesHtml = '';
    // Check if the probes object exists and is not empty
    if (data.probes && Object.keys(data.probes).length > 0) {
        probesHtml += '<h4 class="font-semibold text-gray-700 mt-3 mb-1 col-span-2">Soil Probes:</h4>';
        
        Object.entries(data.probes).forEach(([probeName, probeData]) => {
            const displayName = probeName.charAt(0).toUpperCase() + probeName.slice(1).replace(/(\d+)/, ' $1');
            
            const pMoisture = probeData.soil_moisture !== undefined ? `${probeData.soil_moisture.toFixed(1)}%` : 'N/A';
            const pTemp = probeData.soil_temperature !== undefined ? `${probeData.soil_temperature.toFixed(1)}°C` : 'N/A';
            const pHumidity = probeData.soil_humidity !== undefined ? `${probeData.soil_humidity.toFixed(1)}%` : 'N/A';

            probesHtml += `
                <div class="col-span-2 pl-2 border-l-2 border-gray-200 mt-2">
                    <strong class="text-gray-600">${displayName}</strong>
                    <div class="flex justify-between text-xs text-gray-500"><span>Moisture:</span><span class="font-semibold text-black">${pMoisture}</span></div>
                    <div class="flex justify-between text-xs text-gray-500"><span>Temperature:</span><span class="font-semibold text-black">${pTemp}</span></div>
                    <div class="flex justify-between text-xs text-gray-500"><span>Humidity:</span><span class="font-semibold text-black">${pHumidity}</span></div>
                </div>
            `;
        });
    } else {
         probesHtml = '<p class="col-span-2 text-sm text-gray-400 mt-2">No probe data available.</p>';
    }

    return `
        <div class="sensor-card">
            <h3 class="font-bold text-md text-gray-800 border-b pb-2 mb-2">${title}</h3>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                
                <span class="text-gray-600">Plant Stage:</span><span class="font-medium text-right">${plantStage}</span>

                <span class="text-gray-600">Air Temp:</span><span class="font-medium text-right">${temp}</span>
                <span class="text-gray-600">Air Humidity:</span><span class="font-medium text-right">${humidity}</span>
                <span class="text-gray-600">Rain Count:</span><span class="font-medium text-right">${rainCount}</span>
                ${probesHtml}
            </div>
        </div>
    `;
}

/**
 * Fetches the live_status from the backend and displays it.
 */
/**
 * Fetches the live_status from the backend and displays it.
 */
async function fetchCurrentStatus() {
    const displayContainer = document.getElementById('data-display-container');
    displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Loading Current Status...</p>`;

    if (!currentUser) {
        displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Please log in to view sensor data.</p>`;
        return;
    }

    try {
        // CRITICAL CHANGE: Pass userId and fieldId as query parameters
        const uid = currentUser.uid;
        // Assuming 'field_A' is the default field ID for RTDB demo based on app.py
        const fieldId = 'field_A'; 
        
        const url = `/api/rtdb/sensor-data/latest?userId=${uid}&fieldId=${fieldId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            // Check for 404/No data found error specifically
            if (response.status === 404) {
                 displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">No sensor data found for your account.</p>`;
                 return;
            }
            throw new Error('Failed to fetch live data.');
        }
        const data = await response.json();
        
        // Use the helper function to format the data and display it
        displayContainer.innerHTML = formatSensorDataForDisplay(data, 'Live Status');

        // --- This block makes the dropdown persistent on page load ---
        const stageSelectorContainer = document.getElementById('plant-stage-selector');
        const stageSelect = document.getElementById('plant-stage-select');
        
        if (stageSelect && stageSelectorContainer) {
            // If a plant stage is saved, show the dropdown and set its value
            if (data.plant_stage) {
                stageSelect.value = data.plant_stage;
            }
            // Show the dropdown selector
            stageSelectorContainer.classList.remove('hidden'); 
        }
        // --- End of block ---

    } catch (error) {
        console.error('Error fetching current status:', error);
        displayContainer.innerHTML = `<p class="text-center text-red-500 py-4">Error loading data. Check console for details.</p>`;
    }
}
/**
 * Fetches the historical_logs from the backend and displays them.
 */
async function fetchHistoricalLogs() {
    const displayContainer = document.getElementById('data-display-container');
    displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Loading History...</p>`;

    if (!currentUser) {
        displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Please log in to see your history.</p>`;
        return;
    }

    try {
        // CRITICAL CHANGE: Pass userId and fieldId as query parameters
        const uid = currentUser.uid;
        // Assuming 'field_A' is the default field ID for RTDB demo based on app.py
        const fieldId = 'field_A'; 

        // Add the current user's ID to the API request
        const url = `/api/rtdb/sensor-data/history?userId=${uid}&fieldId=${fieldId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            // Check for 404/No data found error specifically
            if (response.status === 404) {
                 displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">No historical logs found.</p>`;
                 return;
            }
            throw new Error('Failed to fetch history data.');
        }
        const data = await response.json();
        const readings = data.readings || [];

        if (readings.length === 0) {
            displayContainer.innerHTML = `<p class="text-center text-gray-500 py-4">No historical logs found.</p>`;
            return;
        }

        // Create an HTML card for each historical log and join them together
        const historyHtml = readings
            .map(log => {
                const date = new Date(log.timestamp);
                const formattedDate = isNaN(date) ? 'Invalid Date' : date.toLocaleString();
                return formatSensorDataForDisplay(log, formattedDate);
            })
            .join('');
        
        displayContainer.innerHTML = historyHtml;

    } catch (error) {
        console.error('Error fetching history:', error);
        displayContainer.innerHTML = `<p class="text-center text-red-500 py-4">Error loading history. Check console for details.</p>`;
    }
}
/**
 * ROOTAI Mobile Interface - JavaScript
 */
// Global variables
let currentScreen = 'splash';
let sensorData = null; // This will be updated in real-time
let map = null;
let griddedMap = null; // For the twin gridded map view
let drawControl = null;
let drawnLayer = null;
let currentFieldId = null;
let marketTrends = null;
let analyticsChart = null;
let metricDetailChart = null;
let growthChart = null;
let isAuthenticated = false;
let currentUser = null;
let authToken = null;
let gridLayer = null;
let gridVisible = false;
let baseLayers = {};
let activeBaseLayer = null;
let deploymentMap = null; // New map instance for the tracking screen
let trackingPolyline = null; // Polyline to show the path
let watchId = null; // Stores the ID for geolocation watch
let probeMarker = null; // Marker for the user's live position
let html5QrCode = null; // Instance of the scanner class
let scannerActive = false;
let probeMarkersLayer = null;

// Initialize the mobile app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});




// mobile.js (Global area)

// Define the custom icon using the image you provided
const probeMarkerIcon = L.icon({
    iconUrl: '/static/uploads/probeMarker.png', // <-- Ensure this path is correct
    iconSize: [40, 40],        // Size of the icon
    iconAnchor: [20, 40],      // Point of the icon corresponding to the marker's actual location
    popupAnchor: [0, -35]      // Point from which the popup should open relative to the iconAnchor
});




/**
 * Initialize the mobile application
 */
// mobile.js

async function initializeApp() {
    console.log('Initializing ROOTAI Mobile App...');
    
    // Set up authentication event listeners first
    setupAuthEventListeners();

    // Check authentication status immediately. This function contains the auth.onAuthStateChanged listener.
    // It will handle showing 'home' or 'login' once Firebase determines the session status.
    checkAuthenticationStatus();
    
    // Wait for Firebase auth state to be determined
    await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            // CRITICAL: Force the screen to be resolved only after the first auth state check.
            if (user) {
                console.log('User is authenticated, continuing to main app flow.');
            } else {
                console.log('User not authenticated. Showing login screen.');
                // If onAuthStateChanged returns null (no session), we force the login screen.
                if (currentScreen !== 'home') { // Don't interrupt if another successful login flow is already running
                    showScreen('login'); 
                }
            }
            unsubscribe(); // Stop listening after first callback
            resolve();
        });
    });
    
    // NOTE: The rest of the original logic in initializeApp should be removed 
    // as it is now redundant and confusing after moving the main flow to checkAuthenticationStatus.

    console.log('Mobile app initialized successfully');
}

/**
 * Initialize the main application (after authentication)
 */
async function initializeMainApp() {
    // Load initial data
    await loadInitialData();
    
    // Set up event listeners
    setupEventListeners();
}

/**
 * Initialize the map
 */
function initializeMap() {
    const mapContainer = document.getElementById('field-map');
    if (!mapContainer) {
        console.log('Map container not found, will initialize later');
        return;
    }
    
    // Check if map is already initialized
    if (map) {
        console.log('Map already initialized');
        return;
    }
    
    console.log('Initializing map...');
    
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet not loaded!');
        return;
    }
    
    // Check if container is visible
    const containerRect = mapContainer.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
        // Removed the recursive retry, relying on showScreen logic
        console.log('Map container not visible, exiting init attempt.');
        return; 
    }
    
    try {
        // Clear any existing content
        mapContainer.innerHTML = '';
        
        // Initialize Leaflet map
        map = L.map('field-map', {
            preferCanvas: true,
            zoomControl: true,
            attributionControl: true
        }).setView([18.5204, 73.8567], 15); // default center
        
        console.log('✅ Leaflet map created');
    } catch (error) {
        console.error('❌ Error creating map:', error);
        showMapError();
        return;
    }
    
    // Add tile layer
    baseLayers = {
        'Street (OSM)': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 20
        }),
        'Satellite (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 20
        }),
        'Satellite (Google)': L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            subdomains: ['0','1','2','3'],
            maxZoom: 20,
            attribution: 'Imagery © Google'
        })
    };

    // Set the default active layer
    activeBaseLayer = baseLayers['Street (OSM)'];
    map.addLayer(activeBaseLayer);

    // Layer control
    L.control.layers(baseLayers, {}, { position: 'topright', collapsed: true }).addTo(map);

    // Keep track of which base layer is active
    map.on('baselayerchange', function (e) {
        activeBaseLayer = e.layer;
    });
    
    // Add draw controls (polygon only)
    drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 }
            },
            marker: false,
            circle: false,
            circlemarker: false,
            polyline: false,
            rectangle: false
        },
        edit: false
    });
    map.addControl(drawControl);

    // Listen for created polygon
    map.on(L.Draw.Event.CREATED, function (e) {
        if (drawnLayer) {
            map.removeLayer(drawnLayer); // Remove any previously drawn layer
        }
        drawnLayer = e.layer;
        drawnLayer.addTo(map);

        // Enable the save button.
        document.getElementById('save-field-btn').disabled = false;
    });

    // Try to locate the user
    locateUserOnMap();
    
    // Hide loading indicator
    const loadingIndicator = document.getElementById('map-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
    console.log('✅ Map initialized successfully');
}

function getMetricColor(metricPath) {
    if (metricPath.includes('temperature')) {
        // Red for Temperature
        return { border: '#ef4444', background: 'rgba(239, 68, 68, 0.5)' };
    }
    if (metricPath.includes('humidity')) {
        // Brown for Humidity
        return { border: '#A52A2A', background: 'rgba(165, 42, 42, 0.5)' };
    }
    if (metricPath.includes('moisture')) {
        // Green for Moisture
        return { border: '#10b981', background: 'rgba(16, 185, 129, 0.5)' };
    }
    if (metricPath.includes('rain')) {
        // Blue for Rain Count
        return { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.5)' };
    }
    // Default Gray
    return { border: '#6b7280', background: 'rgba(107, 114, 128, 0.5)' };
}


function createSquareBuffer(lat, lng, sizeMeters) {
    // Approximate conversion (rough for small field areas)
    const latDegreePerMeter = 1 / 111320; // 1 degree latitude ≈ 111,320 meters
    const lngDegreePerMeter = 1 / (111320 * Math.cos(lat * Math.PI / 180));
    
    const halfSideLat = (sizeMeters / 2) * latDegreePerMeter;
    const halfSideLng = (sizeMeters / 2) * lngDegreePerMeter;

    const minLat = lat - halfSideLat;
    const maxLat = lat + halfSideLat;
    const minLng = lng - halfSideLng;
    const maxLng = lng + halfSideLng;

    return [
        [minLat, minLng], // SW
        [minLat, maxLng], // SE
        [maxLat, maxLng], // NE
        [maxLat, minLng], // NW
        [minLat, minLng]  // Close the loop
    ];
}
/**
 * Load user's saved field from backend and display on map
 * (This function is now responsible for showing the GRİDDED view)
 */
/**
 * Load user's saved field from backend and display on map
 * (This function is now responsible for showing the GRİDDED view)
 */
async function loadUserSavedField() {
    if (!currentUser || !authToken || !map) {
        console.log('Pre-conditions failed: User, token, or map not ready. Skipping field load.');
        return;
    }
    
    // CRITICAL: Ensure the map and state are clean before fetching data (for new users/logins).
    clearMapStateAndUI(); 
    
    try {
        console.log('Loading saved field for user via backend API:', currentUser.uid);
        
        // Ask backend for fields 
        const res = await makeAuthenticatedRequest('/api/fields');
        if (!res.ok) {
            console.warn('Failed to fetch fields from backend:', res.status);
            alert('Failed to load saved field data. Please try again.');
            return;
        }
        const data = await res.json();
        const fields = data.fields || [];
        
        // Find field belonging to user (CRITICAL: Removed the generic `|| fields[0]` fallback)
        const userField = fields.find(f => f.userId === currentUser.uid);
        
        if (!userField) {
            console.log('No saved field found for user. Allowing map drawing.');
            // clearMapStateAndUI() already handled UI reset.
            
            // --- FIX 2 ---
            // Call with null to show the "Mark Planting Day" button
            updatePlantationStatus(null);
            // --- END FIX 2 ---
            
            return; // EXIT GRACEFULLY: New user is ready to draw map.
        }
        
        console.log('Found saved field from backend:', userField.fieldId || 'unknown-id');
        
        // --- FIX 1 ---
        // This line passes the saved date (or undefined) to the UI function
        updatePlantationStatus(userField.plantingDate);
        // --- END FIX 1 ---
        
        // Parse boundary data
        let boundary;
        try {
            boundary = typeof userField.boundary === 'string' 
                ? JSON.parse(userField.boundary) 
                : userField.boundary;
        } catch (error) {
            console.error('Error parsing boundary from backend:', error);
            return;
        }
        
        // Remove existing drawn layer (cleared by clearMapStateAndUI, but good practice to check state)
        if (drawnLayer && map.hasLayer(drawnLayer)) {
            map.removeLayer(drawnLayer);
            drawnLayer = null;
        }
        
        // Add field boundary to map and set state
        if (boundary && boundary.type === 'Polygon' && boundary.coordinates) {
            const coordinates = boundary.coordinates[0].map(coord => [coord[1], coord[0]]);
            
            // 1. Create the layer object (but DON'T add it to the main map yet)
            drawnLayer = L.polygon(coordinates, {
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.3,
                weight: 2
            });
            
            currentFieldId = userField.fieldId || null;
            
            const saveBtn = document.getElementById('save-field-btn');
            if (saveBtn) {
                // Keep the save button disabled/labeled as saved since a field exists
                saveBtn.disabled = true;
                saveBtn.textContent = 'Field Saved';
            }
            
            console.log('✅ User field loaded. Switching to Gridded View.');

            // 2. Clear main map section and immediately switch to the gridded satellite view
            returnToMainMap(); // Ensure the view is reset to show the main section before calling display
            
            // Use a short delay to ensure DOM update is complete before displaying the map
            setTimeout(async () => {
                 displayGriddedField(drawnLayer);
                 await loadAndDisplayProbeMarkers();
            }, 50);

        }
    } catch (error) {
        console.error('Error loading saved field from backend:', error);
        clearMapStateAndUI(); // Always clean up on error
    }
}
// mobile.js

function updatePlantationStatus(plantingDateISO) {
    const statusEl = document.getElementById('plantation-status');
    const plantBtn = document.getElementById('plant-now-card');

    if (!plantingDateISO) {
        // No planting date set, show the button to plant
        statusEl.classList.add('hidden');
        plantBtn.classList.remove('hidden');
        return;
    }

    const plantDate = new Date(plantingDateISO);
    const now = new Date();
    
    // Calculate difference in milliseconds
    const diffTime = Math.abs(now - plantDate);
    
    // Calculate difference in days (and add 1, so planting day is "Day 1")
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    statusEl.innerHTML = `
        <span class="font-bold text-2xl text-green-700">Day ${diffDays}</span>
        <p class="text-sm text-gray-600">of your plantation.</p>
    `;
    statusEl.classList.remove('hidden');
    
    // Hide the "Plant Now" button since it's already planted
    plantBtn.classList.add('hidden');
}

/**
 * Handles the click on the "Mark Planting Day" button.
 */
async function handlePlantNow() {
    if (!currentFieldId) {
        alert("Please save your field map before marking the planting day.");
        return;
    }
    
    if (!confirm("Are you sure you want to mark today as the planting day for this field?")) {
        return;
    }

    try {
        const res = await makeAuthenticatedRequest('/api/user/plant', {
            method: 'POST',
            body: JSON.stringify({ fieldId: currentFieldId })
        });
        
        if (!res.ok) {
            throw new Error("Failed to save planting date.");
        }

        const data = await res.json();
        // Immediately update the UI with the new date
        updatePlantationStatus(data.plantingDate);

    } catch (error) {
        console.error("Error marking planting day:", error);
        alert("An error occurred. Please try again.");
    }
}

/**
 * Initializes and starts the QR code scanner.
 */
function startScanner() {
    const readerId = 'reader';
    const messageContainer = document.getElementById('qr-message');
    const startStopBtn = document.getElementById('start-stop-scan-btn');
    
    if (html5QrCode) {
        html5QrCode.stop().then(() => { html5QrCode = null; });
    }
    
    html5QrCode = new Html5Qrcode(readerId);
    
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        // Use the rear camera if available
        facingMode: "environment" 
    };

    messageContainer.textContent = "Requesting camera permission...";
    startStopBtn.textContent = "Scanning...";
    startStopBtn.disabled = true;

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        // Success callback (when QR code is scanned)
        (decodedText, decodedResult) => {
            stopScanner(); // Stop camera instantly after a successful scan
            handleProbeScan(decodedText);
        },
        // Error callback
        (errorMessage) => {
            // This is often called continuously, ignore generic errors
            // console.warn(errorMessage);
        }
    )
    .then(() => {
        messageContainer.textContent = "Scanning active. Position QR code inside the box.";
        startStopBtn.textContent = "Stop Scanner";
        startStopBtn.disabled = false;
        scannerActive = true;
    })
    .catch((err) => {
        messageContainer.textContent = `Camera Error: ${err}. Please ensure camera is available and permissions are granted.`;
        startStopBtn.textContent = "Start Scanner";
        startStopBtn.disabled = false;
        scannerActive = false;
        console.error('Camera initialization failed:', err);
    });
}

/**
 * Stops the QR code scanner.
 */
function stopScanner() {
    if (html5QrCode && scannerActive) {
        html5QrCode.stop().then(() => {
            const messageContainer = document.getElementById('qr-message');
            const startStopBtn = document.getElementById('start-stop-scan-btn');
            
            messageContainer.textContent = "Scanner stopped.";
            startStopBtn.textContent = "Start Scanner";
            startStopBtn.disabled = false;
            scannerActive = false;
        }).catch(err => {
            console.error("Error stopping scanner:", err);
        });
    }
}
/**
 * Helper function to clean up map layers, reset global field state, 
 * and reset UI state (Draw/Save buttons) to allow drawing a new field.
 */
function clearMapStateAndUI() {
    // 1. Remove Polygon layer (if it was on the main map)
    if (drawnLayer && map.hasLayer(drawnLayer)) {
        map.removeLayer(drawnLayer);
    }
    drawnLayer = null;
    
    // 2. Hide the gridded map view and clean up the twin map instance
    returnToMainMap(); 

    // 3. Reset global field state
    currentFieldId = null;
    
    // 4. Reset UI elements
    const saveBtn = document.getElementById('save-field-btn');
    if (saveBtn) {
        // CRITICAL: Re-enable save button, but mark it disabled initially 
        // until the user actually draws a new polygon.
        saveBtn.disabled = true; 
        saveBtn.textContent = 'Save Field';
    }
}
/**
 * Delete the currently saved field (backend) and remove from map.
 * Requires backend endpoint: POST /api/field/delete  { fieldId }
 */
async function deleteCurrentField() {
    if (!currentFieldId) {
        alert('No saved field to delete');
        return;
    }

    if (!confirm('Are you sure you want to delete this saved field? This action cannot be undone.')) {
        return;
    }

    try {
        const res = await makeAuthenticatedRequest('/api/field/delete', {
            method: 'POST',
            body: JSON.stringify({ fieldId: currentFieldId })
        });

        if (res.ok) {
            // CRITICAL: Use the helper to clear all map layers, state, and UI.
            clearMapStateAndUI(); 
            
            // Re-enable the Draw Field button explicitly by showing the main map section
            // The returnToMainMap (called inside clearMapStateAndUI) already handles this.
            
            // Refresh field list
            await loadFieldList();
            
            alert('Field deleted successfully. You can now draw a new field.');
            console.log('Field deleted via backend and removed from map');
        } else {
            const err = await res.json().catch(() => ({}));
            alert('Failed to delete field: ' + (err.error || res.status));
            console.error('Delete field failed:', res.status, err);
        }
    } catch (e) {
        console.error('Network error deleting field:', e);
        alert('Network error deleting field: ' + e.message);
    }
}
/**
 * Hides the main map and shows a new, zoomed-in satellite map with the field and grid.
 * @param {L.Layer} fieldLayer The saved polygon layer.
 */
function displayGriddedField(fieldLayer) {
    const mainMapSection = document.getElementById('main-map-section');
    const griddedMapContainer = document.getElementById('gridded-field-map-container');

    // Hide main map section and show the new gridded map section
    mainMapSection.style.display = 'none';
    griddedMapContainer.style.display = 'block';

    // If a gridded map instance already exists, remove it to prevent errors
    if (griddedMap) {
        griddedMap.remove();
        griddedMap = null;
    }

    // Use a small delay to ensure the container is visible before initializing the map.
    setTimeout(() => {
        // Initialize the new "twin" map in its now-visible container
        griddedMap = L.map('gridded-field-map', {
            zoomControl: false, 
            attributionControl: false
        });

        // Add the satellite base layer to this new map
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 23
        }).addTo(griddedMap);

        // Add the drawn field polygon to the new map
        const fieldClone = L.geoJSON(fieldLayer.toGeoJSON(), {
            style: { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2 }
        }).addTo(griddedMap);
        
        // Generate the grid (using 5m blocks for mobile performance)
        const gridLayerGroup = generateFieldGrid(fieldLayer.toGeoJSON().geometry, 5); // 5m grid for mobile
        let gridCount = 0;
        
        if (gridLayerGroup) {
            gridLayerGroup.addTo(griddedMap);
            // Count the number of layers (squares) in the grid group
            gridCount = gridLayerGroup.getLayers().length;
        }

        // Update the display with the count of grid squares
        document.getElementById('grid-count-display').textContent = `Total Grid Squares: ${gridCount}`;

        // Tell the map to update its size now that it's visible
        griddedMap.invalidateSize();

        // Fit the new map perfectly to the field's bounds *after* it knows its size
        griddedMap.fitBounds(fieldClone.getBounds(), { 
            padding: [10, 10] ,
            maxZoom: 50});

    }, 10); // 10ms delay
}

/**
 * Fetches all probes saved under the current user's UID (from the 'scans' collection) 
 * and displays them on the home screen map.
 */

/**
 * Fetches all probes saved and displays them as markers AND 5m yellow squares.
 */
async function loadAndDisplayProbeMarkers() {
    if (!map || !currentUser || !currentUser.uid) {
        console.warn("Map or user not ready for probe marker loading.");
        return;
    }

    if (probeMarkersLayer) {
        map.removeLayer(probeMarkersLayer);
    }
    probeMarkersLayer = L.layerGroup();
    let markerBounds = L.latLngBounds([]);

    try {
        const res = await makeAuthenticatedRequest(`/api/user_scans/${currentUser.uid}`);
        
        if (!res.ok) {
            console.warn(`Failed to fetch probe scan locations. Status: ${res.status}`);
            return;
        }

        const data = await res.json();
        const probes = data.scans || [];

        probes.forEach(scan => {
            const lat = parseFloat(scan.latitude);
            const lng = parseFloat(scan.longitude);
            
            if (isNaN(lat) || isNaN(lng)) return;

            // --- 1. Draw the 5m Yellow Square Zone ---
            const squareCoords = createSquareBuffer(lat, lng, 5); // 5 meters square
            const probeZone = L.polygon(squareCoords, {
                color: '#f59e0b',       // Orange/Yellow border
                fillColor: '#fcd34d',   // Light Yellow fill (bg-yellow-300 tone)
                fillOpacity: 0.4,
                weight: 1
            });
            probeZone.bindTooltip(`Probe Zone (${scan.probe_id})`);
            probeMarkersLayer.addLayer(probeZone);


            // --- 2. Place the Custom Yellow Marker Icon ---
            const marker = L.marker([lat, lng], { icon: probeMarkerIcon });

            marker.bindPopup(`
                <h4 class="font-bold">Probe ID: ${scan.probe_id}</h4>
                <p>Field: ${scan.field_id}</p>
                <p>Planted: ${new Date(scan.timestamp).toLocaleDateString()}</p>
            `);

            probeMarkersLayer.addLayer(marker);
            markerBounds.extend([lat, lng]);
        });

        // 3. Add all layers to the map
        if (probeMarkersLayer.getLayers().length > 0) {
             probeMarkersLayer.addTo(map);

             if (map.getZoom() < 10) { 
                 map.fitBounds(markerBounds, { padding: [50, 50] });
             }
        }
        
        console.log(`✅ Loaded ${probes.length} probe markers and zones.`);

    } catch (error) {
        console.error("❌ Catastrophic error loading probe markers:", error);
    }
}

/**
 * Hides the gridded field view and returns to the main map.
 */
function returnToMainMap() {
    const mainMapSection = document.getElementById('main-map-section');
    const griddedMapContainer = document.getElementById('gridded-field-map-container');

    // Hide the gridded map section and show the main one
    griddedMapContainer.style.display = 'none';
    mainMapSection.style.display = 'block';

    // Clean up the twin map instance to free up resources
    if (griddedMap) {
        griddedMap.remove();
        griddedMap = null;
    }

    // Refresh the main map's size in case the container change affected it
    if (map) {
        map.invalidateSize();
    }
}

/**
 * Show map error state
 */
function showMapError() {
    const loadingIndicator = document.getElementById('map-loading');
    const errorIndicator = document.getElementById('map-error');
    
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorIndicator) errorIndicator.style.display = 'flex';
}

/**
 * Show map loading state
 */
function showMapLoading() {
    const loadingIndicator = document.getElementById('map-loading');
    const errorIndicator = document.getElementById('map-error');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (errorIndicator) errorIndicator.style.display = 'none';
}

/** Center map on user's current location (with graceful fallback) */
/** Center map on user's current location (with graceful fallback) */
/** Center map on user's current location (with graceful fallback) */
function locateUserOnMap() {
    if (!map || !navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }
    
    // CRITICAL: Ensure maximum accuracy and fresh location fix
    const options = { 
        enableHighAccuracy: true, 
        timeout: 10000000,
        maximumAge: 0 // Prevents the browser from using cached, stale location data
    };
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            // SUCCESS: This part runs if location is found
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            // Center map and place marker
            map.setView([lat, lng], 16);
            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup('You are here').openPopup();
            
            if (pos.coords.accuracy) {
                const acc = pos.coords.accuracy;
                L.circle([lat, lng], { radius: acc, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }).addTo(map);
            }
            console.log(`✅ Map centered successfully at: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`);
        },
        (error) => {
            // ERROR: This part runs if location fails (often due to security/denial)
            let errorMessage = 'Could not get your location. ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'You denied the request for Geolocation.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'The request to get user location timed out.';
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            // Alert user and note that the map remains at the default view
            alert(errorMessage + '\nPlease ensure you are on a secure (HTTPS or localhost) connection.');
        },
        options
    );
}
async function simulateProbeScan(probeId) {
    if (!currentUser || !currentFieldId) {
        alert("Error: Please log in and select/draw a field first.");
        return;
    }
    
    const messageContainer = document.getElementById('qr-message');
    const scanBtn = document.getElementById('mock-scan-btn');
    
    scanBtn.disabled = true;
    messageContainer.textContent = `Scanning ${probeId}... Getting device location...`;

    try {
        // 1. Get the current high-accuracy device location
        const location = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (error) => reject(new Error('Failed to get location: ' + error.message)),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });

        // 2. Prepare payload
        const payload = {
            userId: currentUser.uid,
            fieldId: currentFieldId,
            probeId: probeId,
            latitude: location.lat,
            longitude: location.lng,
            timestamp: new Date().toISOString()
        };

        // 3. Send to backend for storage (Create a new endpoint for this)
        const res = await makeAuthenticatedRequest('/api/probe/plant', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Server failed to save probe location. Status: ${res.status}`);
        }

        // 4. Success message and instruction
        messageContainer.innerHTML = `
            <p class="text-green-600 font-semibold">✅ Probe ${probeId} Planted!</p>
            <p class="mt-2">Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}</p>
            <p class="mt-4 font-bold">Now move towards the next probe!</p>
        `;
        
        // Optionally, show a marker on the main map/gridded map later
        // loadUserSavedField(); 
        
    } catch (error) {
        console.error('Probe Plantation Error:', error);
        messageContainer.textContent = `Plantation Failed: ${error.message}`;
    } finally {
        scanBtn.disabled = false;
        // Optionally update the button text/id to simulate scanning the next probe
        scanBtn.textContent = 'Simulate Scan (Next Probe)'; 
    }
}

/**
 * Load initial data
 */
async function loadInitialData() {
    try {
        // Load sensor data
        await loadSensorData();
        
        // Load live weather using user location
        await loadLiveWeather();

        // Load market trends
        await loadMarketTrends();
        
        // Load field list
        await loadFieldList();
        
        // Load current alerts
        await loadCurrentAlerts();
        
        // Load user's saved field and display it on map
        // This is now done in checkAuthenticationStatus/showScreen
        
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

/** Fetch live weather for current location */
async function loadLiveWeather() {
    try {
        if (!navigator.geolocation) return;
        await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
                    if (!res.ok) return resolve();
                    const data = await res.json();
                    updateWeatherDisplay(data, lat, lng);
                    resolve();
                } catch (_) { resolve(); }
            }, () => resolve(), { timeout: 8000 });
        });
    } catch (_) { /* ignore */ }
}

async function handlePlantStageUpdate(stage) {
    if (!currentUser) {
        alert("You must be logged in to do this.");
        return;
    }

    const saveBtn = document.getElementById('save-stage-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    try {
        const res = await makeAuthenticatedRequest('/api/field/stage', {
            method: 'POST',
            // --- THIS IS THE FIX ---
            // The payload no longer needs fieldId
            body: JSON.stringify({ 
                stage: stage 
            })
            // --- END FIX ---
        });

        if (!res.ok) {
            throw new Error("Failed to save plant stage.");
        }
        
        const data = await res.json();
        console.log(`Plant stage updated to ${data.stage}`);
        
        alert(`Plant stage saved as: ${data.stage}`);
        if (saveBtn) saveBtn.textContent = 'Saved!';
        setTimeout(() => {
            if (saveBtn) saveBtn.textContent = 'Save';
        }, 2000); 
        
    } catch (error) {
        console.error("Error updating plant stage:", error);
        alert("An error occurred. Please try again.");
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

function updateWeatherDisplay(weather, lat, lng) {
    try {
        const header = document.querySelector('#home-screen .text-center');
        if (!header || !weather) return;
        const temp = weather.temperature;
        const unit = (weather.units && weather.units.temperature) || '°C';
        const locationText = `Lat ${lat.toFixed(3)}, Lng ${lng.toFixed(3)}`;
        const lines = header.querySelectorAll('div');
        if (lines[0]) lines[0].textContent = `${temp !== undefined ? temp : '--'}${unit}`;
        if (lines[1]) lines[1].textContent = locationText;
    } catch (_) { /* ignore */ }
}

/**
 * Load sensor data
 */
/**
 * Load sensor data
 */
async function loadSensorData() {
    try {
        // FIX: Check for user and add UID to request
        if (!currentUser) {
            console.warn("loadSensorData: No user logged in.");
            return; 
        }
        const uid = currentUser.uid;
        const fieldId = 'field_A'; // Default field

        const response = await fetch(`/api/rtdb/sensor-data/latest?userId=${uid}&fieldId=${fieldId}`);
        
        if (response.ok) {
            sensorData = await response.json();
            updateSensorDisplay();
            
            // Update alerts if they exist in the sensor data
            if (sensorData.alerts) {
                updateAlertsDisplay(sensorData.alerts);
            }
        }
    } catch (error) {
        console.error('Error loading sensor data:', error);
        // Use mock data
        sensorData = {
            readingId: 'mock_001',
            timestamp: new Date().toISOString(),
            environment: {
                temperature: 32,
                humidity: 65,
                pressure: 1013
            },
            rain: {
                precipitation: 0,
                intensity: 'none'
            },
            soil: {
                moisture: 45,
                ph: 6.5,
                nutrients: {
                    nitrogen: 85,
                    phosphorus: 72,
                    potassium: 68
                }
            }
        };
        updateSensorDisplay();
    }
}

/**
 * Update sensor display
 */
function updateSensorDisplay() {
    if (!sensorData) return;
    
    const sensorReadings = document.getElementById('sensor-readings');
    if (!sensorReadings) return;
    
    const readings = [
        {
            name: 'Field Temperature',
            value: `${sensorData.environment.temperature}°C`,
            icon: '🌡️',
            metric: 'environment.temperature',
            trend: -2.07,
            color: 'red'
        },
        {
            name: 'Field Humidity',
            value: `${sensorData.environment.humidity}%`,
            icon: '☁️',
            metric: 'environment.humidity',
            trend: 0.07,
            color: 'blue'
        },
        {
            name: 'Soil Temperature',
            value: `${sensorData.soil.moisture}°C`,
            icon: '🌱',
            metric: 'soil.temperature',
            trend: 1.87,
            color: 'green'
        },
        {
            name: 'Soil Moisture',
            value: `${sensorData.soil.moisture}%`,
            icon: '💧',
            metric: 'soil.moisture',
            trend: 0.07,
            color: 'blue'
        },
        {
            name: 'Soil Humidity',
            value: `${sensorData.environment.humidity}%`,
            icon: '☁️',
            metric: 'environment.humidity',
            trend: -2.07,
            color: 'blue'
        },
        {
            name: 'Rain Count',
            value: `${sensorData.rain.precipitation}mm`,
            icon: '🌧️', 
            metric: 'rain.precipitation',
            trend: 0.07,
            color: 'blue'
        }
    ];
    
    sensorReadings.innerHTML = readings.map(reading => `
        <div class="sensor-card" data-metric="${reading.metric}">
            <div class="sensor-header">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${reading.icon}</span>
                    <span class="text-sm font-medium text-gray-700">${reading.name}</span>
                </div>
                <div class="sensor-value">${reading.value}</div>
            </div>
            <div class="trend-indicator ${reading.trend > 0 ? 'trend-up' : 'trend-down'}">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>${Math.abs(reading.trend)}%</span>
            </div>
            <div class="w-full h-2 bg-gray-200 rounded mt-2">
                <div class="h-2 bg-${reading.color}-500 rounded" style="width: ${Math.min(Math.abs(reading.trend) * 10, 100)}%"></div>
            </div>
        </div>
    `).join('');

    // Click to open metric detail
    document.querySelectorAll('#sensor-readings .sensor-card').forEach(card => {
        card.addEventListener('click', () => {
            const metric = card.getAttribute('data-metric');
            const title = card.querySelector('.text-sm.font-medium')?.textContent || 'Metric';
            openMetricDetail(metric, title);
        });
    });
}

// mobile.js (Add this new function)

/**
 * Checks if a probe was recently planted and triggers map reload.
 * This should be called immediately after showScreen('home').
 */
async function checkAndReloadProbes() {
    const deploymentSuccess = localStorage.getItem('deployment_success');
    
    if (deploymentSuccess === 'true' && map && currentUser) {
        console.log("Deployment flag detected. Reloading probes and map state...");
        
        // 1. Force the map to refresh all markers
        await loadAndDisplayProbeMarkers(); 
        
        // 2. Clear the flag immediately so it doesn't reload on next visit
        localStorage.removeItem('deployment_success');
        
        // Optional: Fly the map to the location of the newly planted marker (if possible)
        // If your loadAndDisplayProbeMarkers tracked the markers, you could pan here.
    }
}

/**
 * Load market trends
 */
async function loadMarketTrends() {
    try {
        const url = new URL('/api/market-trends', window.location.origin);
        const commodity = document.getElementById('mt-commodity')?.value;
        const state = document.getElementById('mt-state')?.value;
        const market = document.getElementById('mt-market')?.value;
        if (commodity) url.searchParams.set('commodity', commodity);
        if (state) url.searchParams.set('state', state);
        if (market) url.searchParams.set('market', market);
        const response = await fetch(url.toString());
        if (response.ok) {
            marketTrends = await response.json();
            updateMarketTrendsDisplay();
        }
    } catch (error) {
        console.error('Error loading market trends:', error);
    }
}

/**
 * Update market trends display
 */
function updateMarketTrendsDisplay() {
    if (!marketTrends || !marketTrends.commodities) return;
    
    const marketContent = document.getElementById('market-trends-content');
    if (!marketContent) return;
    
    const sourceBadge = `<div class="text-xs text-gray-500 mb-2">Source: ${marketTrends.source || 'unknown'}</div>`;
    
    marketContent.innerHTML = sourceBadge + marketTrends.commodities.map(commodity => `
        <div class="sensor-card">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${commodity.name}</h3>
                    <p class="text-sm text-gray-600">${commodity.market || 'Market'}</p>
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold text-gray-800">₹${commodity.price}</div>
                    <div class="text-sm text-gray-600">per ${commodity.unit}</div>
                </div>
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-sm text-gray-600">${commodity.grade || 'FAQ'}</span>
                <div class="trend-indicator ${commodity.change_percent > 0 ? 'trend-up' : 'trend-down'}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>${Math.abs(commodity.change_percent)}%</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Load field list
 */
async function loadFieldList() {
    try {
        const fieldSelect = document.getElementById('field-select');
        if (!fieldSelect) return;
        
        // Load user's fields from API
        console.log('Loading user fields...');
        const response = await makeAuthenticatedRequest('/api/fields');
        console.log('Fields API response:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            const fields = data.fields || [];
            console.log('Loaded fields:', fields);
            
            fieldSelect.innerHTML = '<option value="">Choose a field...</option>' +
                fields.map(field => `<option value="${field.fieldId}">${field.fieldName}</option>`).join('');
        } else {
            // Fallback to mock fields if API fails
            const mockFields = [
                { fieldId: 'field_001', fieldName: 'North Field' },
                { fieldId: 'field_002', fieldName: 'South Field' },
                { fieldId: 'field_003', fieldName: 'East Field' }
            ];
            
            fieldSelect.innerHTML = '<option value="">Choose a field...</option>' +
                mockFields.map(field => `<option value="${field.fieldId}">${field.fieldName}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading field list:', error);
        // Fallback to mock fields
        const fieldSelect = document.getElementById('field-select');
        if (fieldSelect) {
            const mockFields = [
                { fieldId: 'field_001', fieldName: 'North Field' },
                { fieldId: 'field_002', fieldName: 'South Field' },
                { fieldId: 'field_003', fieldName: 'East Field' }
            ];
            
            fieldSelect.innerHTML = '<option value="">Choose a field...</option>' +
                mockFields.map(field => `<option value="${field.fieldId}">${field.fieldName}</option>`).join('');
        }
    }
}

/**
 * Load current alerts
 */
/**
 * Load current alerts
 */
async function loadCurrentAlerts() {
    try {
        // FIX: Check for user and add UID to request
        if (!currentUser) {
            console.warn("loadCurrentAlerts: No user logged in.");
            return; 
        }
        const uid = currentUser.uid;
        const fieldId = 'field_A'; // Default field
        
        const response = await fetch(`/api/alerts/current?userId=${uid}&fieldId=${fieldId}`);
        
        if (response.ok) {
            const data = await response.json();
            updateAlertsDisplay(data.alerts || []);
        }
    } catch (error) {
        console.error('Error loading current alerts:', error);
    }
}

/**
 * Update alerts display on home screen
 */
function updateAlertsDisplay(alerts) {
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) return;
    
    // Filter only critical and warning alerts
    const activeAlerts = alerts.filter(alert => 
        alert.severity === 'critical' || alert.severity === 'warning'
    );
    
    if (activeAlerts.length === 0) {
        alertsContainer.innerHTML = '';
        return;
    }
    
    alertsContainer.innerHTML = activeAlerts.map(alert => `
        <div class="alert-card ${alert.severity}">
            <div class="alert-header">
                <span class="alert-icon">${alert.icon || '⚠️'}</span>
                <span class="alert-message">${alert.message}</span>
            </div>
            <div class="alert-recommendation">${alert.recommendation}</div>
        </div>
    `).join('');
}

/**
 * Check authentication status
 */
// mobile.js

/**
 * Check authentication status. Listens for Firebase state changes,
 * obtains the auth token, and orchestrates the transition to 'home' or 'login'.
 */
function checkAuthenticationStatus() {
    // Listen for authentication state changes
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            isAuthenticated = true;
            
            console.log('User authenticated:', user.email);
            
            // 1. AWAIT the ID token here. This ensures it's ready for API calls.
            try {
                authToken = await user.getIdToken();
                console.log('Auth token obtained and AWAITED');
            } catch (error) {
                console.error('Error getting auth token:', error);
                // If token fails, treat as unauthenticated
                currentUser = null;
                isAuthenticated = false;
                authToken = null;
            }
            
            if (isAuthenticated && currentUser) {
                 // 2. Initialize map and main app only AFTER token is ready
                if (!map) {
                    // Initialize map first if not done
                    initializeMap();
                }
                await initializeMainApp(); // Load initial data, etc.

                // 3. Immediately load the user's field
                await loadUserSavedField(); 

                // 4. Show the home screen
                showScreen('home');

                checkAndReloadProbes();
                
            } else {
                 // Fallback for failed token or explicit logout
                showScreen('login');
            }

        } else {
            // CRITICAL: This runs if no existing session is found or the user logs out.
            currentUser = null;
            isAuthenticated = false;
            authToken = null;
            
            // If the user logs out or the session is null on startup, force login screen.
            if (currentScreen !== 'login') {
                 showScreen('login');
            }
            console.log('User not authenticated');
        }
    });
}
/**
 * Set up authentication event listeners
 */
function setupAuthEventListeners() {
    // Login/Signup tab switching
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginTab && signupTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('text-green-600', 'border-b-2', 'border-green-600');
            loginTab.classList.remove('text-gray-500');
            signupTab.classList.add('text-gray-500');
            signupTab.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        });
        
        signupTab.addEventListener('click', () => {
            signupTab.classList.add('text-green-600', 'border-b-2', 'border-green-600');
            signupTab.classList.remove('text-gray-500');
            loginTab.classList.add('text-gray-500');
            loginTab.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
            signupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
    }
    
    // Signup link
    const signupLink = document.getElementById('signup-link');
    if (signupLink) {
        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (signupTab) signupTab.click();
        });
    }
    
    // Login form submission
    const loginContinueBtn = document.getElementById('login-continue-btn');
    if (loginContinueBtn) {
        loginContinueBtn.addEventListener('click', handleLogin);
    }
    
    // Signup form submission
    const signupContinueBtn = document.getElementById('signup-continue-btn');
    if (signupContinueBtn) {
        signupContinueBtn.addEventListener('click', handleSignup);
    }
    
    // Forgot password link
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('forgot-password');
        });
    }
    
    // Forgot password form submission
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', handleForgotPassword);
    }
    
    // Set password form submission
    const setPasswordContinueBtn = document.getElementById('set-password-continue-btn');
    if (setPasswordContinueBtn) {
        setPasswordContinueBtn.addEventListener('click', handleSetPassword);
    }
    
    // Success continue button
    const successContinueBtn = document.getElementById('success-continue-btn');
    if (successContinueBtn) {
        successContinueBtn.addEventListener('click', () => {
            showScreen('login');
        });
    }
    
    // Back buttons
    const forgotBackBtn = document.getElementById('forgot-back-btn');
    if (forgotBackBtn) {
        forgotBackBtn.addEventListener('click', () => {
            showScreen('login');
        });
    }
    
    const setPasswordBackBtn = document.getElementById('set-password-back-btn');
    if (setPasswordBackBtn) {
        setPasswordBackBtn.addEventListener('click', () => {
            showScreen('forgot-password');
        });
    }
    
    // Password visibility toggles
    setupPasswordVisibilityToggles();
}

/**
 * Set up password visibility toggles
 */
function setupPasswordVisibilityToggles() {
    const passwordToggles = document.querySelectorAll('button[type="button"]');
    passwordToggles.forEach(toggle => {
        const input = toggle.parentElement.querySelector('input[type="password"]');
        if (input) {
            toggle.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.innerHTML = `
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                        </svg>
                    `;
                } else {
                    input.type = 'password';
                    toggle.innerHTML = `
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                        </svg>
                    `;
                }
            });
        }
    });
}

/**
 * Handle login
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Get the ID token
        authToken = await user.getIdToken();
        
        // Initialize map if not already done
        if (!map) {
            initializeMap();
        }
        
        // Initialize main app
        await initializeMainApp();
        
        // Show home screen
        showScreen('home');
        
        console.log('✅ Login successful');
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
        }
        
        alert(errorMessage);
    }
}

/**
 * Handle signup
 */
async function handleSignup() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    if (!name || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        // Create user with Firebase
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update user profile with display name
        await user.updateProfile({
            displayName: name
        });
        
        // Get the ID token
        authToken = await user.getIdToken();
        
        // Initialize map if not already done
        if (!map) {
            initializeMap();
        }
        
        // Initialize main app
        await initializeMainApp();
        
        // Show home screen
        showScreen('home');
        
        console.log('✅ Signup successful');
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'Signup failed. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            case 'auth/invalid-api-key':
                errorMessage = 'Firebase configuration error. Please contact support.';
                break;
            case 'auth/app-not-authorized':
                errorMessage = 'App not authorized. Please check Firebase configuration.';
                break;
            default:
                errorMessage = `Signup failed: ${error.message}`;
        }
        
        console.error('Signup error details:', error.code, error.message);
        alert(errorMessage);
    }
}
/**
 * Handle forgot password
 */
async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value;
    
    if (!email) {
        alert('Please enter your email');
        return;
    }
    
    try {
        // Send password reset email
        await auth.sendPasswordResetEmail(email);
        alert('Password reset email sent! Check your inbox.');
        showScreen('login');
        
    } catch (error) {
        console.error('Forgot password error:', error);
        let errorMessage = 'Failed to send reset email. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
        }
        
        alert(errorMessage);
    }
}

/**
 * Handle set password
 */
async function handleSetPassword() {
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Show success screen
        showScreen('success');
        
    } catch (error) {
        console.error('Set password error:', error);
        alert('Failed to update password. Please try again.');
    }
}

/**
 * Logout function
 */
async function logout() {
    try {
        // Sign out from Firebase
        await auth.signOut();
        
        // Reset app state
        currentUser = null;
        authToken = null;
        isAuthenticated = false;
        currentScreen = 'login';
        
        // Hide bottom navigation
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }
        
        // Show login screen
        showScreen('login');
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    
    // Connect DOOT button
    const connectBtn = document.getElementById('connect-doot-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectWithDoot);
    }
    
    // ... (your other listeners like saveBtn, returnBtn, etc.)
    document.getElementById('plant-now-card').addEventListener('click', handlePlantNow);

    // Field selection
    const fieldSelect = document.getElementById('field-select');
    if (fieldSelect) {
        fieldSelect.addEventListener('change', function() {
            currentFieldId = this.value;
            if (currentFieldId) {
                loadFieldData(currentFieldId);
            }
        });
    }
    
    // Image upload handlers
    const healthUpload = document.getElementById('health-image-upload');
    if (healthUpload) {
        healthUpload.addEventListener('change', handleHealthImageUpload);
    }
    
    const growthUpload = document.getElementById('growth-image-upload');
    if (growthUpload) {
        growthUpload.addEventListener('change', handleGrowthImageUpload);
    }

    // Load Saved Field Button (for manual/programmatic load)
    const loadFieldBtn = document.getElementById('load-field-btn');
    if (loadFieldBtn) {
        loadFieldBtn.addEventListener('click', loadUserSavedField);
    }

    // Draw field button
    const drawBtn = document.getElementById('draw-field-btn');
    if (drawBtn) {
        drawBtn.addEventListener('click', function() {
            // Ensure map is initialized before drawing
            if (!map) {
                console.log('Map not initialized, alerting user.');
                alert('Map is not ready yet. Please wait a moment for the map to fully load, or check your internet connection.');
                return;
            }
            new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
        });
    }
    
    // Save field button
    const saveBtn = document.getElementById('save-field-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDrawnField);
    }

    // Locate button
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', locateUserOnMap);
    }

    const applyBtn = document.getElementById('mt-apply');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => loadMarketTrends());
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Retry map button
    const retryMapBtn = document.getElementById('retry-map-btn');
    if (retryMapBtn) {
        retryMapBtn.addEventListener('click', function() {
            console.log('Retrying map initialization...');
            showMapLoading();
            // Reset map variable
            map = null;
            // Go back to home screen to trigger the initialization logic
            showScreen('home');
        });
    }


    const saveStageBtn = document.getElementById('save-stage-btn');
    if (saveStageBtn) {
        saveStageBtn.addEventListener('click', () => {
            // Find the select element
            const plantStageSelect = document.getElementById('plant-stage-select');
            const selectedStage = plantStageSelect.value;
            
            if (selectedStage) {
                // Call the same save function as before
                handlePlantStageUpdate(selectedStage);
            } else {
                alert("Please select a stage first.");
            }
        });
    }

    const returnBtn = document.getElementById('return-to-main-map-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', returnToMainMap);
    }

    // Delete field button (remove saved field for this user)
    const deleteBtn = document.getElementById('delete-field-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteCurrentField);
    }

    // START: Insert these new listeners
    const showCurrentBtn = document.getElementById('show-current-btn');
    if (showCurrentBtn) {
        showCurrentBtn.addEventListener('click', fetchCurrentStatus);
    }

    const showHistoryBtn = document.getElementById('show-history-btn');
    if (showHistoryBtn) {
        showHistoryBtn.addEventListener('click', fetchHistoricalLogs);
    }
    // mobile.js (inside setupEventListeners function)

    // START/STOP SCANNER BUTTON
    const startStopScanBtn = document.getElementById('start-stop-scan-btn');
    if (startStopScanBtn) {
        startStopScanBtn.addEventListener('click', () => {
            if (scannerActive) {
                stopScanner();
            } else {
                startScanner();
            }
        });
    }

    
    // START Deploying Probes
    // DELETE this block if it appears twice inside setupEventListeners()

// mobile.js

// ... inside setupEventListeners() ...

const startDeploymentBtn = document.getElementById('start-deployment-btn');
if (startDeploymentBtn) {
    startDeploymentBtn.addEventListener('click', () => {
        // initializeDeploymentMap(); // This is for the old, internal screen
        // showScreen('deployment-tracking'); // This is for the old, internal screen

        // CRITICAL NEW CODE: Redirect with token
        if (currentUser && authToken) {
            window.location.href = `/live_tracker?token=${authToken}`;
        } else {
             alert('Please log in first to use the Live Tracker.');
        }
    });
}
// DELETE this block if it appears twice inside setupEventListeners()

const qrPlantationBtn = document.getElementById('launch-qr-scanner-btn'); 
if (qrPlantationBtn) {
    qrPlantationBtn.addEventListener('click', launchQRScanner);
}

    // Stop Tracking
    const stopTrackingBtn = document.getElementById('stop-tracking-btn');
    if (stopTrackingBtn) {
        stopTrackingBtn.addEventListener('click', stopLiveTracking);
    }

    // Mock Scan
    const mockScanBtn = document.getElementById('mock-scan-btn');
    if (mockScanBtn) {
        mockScanBtn.addEventListener('click', () => {
            // Simulate scanning a probe ID
            simulateProbeScan('P-42-W'); 
        });
    }
    // END: End of new listeners
}

/**
 * Show specific screen
 */
function showScreen(screenName) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show selected screen
    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenName;
        
        // Show/hide bottom navigation based on authentication and screen
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            if (isAuthenticated && ['home', 'crop-health', 'profile'].includes(screenName)) {
                bottomNav.style.display = 'flex';
                updateNavigation(screenName);
            } else {
                bottomNav.style.display = 'none';
            }
        }
        
        // Load screen-specific data
        loadScreenData(screenName);
        
        // CENTRALIZED MAP LOGIC
        if (screenName === 'home') {
            
            // 1. If map is already initialized, ensure it recalculates its size.
            if (map) {
                map.invalidateSize();
            }
            
            // 2. If map is NOT initialized, force initialization after a delay.
            if (!map) {
                showMapLoading();

                // Use a short delay (300ms) to ensure the browser has fully rendered the "active" class
                setTimeout(() => {
                    initializeMap(); 

                    if (map) {
                        console.log('✅ Map initialized successfully after DOM render delay. Ready to load field.');
                        
                        // CRUCIAL: Force Leaflet to calculate its container size after initialization.
                        map.invalidateSize(); 

                        // 3. AUTOMATICALLY load the saved map 
                        loadUserSavedField();
                        
                    } else {
                        console.log('Map failed to initialize, showing error.');
                        showMapError();
                    }
                }, 300);
            }
        }
    }
}

/**
 * Update navigation
 */
function updateNavigation(activeScreen) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Map screen names to nav items
    const navMap = {
        'home': 0,
        'crop-health': 1,
        'profile': 2
    };
    
    const navIndex = navMap[activeScreen];
    if (navIndex !== undefined && navItems[navIndex]) {
        navItems[navIndex].classList.add('active');
    }
}

/**
 * Load screen-specific data
 */
function loadScreenData(screenName) {
    switch (screenName) {
        case 'home':
            // Initialization handled in showScreen logic above
            break;
        case 'field-analytics':
            initializeAnalyticsChart();
            startSensorAutoRefresh();
            break;
        case 'growth-tracker':
            initializeGrowthChart();
            break;
        case 'market-trends':
            updateMarketTrendsDisplay();
            break;
        case 'profile':
            updateProfileData();
            break;
        case 'qr-scanner':
            startScanner();
            break;
        default:
            if (html5QrCode && scannerActive) {
                stopScanner();
            }
            break;
    }
}

// mobile.js

/**
 * Initializes the map for the live deployment tracking screen.
 */
function initializeDeploymentMap() {
    const mapContainer = document.getElementById('deployment-map');
    
    if (deploymentMap) {
        deploymentMap.remove(); // Clean up old map instance
        deploymentMap = null;
    }
    
    // Initialize Leaflet map
    deploymentMap = L.map('deployment-map', {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: false
    });
    
    // Add satellite layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 23
    }).addTo(deploymentMap);

    // Fit to the current field boundary, if available
    if (drawnLayer) {
        deploymentMap.fitBounds(drawnLayer.getBounds(), { padding: [10, 10] });
    } else {
        deploymentMap.setView([20.0, 77.0], 10);
    }
    
    // Reset layers
    if (trackingPolyline) {
        trackingPolyline.remove();
    }
    trackingPolyline = L.polyline([], { color: 'red', weight: 4 }).addTo(deploymentMap);

    if (probeMarker) {
        probeMarker.remove();
    }
    
    startLiveTracking();
}


/**
 * Starts continuous geolocation and updates the map and polyline.
 */
function startLiveTracking() {
    if (!navigator.geolocation) {
        document.getElementById('deployment-status').textContent = 'Geolocation is not supported by this browser.';
        return;
    }
    
    document.getElementById('deployment-status').textContent = 'Status: Tracking started...';
    
    // Options for high accuracy, frequent updates
    const options = { enableHighAccuracy: true, maximumAge: 300000, timeout: 50000 };

    // Watch position to get continuous updates
    watchId = navigator.geolocation.watchPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const newLatLng = [lat, lng];

        document.getElementById('deployment-status').textContent = 'Status: Currently tracking...';
        document.getElementById('deployment-coords').textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        
        // 1. Update/Move Marker
        if (!probeMarker) {
            probeMarker = L.circleMarker(newLatLng, { radius: 8, color: '#0000ff', fillColor: '#3b82f6', fillOpacity: 0.9 }).addTo(deploymentMap);
        } else {
            probeMarker.setLatLng(newLatLng);
        }
        
        // 2. Update Path (Polyline)
        const currentPath = trackingPolyline.getLatLngs();
        // Only add a new point if the distance is greater than a threshold (e.g., 1 meter)
        if (currentPath.length === 0 || L.latLng(newLatLng).distanceTo(currentPath[currentPath.length - 1]) > 1) {
             trackingPolyline.addLatLng(newLatLng);
        }
        
        // 3. Keep map centered on user
        deploymentMap.setView(newLatLng);

    }, (error) => {
        document.getElementById('deployment-status').textContent = `Tracking Error: ${error.message}`;
        console.error('Geolocation Tracking Error:', error);
    }, options);
}

/**
 * Stops continuous geolocation updates.
 */
function stopLiveTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        document.getElementById('deployment-status').textContent = 'Status: Tracking stopped.';
    }
}

/**
 * Update profile data
 */
function updateProfileData() {
    if (currentUser) {
        const userName = currentUser.displayName || 'User Name';
        const userEmail = currentUser.email || 'user@example.com';
        
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        
        if (profileName) profileName.textContent = userName;
        if (profileEmail) profileEmail.textContent = userEmail;
    }
}

/**
 * Make authenticated API call
 */
async function makeAuthenticatedRequest(url, options = {}) {
    if (!authToken) {
        throw new Error('No authentication token available');
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    const response = await fetch(url, mergedOptions);
    
    if (response.status === 401) {
        // Token expired, sign out user
        await auth.signOut();
        throw new Error('Authentication expired');
    }
    
    return response;
}

/**
 * Initialize analytics chart
 */
/**
 * Initialize analytics chart
 */
function initializeAnalyticsChart() {
    const ctx = document.getElementById('analytics-chart');
    if (!ctx) return;
    
    if (analyticsChart) {
        analyticsChart.destroy();
    }

    analyticsChart = new Chart(ctx, {
        type: 'bar', // <-- YEH CHANGE HUA HAI (line se bar)
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'Sensor', 
                data: [], 
                borderColor: '#10b981', // Default, yeh overwrite ho jayega
                backgroundColor: 'rgba(16,185,129,0.5)', // Default
                // tension, fill, aur pointRadius hata diye gaye hain
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });

    // Load history for selected metric
    const metricSelect = document.getElementById('metric-select');
    if (metricSelect) {
        metricSelect.onchange = () => refreshSensorHistory();
    }
    refreshSensorHistory(); // Yeh function ab initial color bhi set kar dega
}


/**
 * Initialize growth chart
 */
function initializeGrowthChart() {
    const ctx = document.getElementById('growth-chart');
    if (!ctx) return;
    
    if (growthChart) {
        growthChart.destroy();
    }
    
    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [{
                label: 'Growth Progress',
                data: [20, 35, 50, 65, 85, 90, 95],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 25
                    }
                }
            }
        }
    });
}

async function handleProbeScan(probeId) {
    if (!currentUser || !currentFieldId) {
        alert("Error: Please log in and select/draw a field first.");
        return;
    }
    
    const messageContainer = document.getElementById('qr-message');
    const statusBox = document.getElementById('plantation-status-box');

    statusBox.style.display = 'block';
    statusBox.textContent = `✅ Scanned Probe ID: ${probeId}. Getting device location...`;
    messageContainer.textContent = "";

    try {
        // 1. Get the current high-accuracy device location
        const location = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (error) => reject(new Error('Failed to get location: ' + error.message)),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });

        // 2. Prepare payload and send to backend
        const payload = {
            userId: currentUser.uid,
            fieldId: currentFieldId,
            probeId: probeId,
            latitude: location.lat,
            longitude: location.lng,
            timestamp: new Date().toISOString()
        };

        const res = await makeAuthenticatedRequest('/api/probe/plant', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Server failed to save probe location. Status: ${res.status}`);
        }

        // 3. Success message and instruction
        statusBox.className = 'p-3 bg-green-100 rounded-lg text-sm font-medium text-green-800';
        statusBox.innerHTML = `
            <p class="font-semibold">✅ Probe ${probeId} Planted Successfully!</p>
            <p class="mt-1">Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}</p>
            <p class="mt-2 font-bold">Now move towards the next probe!</p>
        `;
        messageContainer.textContent = "Tap 'Start Scanner' again for the next probe.";

        await loadAndDisplayProbeMarkers();

    } catch (error) {
        console.error('Probe Plantation Error:', error);
        statusBox.className = 'p-3 bg-red-100 rounded-lg text-sm font-medium text-red-800';
        statusBox.textContent = `❌ Plantation Failed: ${error.message}`;
    }
}

/** Save drawn field to backend */
// mobile.js

async function saveDrawnField() {
    if (!drawnLayer) {
        alert('Please draw a field first');
        return;
    }
    const latlngs = drawnLayer.getLatLngs()[0] || drawnLayer.getLatLngs();
    const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
    if (coordinates.length && (coordinates[0][0] !== coordinates[coordinates.length-1][0] || coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
        coordinates.push(coordinates[0]);
    }
    const geojson = { type: 'Polygon', coordinates: [coordinates] };

    // NOTE: 'fieldBoundary' must be set before calling this function for accurate local saving.
    // Assuming fieldBoundary is set when the layer is drawn/edited.
    
    const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    const payload = { fieldId, fieldName: `Field ${new Date().toLocaleDateString()}` , boundary: geojson , userId: currentUser.uid}; 

    try {
        console.log('Saving field with payload:', payload);
        const res = await makeAuthenticatedRequest('/api/field/save', { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        });
        console.log('Save field response:', res.status);
        
        if (res.ok) {
            const data = await res.json();
            currentFieldId = data.fieldId;
            console.log('Field saved successfully:', data);

            // === CRITICAL LOCAL STORAGE UPDATE ===
            try { 
                localStorage.setItem('currentFieldId', currentFieldId); 
                // Save the GeoJSON object (which is stored in 'geojson' variable here)
                localStorage.setItem('savedFieldBoundary', JSON.stringify(geojson)); 
            } catch (_) {}
            // ===================================
            
            // MODIFIED: Switch to the gridded satellite view (which triggers marker loading)
            displayGriddedField(drawnLayer); 
            
            alert('Field saved successfully! Displaying gridded satellite view.');
            document.getElementById('save-field-btn').disabled = true;
            
            // Reload field list in the background
            await loadFieldList();
        } else {
            const err = await res.json();
            console.error('Save field error:', err);
            alert('Failed to save field: ' + (err.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Error saving field:', e);
        alert('Network error saving field: ' + e.message);
    }
}
/** Fetch RTDB history and update chart */
/** Fetch RTDB history and update chart */
/** Fetch RTDB history and update chart */
async function refreshSensorHistory() {
    
    // User check
    if (!currentUser) {
        console.warn("Analytics chart: No user logged in.");
        if (analyticsChart) {
            analyticsChart.data.labels = [];
            analyticsChart.data.datasets[0].data = [];
            analyticsChart.update();
        }
        return;
    }

    try {
        const uid = currentUser.uid;
        const fieldId = 'field_A'; 

        // User ID ke saath fetch karein
        const res = await fetch(`/api/rtdb/sensor-data/history?userId=${uid}&fieldId=${fieldId}`);
        
        if (!res.ok) {
            console.error("Failed to fetch history for chart", res.status);
            return;
        }
        
        const data = await res.json();
        const readings = data.readings || [];
        
        const metricPath = document.getElementById('metric-select')?.value || 'environment.humidity';
        const values = readings.map(r => getMetricValue(r, metricPath)).filter(v => typeof v === 'number');
        const labels = readings.map(r => new Date(r.timestamp || Date.now()).toLocaleTimeString());

        // --- YEH NAYA BLOCK ADD HUA HAI ---
        // Metric ke hisaab se color get karein
        const colors = getMetricColor(metricPath);
        // --- END NAYA BLOCK ---

        if (analyticsChart) { // Check karein ki chart hai ya nahi
            analyticsChart.data.labels = labels;
            analyticsChart.data.datasets[0].label = metricPath;
            analyticsChart.data.datasets[0].data = values;
            
            // --- YEH NAYA BLOCK ADD HUA HAI ---
            // Chart ke dataset mein colors update karein
            analyticsChart.data.datasets[0].borderColor = colors.border;
            analyticsChart.data.datasets[0].backgroundColor = colors.background;
            // --- END NAYA BLOCK ---

            analyticsChart.update(); 
        }

        updateAllTrendBarsFromHistory(readings);

    } catch (e) {
        console.error('Error loading history for chart', e);
    }
}


function getMetricValue(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

let autoRefreshHandle = null;
function startSensorAutoRefresh() {
    if (autoRefreshHandle) clearInterval(autoRefreshHandle);
    autoRefreshHandle = setInterval(() => {
        loadSensorData(); // Fetch latest sensor readings
        refreshSensorHistory(); // Update history charts
        loadCurrentAlerts(); // Also refresh alerts
    }, 10 * 1000); // Check every 10 seconds for real-time updates
}

/**
 * Connect with DOOT device
 */
async function connectWithDoot() {
    const btn = document.getElementById('connect-doot-btn');
    const status = document.getElementById('connection-status');
    
    if (!btn || !status) return;
    
    try {
        btn.textContent = 'Connecting...';
        btn.disabled = true;
        
        // Simulate connection process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update UI
        btn.textContent = 'Connected';
        btn.style.background = '#10b981';
        status.textContent = 'Connected';
        status.className = 'connection-status connected';
        
    } catch (error) {
        console.error('Error connecting with DOOT:', error);
        btn.textContent = 'Connect with DOOT';
        btn.disabled = false;
        status.textContent = 'Connection Failed';
        status.className = 'connection-status disconnected';
    }
}

/**
 * Load field data
 */
async function loadFieldData(fieldId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/field/${fieldId}`);
        if (response.ok) {
            const fieldData = await response.json();
            console.log('Field data loaded:', fieldData);
            // Update map with field boundary
            updateMapWithField(fieldData);
        } else {
            console.error('Failed to load field data');
        }
    } catch (error) {
        console.error('Error loading field data:', error);
    }
}

/**
 * Update map with field data
 */
function updateMapWithField(fieldData) {
    if (!map || !fieldData.boundary) return;
    
    // Clear existing layers
    map.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });
    
    // Parse boundary data
    let boundary;
    try {
        boundary = typeof fieldData.boundary === 'string' 
            ? JSON.parse(fieldData.boundary) 
            : fieldData.boundary;
    } catch (error) {
        console.error('Error parsing boundary data:', error);
        return;
    }
    
    // Add field boundary to map
    if (boundary.type === 'Polygon' && boundary.coordinates) {
        const coordinates = boundary.coordinates[0].map(coord => [coord[1], coord[0]]);
        const fieldPolygon = L.polygon(coordinates, {
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.3
        }).addTo(map);
        
        map.fitBounds(fieldPolygon.getBounds());
    }
}

/**
 * Handle health image upload
 */
async function handleHealthImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // Send to diagnosis API
        const response = await fetch('/api/diagnose', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: base64
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            displayDiagnosisResult(result);
        }
    } catch (error) {
        console.error('Error processing health image:', error);
        alert('Error processing image. Please try again.');
    }
}

/**
 * Handle growth image upload
 */
async function handleGrowthImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // For now, just show a success message
        alert('Growth analysis image uploaded successfully!');
        
    } catch (error) {
        console.error('Error processing growth image:', error);
        alert('Error processing image. Please try again.');
    }
}

/**
 * Display diagnosis result
 */
function displayDiagnosisResult(result) {
    const resultsDiv = document.getElementById('diagnosis-results');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <h3 class="text-lg font-semibold text-gray-800">Results</h3>
        </div>
        <div class="mb-4">
            <img src="data:image/jpeg;base64,${result.image || ''}" alt="Diagnosed leaf" class="w-full h-48 object-cover rounded-lg">
        </div>
        <div class="space-y-3">
            <div>
                <h4 class="font-semibold text-gray-800">Possible Diseases:</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-gray-700">${result.disease}</span>
                    <span class="confidence-badge">${Math.round(result.confidence * 100)}% Confidence</span>
                </div>
            </div>
            <div>
                <h4 class="font-semibold text-gray-800">Possible Cause:</h4>
                <p class="text-sm text-gray-600 mt-1">${result.cause || 'This disease is caused by a fungus, primarily Septoria chrysanthemi.'}</p>
            </div>
            <div>
                <h4 class="font-semibold text-gray-800">Recommended Cure:</h4>
                <p class="text-sm text-gray-600 mt-1">${result.recommendation || 'Fungicides: Chlorothalonil: A broad-spectrum fungicide effective against many leaf spots.'}</p>
            </div>
        </div>
    `;
    
    resultsDiv.style.display = 'block';
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Export functions for global access
window.showScreen = showScreen;
window.connectWithDoot = connectWithDoot;

// Compute deltas and update corresponding sensor card's trend and bar
function updateTrendBarsFromHistory(values, metricPath) {
    if (!values || values.length < 2) return;
    const current = values[values.length - 1];
    const previous = values[values.length - 2];
    const delta = Number((current - previous).toFixed(2));
    const percent = previous !== 0 ? ((delta / Math.abs(previous)) * 100) : 0;

    const card = Array.from(document.querySelectorAll('#sensor-readings .sensor-card'))
        .find(el => el.getAttribute('data-metric') === metricPath);
    if (!card) return;

    const indicator = card.querySelector('.trend-indicator');
    indicator.classList.toggle('trend-up', delta > 0);
    indicator.classList.toggle('trend-down', delta <= 0);
    const span = indicator.querySelector('span:last-child');
    if (span) span.textContent = `${Math.abs(percent).toFixed(2)}%`;

    const bar = card.querySelector('.w-full .h-2');
    if (bar) bar.style.width = `${Math.min(Math.abs(percent), 100)}%`;

    // Add subtitle message for aria (not shown here)
    card.setAttribute('data-delta', delta);
}

function updateAllTrendBarsFromHistory(readings) {
    const metrics = ['environment.temperature', 'environment.humidity', 'soil.moisture', 'rain.precipitation'];
    metrics.forEach(metric => {
        const values = readings
            .map(r => getMetricValue(r, metric))
            .filter(v => typeof v === 'number');
        updateTrendBarsFromHistory(values, metric);
    });
}

async function openMetricDetail(metricPath, title) {
    showScreen('metric-detail');
    document.getElementById('metric-detail-title').textContent = title;
    document.getElementById('metric-detail-subtitle').textContent = `${title} History`;

    // Build chart
    const ctx = document.getElementById('metric-detail-chart');
    if (metricDetailChart) metricDetailChart.destroy();

    try {
        const res = await fetch('/api/rtdb/sensor-data/history');
        const data = await res.json();
        const readings = data.readings || [];
        const values = readings.map(r => getMetricValue(r, metricPath)).filter(v => typeof v === 'number');
        const labels = readings.map(r => new Date(r.timestamp || Date.now()).toLocaleTimeString());

        metricDetailChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: title, data: values, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.35, fill: true, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
        });

        const msg = document.getElementById('metric-detail-msg');
        if (values.length >= 2) {
            const current = values[values.length - 1];
            const previous = values[values.length - 2];
            const delta = Number((current - previous).toFixed(2));
            if (delta > 0) {
                msg.textContent = `${title} is slightly increased by ${delta}`;
            } else if (delta < 0) {
                msg.textContent = `${title} seems decreasing by ${Math.abs(delta)}`;
            } else {
                msg.textContent = `${title} is unchanged compared to previous reading.`;
            }
        } else {
            msg.textContent = 'Not enough data to compute change.';
        }
    } catch (e) {
        console.error('Metric detail error', e);
    }
}

/**
 * Show grid overlay for field boundary
 */
function showGrid(geojson) {
    if (!geojson) return;
    
    // Remove existing grid layer
    if (gridLayer) {
        map.removeLayer(gridLayer);
    }
    
    // Generate grid
    gridLayer = generateFieldGrid(geojson);
    map.addLayer(gridLayer);
    gridVisible = true;
    
    console.log('Grid displayed with 1x1 meter blocks');
}

/**
 * Generate grid overlay for field boundary
 */
function generateFieldGrid(geojson) {
    if (!geojson || !geojson.coordinates || !geojson.coordinates[0]) return null;
    
    const coords = geojson.coordinates[0];
    const bounds = getBoundsFromCoordinates(coords);
    
    // Calculate grid size in meters (5 meter per grid cell)
    const gridSizeMeters = 5;
    
    // Convert meters to degrees (approximate)
    const latDegreePerMeter = 1 / 111320; // 1 degree latitude ≈ 111,320 meters
    const lngDegreePerMeter = 1 / (111320 * Math.cos(Math.PI / 180 * bounds.center.lat));
    
    const gridSizeLat = gridSizeMeters * latDegreePerMeter;
    const gridSizeLng = gridSizeMeters * lngDegreePerMeter;
    
    // Create grid layer
    const gridGroup = L.layerGroup();
    
    // Calculate number of grid cells
    const latCells = Math.ceil((bounds.max.lat - bounds.min.lat) / gridSizeLat);
    const lngCells = Math.ceil((bounds.max.lng - bounds.min.lng) / gridSizeLng);
    
    // Generate grid cells
    for (let i = 0; i < latCells; i++) {
        for (let j = 0; j < lngCells; j++) {
            const cellLat1 = bounds.min.lat + (i * gridSizeLat);
            const cellLng1 = bounds.min.lng + (j * gridSizeLng);
            const cellLat2 = bounds.min.lat + ((i + 1) * gridSizeLat);
            const cellLng2 = bounds.min.lng + ((j + 1) * gridSizeLng);
            
            // Get the center of the cell to check if it's inside the main polygon
            const cellCenter = L.polygon([[cellLat1, cellLng1], [cellLat2, cellLng1], [cellLat2, cellLng2], [cellLat1, cellLng2]]).getBounds().getCenter();
            
            if (isPointInPolygon([cellCenter.lat, cellCenter.lng], coords.map(c => [c[1], c[0]]))) {
                 const cellPolygon = L.polygon([[cellLat1, cellLng1], [cellLat2, cellLng1], [cellLat2, cellLng2], [cellLat1, cellLng2]], {
                    color: '#6366f1',
                    weight: 1,
                    opacity: 0.8,
                    fillColor: '#6366f1',
                    fillOpacity: 0.1,
                    className: 'grid-cell'
                });
                
                const cellNumber = i * lngCells + j + 1;
                cellPolygon.bindPopup(`
                    <div class="text-center">
                        <h3 class="font-semibold text-indigo-600">Grid Cell ${cellNumber}</h3>
                        <p class="text-sm text-gray-600">Size: 1m × 1m</p>
                    </div>
                `);
                
                gridGroup.addLayer(cellPolygon);
            }
        }
    }
    
    return gridGroup;
}

/**
 * Get bounds from coordinates array
 */
function getBoundsFromCoordinates(coords) {
    let minLat = coords[0][1]; // Note: coords are [lng, lat] format
    let maxLat = coords[0][1];
    let minLng = coords[0][0];
    let maxLng = coords[0][0];
    
    coords.forEach(coord => {
        const [lng, lat] = coord;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    });
    
    return {
        min: { lat: minLat, lng: minLng },
        max: { lat: maxLat, lng: maxLng },
        center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
    };
}

/**
 * Check if point is inside polygon using ray casting algorithm.
 */
function isPointInPolygon(point, polygon) {
    const x = point[1]; // lng
    const y = point[0]; // lat
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][1]; // lng
        const yi = polygon[i][0]; // lat
        const xj = polygon[j][1]; // lng
        const yj = polygon[j][0]; // lat
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) {
            inside = !inside;
        }
    }
    
    return inside;
}
