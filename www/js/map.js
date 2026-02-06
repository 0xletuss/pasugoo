// map.js - Pasugo Map Controller
// Handles all map interactions, geolocation, and marker management

class PasugoMap {
  constructor() {
    this.map = null;
    this.carMarker = null;
    this.destinationMarker = null;
    this.userLocationMarker = null;
    this.currentMapStyle = "street";
    this.watchId = null;
    this.animationInterval = null;

    // Default fallback location (Manila, Philippines)
    this.defaultLocation = [14.5995, 120.9842];

    // Enhanced high accuracy geolocation options
    this.geoOptions = {
      enableHighAccuracy: true,
      timeout: 30000, // Increased timeout for better GPS lock
      maximumAge: 0, // Always get fresh position, never use cache
    };

    // Track location attempts for better accuracy
    this.locationAttempts = 0;
    this.bestAccuracy = Infinity;
    this.bestPosition = null;
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

    // Start getting user location immediately with multiple attempts
    this.getUserLocationWithRetry();
  }

  // Add OpenStreetMap street layer
  addStreetLayer() {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(this.map);
  }

  // Get user's current location with retry logic for better accuracy
  getUserLocationWithRetry() {
    this.showLoading(true);

    if (!("geolocation" in navigator)) {
      this.handleLocationError("Geolocation is not supported by your browser.");
      return;
    }

    console.log("🎯 Acquiring high-accuracy GPS location...");

    // Try multiple times to get the best accuracy
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

          // Keep track of the most accurate position
          if (accuracy < this.bestAccuracy) {
            this.bestAccuracy = accuracy;
            this.bestPosition = position;
          }

          // If we got very accurate position (< 20m) or reached max attempts, use it
          if (accuracy < 20 || currentAttempt >= maxAttempts) {
            this.handleLocationSuccess(this.bestPosition);
          } else {
            // Try again for better accuracy
            setTimeout(tryGetLocation, 1000);
          }
        },
        (error) => {
          if (currentAttempt >= maxAttempts) {
            this.handleLocationError(this.getErrorMessage(error));
          } else {
            // Try again on error
            setTimeout(tryGetLocation, 1000);
          }
        },
        this.geoOptions,
      );
    };

    tryGetLocation();
  }

  // Get user's current location with high accuracy
  getUserLocation() {
    this.showLoading(true);

    if (!("geolocation" in navigator)) {
      this.handleLocationError("Geolocation is not supported by your browser.");
      return;
    }

    // Get current position with high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationSuccess(position),
      (error) => this.handleLocationError(this.getErrorMessage(error)),
      this.geoOptions,
    );
  }

  // Handle successful location retrieval
  handleLocationSuccess(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;
    const speed = position.coords.speed;

    console.log(`📍 Location acquired:`);
    console.log(`   Latitude: ${userLat}`);
    console.log(`   Longitude: ${userLng}`);
    console.log(`   Accuracy: ±${accuracy.toFixed(2)} meters`);
    if (heading !== null) console.log(`   Heading: ${heading}°`);
    if (speed !== null) console.log(`   Speed: ${speed.toFixed(2)} m/s`);
    console.log(
      `   Timestamp: ${new Date(position.timestamp).toLocaleString()}`,
    );

    this.showLoading(false);

    // Add user location marker
    this.addUserLocationMarker([userLat, userLng], accuracy);

    // Center map on user's location with higher zoom for accuracy
    this.map.setView([userLat, userLng], 17);

    // Add car marker near user (simulate nearby driver)
    const carOffset = 0.0015; // ~150-200 meters
    this.addCarMarker([userLat - carOffset, userLng - carOffset]);

    // Add destination marker (simulate destination)
    const destOffset = 0.004; // ~400-500 meters
    this.addDestinationMarker([userLat + destOffset, userLng + destOffset]);

    // Get street name from coordinates
    this.reverseGeocode(userLat, userLng);

    // Start watching position for continuous updates
    this.startWatchingPosition();

    // Calculate and display actual distance
    this.updateDistanceAndETA();
  }

  // Handle location errors
  handleLocationError(errorMsg) {
    this.showLoading(false);
    console.error("Location error:", errorMsg);

    alert(
      `Unable to get your location:\n${errorMsg}\n\nUsing default location (Manila).`,
    );

    // Use default location
    this.addUserLocationMarker(this.defaultLocation, 1000);
    this.map.setView(this.defaultLocation, 15);

    const carOffset = 0.002;
    this.addCarMarker([
      this.defaultLocation[0] - carOffset,
      this.defaultLocation[1] - carOffset,
    ]);

    this.addDestinationMarker([
      this.defaultLocation[0] + 0.005,
      this.defaultLocation[1] + 0.005,
    ]);
  }

  // Get readable error message
  getErrorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission denied. Please enable location access in your browser settings.";
      case error.POSITION_UNAVAILABLE:
        return "Location information is unavailable. Please check your device's location settings.";
      case error.TIMEOUT:
        return "Location request timed out. Please try again.";
      default:
        return "An unknown error occurred while getting your location.";
    }
  }

  // Add user location marker with accuracy circle
  addUserLocationMarker(latlng, accuracy = 50) {
    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: `
        <div style="position: relative;">
          <div class="user-location-ring"></div>
          <div class="user-location-marker"></div>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });

    if (this.userLocationMarker) {
      this.userLocationMarker.setLatLng(latlng);
    } else {
      this.userLocationMarker = L.marker(latlng, { icon: userIcon }).addTo(
        this.map,
      );
    }

    // Add accuracy circle
    if (this.accuracyCircle) {
      this.map.removeLayer(this.accuracyCircle);
    }

    this.accuracyCircle = L.circle(latlng, {
      radius: accuracy,
      color: "#4285F4",
      fillColor: "#4285F4",
      fillOpacity: 0.1,
      weight: 1,
    }).addTo(this.map);

    // Show accuracy in console
    console.log(
      `🎯 Displaying position with ±${accuracy.toFixed(2)}m accuracy`,
    );
  }

  // Watch position continuously with high accuracy
  startWatchingPosition() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    let lastAccuracy = Infinity;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Only update if we got better or similar accuracy
        if (accuracy <= lastAccuracy * 1.5) {
          console.log(
            `🔄 Location updated: ${userLat.toFixed(6)}, ${userLng.toFixed(6)} (±${accuracy.toFixed(2)}m)`,
          );

          // Update user location marker
          if (this.userLocationMarker) {
            this.userLocationMarker.setLatLng([userLat, userLng]);
          }

          // Update accuracy circle
          if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng([userLat, userLng]);
            this.accuracyCircle.setRadius(accuracy);
          }

          // Recalculate distances
          this.updateDistanceAndETA();

          lastAccuracy = accuracy;
        } else {
          console.log(
            `⚠️ Ignoring less accurate position (±${accuracy.toFixed(2)}m vs ±${lastAccuracy.toFixed(2)}m)`,
          );
        }
      },
      (error) => {
        console.warn("Watch position error:", this.getErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0, // Never use cached position
        timeout: 10000,
      },
    );
  }

  // Stop watching position
  stopWatchingPosition() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Reverse geocode to get street name
  reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    fetch(url, {
      headers: {
        "User-Agent": "PasugoApp/1.0",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.address) {
          const name =
            data.address.road ||
            data.address.suburb ||
            data.address.neighbourhood ||
            data.address.city ||
            "Your Location";

          const locationEl = document.getElementById("locationName");
          if (locationEl) {
            locationEl.textContent = name;
          }

          console.log(`📍 Location name: ${name}`);
        }
      })
      .catch((error) => {
        console.warn("Geocoding error:", error);
      });
  }

  // Add car marker
  addCarMarker(latlng) {
    const carIcon = L.divIcon({
      className: "custom-car-marker",
      html: `
        <div class="car-marker">
          <i class="fa-solid fa-car-side" style="color: #000"></i>
          <span id="carETA">5 min</span>
        </div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 20],
    });

    if (this.carMarker) {
      this.carMarker.setLatLng(latlng);
    } else {
      this.carMarker = L.marker(latlng, { icon: carIcon }).addTo(this.map);
    }

    // Start car animation
    this.animateCarMovement();
  }

  // Add destination marker
  addDestinationMarker(latlng) {
    const destIcon = L.divIcon({
      className: "custom-dest-marker",
      html: `
        <div style="position: relative;">
          <div class="pulse-ring"></div>
          <div class="destination-marker">
            <i class="fa-solid fa-location-dot" style="color: #000; font-size: 20px;"></i>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (this.destinationMarker) {
      this.destinationMarker.setLatLng(latlng);
    } else {
      this.destinationMarker = L.marker(latlng, { icon: destIcon }).addTo(
        this.map,
      );
    }
  }

  // Calculate real distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // in meters
  }

  // Update distance and ETA based on real positions
  updateDistanceAndETA() {
    if (!this.carMarker || !this.destinationMarker) return;

    const carPos = this.carMarker.getLatLng();
    const destPos = this.destinationMarker.getLatLng();

    // Calculate real distance
    const distanceMeters = this.calculateDistance(
      carPos.lat,
      carPos.lng,
      destPos.lat,
      destPos.lng,
    );

    // Update distance text
    const distanceEl = document.getElementById("distanceText");
    if (distanceEl) {
      if (distanceMeters < 1000) {
        distanceEl.textContent = `${Math.round(distanceMeters)}m away`;
      } else {
        distanceEl.textContent = `${(distanceMeters / 1000).toFixed(1)}km away`;
      }
    }

    // Calculate ETA (assuming 30 km/h average speed in city)
    const speedKmh = 30;
    const speedMs = (speedKmh * 1000) / 3600;
    const etaSeconds = distanceMeters / speedMs;
    const etaMinutes = Math.max(1, Math.ceil(etaSeconds / 60));

    const etaEl = document.getElementById("etaText");
    if (etaEl) {
      etaEl.textContent = etaMinutes;
    }
  }

  // Animate car movement toward destination
  animateCarMovement() {
    // Clear any existing animation
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }

    let step = 0;
    const totalSteps = 150; // Slower, smoother animation
    const currentPos = this.carMarker.getLatLng();
    const targetPos = this.destinationMarker.getLatLng();

    const latStep = (targetPos.lat - currentPos.lat) / totalSteps;
    const lngStep = (targetPos.lng - currentPos.lng) / totalSteps;

    this.animationInterval = setInterval(() => {
      if (step >= totalSteps) {
        clearInterval(this.animationInterval);
        return;
      }

      const newLat = currentPos.lat + latStep * step;
      const newLng = currentPos.lng + lngStep * step;
      this.carMarker.setLatLng([newLat, newLng]);

      // Update distance and ETA
      this.updateDistanceAndETA();

      step++;
    }, 150); // Move every 150ms for smoother animation
  }

  // Toggle map layer (street/satellite)
  toggleMapLayer() {
    // Remove all tile layers
    this.map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        this.map.removeLayer(layer);
      }
    });

    // Toggle between styles
    if (this.currentMapStyle === "street") {
      // Satellite view
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
        },
      ).addTo(this.map);
      this.currentMapStyle = "satellite";
    } else {
      // Street view
      this.addStreetLayer();
      this.currentMapStyle = "street";
    }
  }

  // Re-center map on user location
  recenterOnUser() {
    this.showLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        this.showLoading(false);

        // Update user marker
        this.addUserLocationMarker([userLat, userLng], accuracy);

        // Smoothly pan to user location
        this.map.flyTo([userLat, userLng], 17, {
          duration: 1.5,
        });

        console.log(
          `🎯 Re-centered on: ${userLat.toFixed(6)}, ${userLng.toFixed(6)} (±${accuracy.toFixed(2)}m)`,
        );
      },
      (error) => {
        this.showLoading(false);
        alert(`Unable to get location: ${this.getErrorMessage(error)}`);
      },
      this.geoOptions,
    );
  }

  // Show/hide loading indicator
  showLoading(show) {
    const loadingEl = document.getElementById("locationLoading");
    if (loadingEl) {
      if (show) {
        loadingEl.classList.add("active");
      } else {
        loadingEl.classList.remove("active");
      }
    }
  }

  // Cleanup
  destroy() {
    this.stopWatchingPosition();
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
    if (this.map) {
      this.map.remove();
    }
  }
}

// Initialize map when DOM is ready
let pasugoMap;

document.addEventListener("DOMContentLoaded", function () {
  // Initialize the map
  pasugoMap = new PasugoMap();
  pasugoMap.init();

  // Setup UI event listeners
  setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
  // Layer toggle button
  const layerBtn = document.getElementById("layerBtn");
  if (layerBtn) {
    layerBtn.addEventListener("click", function () {
      pasugoMap.toggleMapLayer();
    });
  }

  // Locate button
  const locateBtn = document.getElementById("locateBtn");
  if (locateBtn) {
    locateBtn.addEventListener("click", function () {
      this.style.color = "#ffc107";
      pasugoMap.recenterOnUser();

      setTimeout(() => {
        this.style.color = "#000";
      }, 1000);
    });
  }

  // Search pill
  const searchPill = document.querySelector(".search-pill");
  if (searchPill) {
    searchPill.addEventListener("click", function () {
      alert("Open Search Overlay");
    });
  }

  // FAB button
  const navFab = document.querySelector(".nav-fab");
  if (navFab) {
    navFab.addEventListener("click", function () {
      alert("Open 'Create Request' Page");
    });
  }
}

// Cleanup on page unload
window.addEventListener("beforeunload", function () {
  if (pasugoMap) {
    pasugoMap.destroy();
  }
});
