// map.js - Pasugo Map Controller - Modern Minimalist Design
// Handles all map interactions, geolocation, and marker management
// FOR CUSTOMER DASHBOARD - Sends location updates to keep customer position fresh

const API_BASE_URL = "https://pasugo.onrender.com";

class PasugoMap {
  constructor() {
    this.map = null;
    this.userLocationMarker = null;
    this.accuracyCircle = null;
    this.riderMarkers = []; // Array to store all rider markers
    this.currentMapStyle = "street";
    this.watchId = null;
    this.fetchRidersInterval = null;

    // Default fallback location (Manila, Philippines)
    this.defaultLocation = [14.5995, 120.9842];

    // Enhanced high accuracy geolocation options
    this.geoOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    };

    // Track location attempts for better accuracy
    this.bestAccuracy = Infinity;
    this.bestPosition = null;

    // User's current position
    this.userPosition = null;

    // Throttle backend location updates (every 30 seconds)
    this.lastLocationSyncTime = 0;
    this.locationSyncInterval = 30000; // 30 seconds

    // Authentication state
    this.isAuthenticated = false;
    this.checkAuthentication();
  }

  // Check if user is authenticated
  checkAuthentication() {
    // Use the same auth check as your auth.js system
    const token = localStorage.getItem("access_token");
    const userData = localStorage.getItem("user_data");

    if (token && userData) {
      this.isAuthenticated = true;
      this.currentUser = JSON.parse(userData);
      console.log("✅ User is authenticated:", this.currentUser.full_name);
    } else {
      this.isAuthenticated = false;
      console.warn("⚠️ No authentication token found - Please login first");
      this.showAuthWarning();
    }
  }

  // Show authentication warning
  showAuthWarning() {
    const warningEl = document.getElementById("authWarning");
    if (warningEl) {
      warningEl.style.display = "block";
    }
  }

  // Initialize the map
  init() {
    this.map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      minZoom: 10,
      maxZoom: 19,
    }).setView(this.defaultLocation, 15);

    // Add street view tiles
    this.addStreetLayer();

    // Start getting user location
    this.getUserLocationWithRetry();
  }

  // Add minimal OpenStreetMap street layer
  addStreetLayer() {
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        attribution: "",
      },
    ).addTo(this.map);
  }

  // Get user's current location with retry logic
  getUserLocationWithRetry() {
    this.showLoading(true);

    if (!("geolocation" in navigator)) {
      this.handleLocationError("Geolocation is not supported by your browser.");
      return;
    }

    console.log("🎯 Acquiring GPS location...");

    const maxAttempts = 3;
    let currentAttempt = 0;

    const tryGetLocation = () => {
      currentAttempt++;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy;

          console.log(
            `📍 Attempt ${currentAttempt}/${maxAttempts}: Accuracy ±${accuracy.toFixed(2)}m`,
          );

          if (accuracy < this.bestAccuracy) {
            this.bestAccuracy = accuracy;
            this.bestPosition = position;
          }

          if (accuracy < 20 || currentAttempt >= maxAttempts) {
            this.handleLocationSuccess(this.bestPosition);
          } else {
            setTimeout(tryGetLocation, 1000);
          }
        },
        (error) => {
          if (currentAttempt >= maxAttempts) {
            this.handleLocationError(this.getErrorMessage(error));
          } else {
            setTimeout(tryGetLocation, 1000);
          }
        },
        this.geoOptions,
      );
    };

    tryGetLocation();
  }

  // Handle successful location retrieval
  handleLocationSuccess(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    console.log(
      `📍 Location acquired: ${userLat.toFixed(6)}, ${userLng.toFixed(6)} (±${accuracy.toFixed(2)}m)`,
    );

    this.showLoading(false);

    // Store user position
    this.userPosition = { lat: userLat, lng: userLng, accuracy: accuracy };

    // Add user location marker
    this.addUserLocationMarker([userLat, userLng], accuracy);

    // Center map on user's location
    this.map.setView([userLat, userLng], 16);

    // Get street name
    this.reverseGeocode(userLat, userLng);

    // Send initial location to backend so rider can find customer
    if (this.isAuthenticated) {
      this.syncLocationToBackend(userLat, userLng, accuracy);
    }

    // Only fetch riders if authenticated
    if (this.isAuthenticated) {
      console.log("📍 Customer view - fetching nearby riders");
      this.fetchAvailableRiders();

      // Auto-refresh riders every 10 seconds
      this.fetchRidersInterval = setInterval(() => {
        this.fetchAvailableRiders();
      }, 10000);
    } else {
      console.warn("⚠️ Skipping backend operations - not authenticated");
      this.updateRiderCount(0);
    }

    // Start watching position (for display only, not sending to backend)
    this.startWatchingPosition();
  }

  // Handle location errors
  handleLocationError(errorMsg) {
    this.showLoading(false);
    console.error("Location error:", errorMsg);

    this.userPosition = {
      lat: this.defaultLocation[0],
      lng: this.defaultLocation[1],
      accuracy: 1000,
    };

    this.addUserLocationMarker(this.defaultLocation, 1000);
    this.map.setView(this.defaultLocation, 15);
  }

  // Get readable error message
  getErrorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission denied";
      case error.POSITION_UNAVAILABLE:
        return "Location unavailable";
      case error.TIMEOUT:
        return "Location request timed out";
      default:
        return "Unknown location error";
    }
  }

  // Fetch available riders
  async fetchAvailableRiders() {
    if (!this.userPosition || !this.isAuthenticated) {
      this.updateRiderCount(0);
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const { lat, lng } = this.userPosition;

      const response = await fetch(
        `${API_BASE_URL}/api/locations/riders/available?lat=${lat}&lng=${lng}&radius=10&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found ${data.count} riders`);

        if (data.riders && data.riders.length > 0) {
          this.displayRidersOnMap(data.riders);
          this.updateRiderCount(data.count);
        } else {
          this.clearRiderMarkers();
          this.updateRiderCount(0);
        }
      } else {
        if (response.status === 401) {
          this.isAuthenticated = false;
          this.showAuthWarning();
        }
        this.clearRiderMarkers();
        this.updateRiderCount(0);
      }
    } catch (error) {
      console.error("❌ Fetch riders error:", error);
      this.clearRiderMarkers();
      this.updateRiderCount(0);
    }
  }

  // Display riders on map
  displayRidersOnMap(riders) {
    this.clearRiderMarkers();

    riders.forEach((rider) => {
      if (rider.latitude && rider.longitude) {
        this.addRiderMarker(rider);
      }
    });

    console.log(`📍 Displayed ${riders.length} riders on map`);
  }

  // Add rider marker
  addRiderMarker(rider) {
    const riderIcon = L.divIcon({
      className: "custom-rider-marker",
      html: `
          <div class="rider-marker">
            <i class="fa-solid fa-motorcycle"></i>
            <span class="rider-distance">${rider.distance_km ? rider.distance_km.toFixed(1) + "km" : ""}</span>
          </div>
        `,
      iconSize: [80, 40],
      iconAnchor: [40, 20],
    });

    const marker = L.marker([rider.latitude, rider.longitude], {
      icon: riderIcon,
    }).addTo(this.map);

    const popupContent = `
        <div style="text-align: center; min-width: 150px;">
          <strong>${rider.full_name}</strong><br>
          <span style="font-size: 12px; color: #666;">
            ${rider.vehicle_type} - ${rider.license_plate}
          </span><br>
          <span style="font-size: 12px;">
            ⭐ ${rider.rating ? rider.rating.toFixed(1) : "N/A"} 
            (${rider.total_tasks_completed} rides)
          </span><br>
          <span style="font-size: 11px; color: ${rider.availability_status === "available" ? "green" : "orange"};">
            ${rider.availability_status.toUpperCase()}
          </span>
        </div>
      `;

    marker.bindPopup(popupContent);
    this.riderMarkers.push(marker);
  }

  // Clear all rider markers
  clearRiderMarkers() {
    this.riderMarkers.forEach((marker) => this.map.removeLayer(marker));
    this.riderMarkers = [];
  }

  // Update rider count
  updateRiderCount(count) {
    const countEl = document.getElementById("availableRidersCount");
    if (countEl) countEl.textContent = count;
  }

  // Add user location marker with icon
  addUserLocationMarker(latlng, accuracy = 50) {
    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: `
          <div class="user-location-marker">
            <i class="fa-solid fa-user"></i>
          </div>
        `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (this.userLocationMarker) {
      this.userLocationMarker.setLatLng(latlng);
    } else {
      this.userLocationMarker = L.marker(latlng, { icon: userIcon }).addTo(
        this.map,
      );
    }

    if (this.accuracyCircle) {
      this.map.removeLayer(this.accuracyCircle);
    }

    this.accuracyCircle = L.circle(latlng, {
      radius: accuracy,
      color: "#000000",
      fillColor: "#000000",
      fillOpacity: 0.05,
      weight: 1,
    }).addTo(this.map);
  }

  // Watch position continuously (for display only - no backend updates)
  startWatchingPosition() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        this.userPosition = { lat: userLat, lng: userLng, accuracy: accuracy };

        if (this.userLocationMarker) {
          this.userLocationMarker.setLatLng([userLat, userLng]);
        }

        if (this.accuracyCircle) {
          this.accuracyCircle.setLatLng([userLat, userLng]);
          this.accuracyCircle.setRadius(accuracy);
        }

        // Sync customer location to backend (throttled)
        if (this.isAuthenticated) {
          this.syncLocationToBackend(userLat, userLng, accuracy);
        }
      },
      (error) => {
        console.warn("⚠️ Watch position error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  }

  // Send customer's current GPS to backend so riders can find them
  async syncLocationToBackend(lat, lng, accuracy) {
    const now = Date.now();
    if (now - this.lastLocationSyncTime < this.locationSyncInterval) return;
    this.lastLocationSyncTime = now;

    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/locations/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          accuracy: Math.round(accuracy || 0),
        }),
      });

      if (res.ok) {
        console.log("✅ Customer location synced to backend");
      } else {
        console.warn("⚠️ Failed to sync customer location:", res.status);
      }
    } catch (err) {
      console.warn("⚠️ Location sync error:", err.message);
    }
  }

  // Stop watching position
  stopWatchingPosition() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.fetchRidersInterval) {
      clearInterval(this.fetchRidersInterval);
      this.fetchRidersInterval = null;
    }
  }

  // Reverse geocode
  reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    fetch(url, {
      headers: { "User-Agent": "PasugoApp/1.0" },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.address) {
          const name =
            data.address.road ||
            data.address.suburb ||
            data.address.city ||
            "Your Location";

          const locationEl = document.getElementById("locationName");
          if (locationEl) locationEl.textContent = name;
        }
      })
      .catch((error) => console.warn("Geocoding error:", error));
  }

  // Toggle map layer
  toggleMapLayer() {
    this.map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        this.map.removeLayer(layer);
      }
    });

    if (this.currentMapStyle === "street") {
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "" },
      ).addTo(this.map);
      this.currentMapStyle = "satellite";
    } else {
      this.addStreetLayer();
      this.currentMapStyle = "street";
    }
  }

  // Re-center on user
  recenterOnUser() {
    this.showLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        this.showLoading(false);
        this.userPosition = { lat: userLat, lng: userLng, accuracy: accuracy };
        this.addUserLocationMarker([userLat, userLng], accuracy);

        this.map.flyTo([userLat, userLng], 16, { duration: 1.5 });

        if (this.isAuthenticated) {
          this.fetchAvailableRiders();
        }
      },
      (error) => {
        this.showLoading(false);
      },
      this.geoOptions,
    );
  }

  // Show/hide loading
  showLoading(show) {
    const loadingEl = document.getElementById("locationLoading");
    if (loadingEl) {
      show
        ? loadingEl.classList.add("active")
        : loadingEl.classList.remove("active");
    }
  }

  // Cleanup
  destroy() {
    this.stopWatchingPosition();
    this.clearRiderMarkers();
    if (this.map) this.map.remove();
  }
}

// Initialize
let pasugoMap;

document.addEventListener("DOMContentLoaded", function () {
  pasugoMap = new PasugoMap();
  pasugoMap.init();
  setupEventListeners();
});

// Event listeners
function setupEventListeners() {
  const layerBtn = document.getElementById("layerBtn");
  if (layerBtn) {
    layerBtn.addEventListener("click", () => pasugoMap.toggleMapLayer());
  }

  const locateBtn = document.getElementById("locateBtn");
  if (locateBtn) {
    locateBtn.addEventListener("click", () => pasugoMap.recenterOnUser());
  }

  const refreshBtn = document.getElementById("refreshRiders");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (pasugoMap.isAuthenticated) {
        pasugoMap.fetchAvailableRiders();
      } else {
        alert("Please login first");
      }
    });
  }

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      window.location.href = "login.html"; // Same directory as dashboard
    });
  }
}

// Cleanup
window.addEventListener("beforeunload", () => {
  if (pasugoMap) pasugoMap.destroy();
});
