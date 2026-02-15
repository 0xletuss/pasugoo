// map-rider.js - Rider Map Controller with Location Tracking
// Handles map display and rider location updates

class RiderMapController {
  constructor() {
    this.map = null;
    this.riderMarker = null;
    this.accuracyCircle = null;
    this.currentPosition = null;
    this.watchId = null;
    this.isTracking = false;
    this.deliveryMarker = null;

    // High accuracy geolocation options
    this.geoOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    };

    console.log("🗺️ RiderMapController initialized");
  }

  // Initialize the map
  init() {
    console.log("🚀 Initializing rider map...");

    // Check if Leaflet is loaded
    if (typeof L === "undefined") {
      console.error("❌ Leaflet library not loaded!");
      this.showError("Map library failed to load");
      return false;
    }

    // Check if map container exists
    const mapContainer = document.getElementById("riderMap");
    if (!mapContainer) {
      console.error("❌ Map container 'riderMap' not found!");
      return false;
    }

    try {
      // Default center (Manila, Philippines)
      const defaultCenter = [14.5995, 120.9842];
      const defaultZoom = 13;

      // Create the map
      this.map = L.map("riderMap", {
        zoomControl: false, // We'll add custom controls
        attributionControl: true,
      }).setView(defaultCenter, defaultZoom);

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);

      console.log("✅ Map created successfully");

      // Setup map controls
      this.setupControls();

      // Start location tracking
      this.startLocationTracking();

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          console.log("🗺️ Map size invalidated");
        }
      }, 500);

      return true;
    } catch (error) {
      console.error("❌ Error initializing map:", error);
      this.showError("Failed to initialize map: " + error.message);
      return false;
    }
  }

  // Setup custom map controls
  setupControls() {
    // Recenter button
    const recenterBtn = document.getElementById("recenterBtn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => {
        if (this.currentPosition) {
          console.log(
            "🎯 Recentering to current position:",
            this.currentPosition,
          );
          this.map.setView(this.currentPosition, 16, {
            animate: true,
            duration: 0.5,
          });
        } else {
          // Try to get current location
          console.log("📍 Trying to get current location...");
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                this.currentPosition = [lat, lng];
                console.log("✅ Got location:", this.currentPosition);
                this.map.setView(this.currentPosition, 16, {
                  animate: true,
                  duration: 0.5,
                });
                this.updateRiderMarker(lat, lng);
              },
              (error) => {
                console.error("❌ Location error:", error);
                alert(
                  "Unable to get your location. Please enable location services.",
                );
              },
              { enableHighAccuracy: true, timeout: 10000 },
            );
          } else {
            alert("Location services not available.");
          }
        }
      });
    }

    // Map layer toggle button
    const toggleLayerBtn = document.getElementById("toggleMapLayerBtn");
    if (toggleLayerBtn) {
      let isStreetView = true;
      toggleLayerBtn.addEventListener("click", () => {
        // Toggle between street and satellite view
        if (isStreetView) {
          // Switch to satellite
          this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
              this.map.removeLayer(layer);
            }
          });
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              attribution: "Tiles &copy; Esri",
              maxZoom: 19,
            },
          ).addTo(this.map);
          isStreetView = false;
        } else {
          // Switch back to street
          this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
              this.map.removeLayer(layer);
            }
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(this.map);
          isStreetView = true;
        }
      });
    }

    console.log("✅ Map controls setup complete");
  }

  // Start tracking rider's location
  startLocationTracking() {
    console.log("📍 Starting location tracking...");

    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      this.updateLocationStatus("error", "Geolocation not supported");
      return;
    }

    // Show loading
    const loadingOverlay = document.getElementById("locationLoading");
    if (loadingOverlay) {
      loadingOverlay.classList.add("active");
    }

    this.isTracking = true;

    // Watch position with high accuracy
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log(
          `📍 Location update: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${accuracy.toFixed(2)}m)`,
        );

        // Update current position
        this.currentPosition = [lat, lng];

        // Center map on first position (before creating marker)
        const isFirstPosition = !this.riderMarker;

        // Update or create marker
        this.updateRiderMarker(lat, lng, accuracy);

        // Center map on first position
        if (isFirstPosition) {
          this.map.setView([lat, lng], 16, {
            animate: true,
            duration: 0.5,
          });
          console.log("🎯 Centering map on rider location");
        }

        // Update status
        this.updateLocationStatus(
          "active",
          `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        );

        // Hide loading overlay
        if (loadingOverlay) {
          loadingOverlay.classList.remove("active");
        }
      },
      (error) => {
        console.error("❌ Location error:", error);
        this.handleLocationError(error);

        // Hide loading overlay
        if (loadingOverlay) {
          loadingOverlay.classList.remove("active");
        }
      },
      this.geoOptions,
    );
  }

  // Update or create rider marker on map
  updateRiderMarker(lat, lng, accuracy) {
    if (!this.map) return;

    // Create custom icon for rider (without accuracy circle - we'll use L.circle for that)
    const riderIcon = L.divIcon({
      className: "custom-rider-marker",
      html: `
        <div style="
          background: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 4px solid #ffc107;
          box-shadow: 0 4px 12px rgba(255, 193, 7, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <i class="fa-solid fa-motorcycle" style="color: #ffc107; font-size: 20px;"></i>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Update or create accuracy circle (uses meters, scales correctly with zoom)
    if (accuracy && accuracy > 0) {
      if (this.accuracyCircle) {
        this.accuracyCircle.setLatLng([lat, lng]);
        this.accuracyCircle.setRadius(accuracy);
      } else {
        this.accuracyCircle = L.circle([lat, lng], {
          radius: accuracy, // in meters
          color: "rgba(255, 193, 7, 0.5)",
          fillColor: "rgba(255, 193, 7, 0.15)",
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(this.map);
      }
    }

    if (this.riderMarker) {
      // Update existing marker
      this.riderMarker.setLatLng([lat, lng]);
      this.riderMarker.setIcon(riderIcon);
    } else {
      // Create new marker
      this.riderMarker = L.marker([lat, lng], {
        icon: riderIcon,
        zIndexOffset: 1000, // Keep marker above accuracy circle
      })
        .addTo(this.map)
        .bindPopup(
          `
        <div style="text-align: center; padding: 5px;">
          <strong>Your Location</strong><br>
          <small>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}</small>
        </div>
      `,
        );
    }
  }

  // Update location status display
  updateLocationStatus(status, message) {
    const statusEl = document.getElementById("locationStatus");
    if (!statusEl) return;

    if (status === "active") {
      statusEl.innerHTML = `<i class="fa-solid fa-check-circle" style="color: #28a745;"></i> ${message}`;
      statusEl.style.color = "#28a745";
    } else if (status === "error") {
      statusEl.innerHTML = `<i class="fa-solid fa-exclamation-triangle" style="color: #dc3545;"></i> ${message}`;
      statusEl.style.color = "#dc3545";
    } else {
      statusEl.textContent = message;
    }
  }

  // Handle location errors
  handleLocationError(error) {
    let message;
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = "Location permission denied";
        alert("Please enable location permissions to use the rider dashboard.");
        break;
      case error.POSITION_UNAVAILABLE:
        message = "Location unavailable";
        break;
      case error.TIMEOUT:
        message = "Location request timed out";
        break;
      default:
        message = "Unknown location error";
    }

    this.updateLocationStatus("error", message);
    this.showError(message);
  }

  // Show error message
  showError(message) {
    console.error("Map Error:", message);
    // Could add a toast notification here
  }

  // Stop location tracking
  stop() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      console.log("🛑 Location tracking stopped");
    }
  }

  // Add a customer marker (for when rider accepts a request)
  addCustomerMarker(lat, lng, customerName) {
    const customerIcon = L.divIcon({
      className: "custom-customer-marker",
      html: `
        <div style="
          background: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid #4285f4;
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <i class="fa-solid fa-user" style="color: #4285f4; font-size: 18px;"></i>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([lat, lng], {
      icon: customerIcon,
    })
      .addTo(this.map)
      .bindPopup(
        `
      <div style="text-align: center; padding: 5px;">
        <strong>${customerName || "Customer"}</strong><br>
        <small>Pick-up Location</small>
      </div>
    `,
      );

    return marker;
  }

  // Focus the map on a delivery address using geocoding
  async focusOnDeliveryAddress(address, customerName) {
    if (!this.map || !address) return;

    try {
      const encoded = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error("Geocoding request failed");
      }

      const results = await res.json();
      if (!results || results.length === 0) {
        throw new Error("Address not found");
      }

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);

      const deliveryIcon = L.divIcon({
        className: "custom-delivery-marker",
        html: `
          <div style="
            background: #28a745;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <i class="fa-solid fa-house" style="color: #ffffff; font-size: 16px;"></i>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      if (this.deliveryMarker) {
        this.deliveryMarker.setLatLng([lat, lng]);
      } else {
        this.deliveryMarker = L.marker([lat, lng], {
          icon: deliveryIcon,
        })
          .addTo(this.map)
          .bindPopup(
            `
          <div style="text-align: center; padding: 5px;">
            <strong>${customerName || "Customer"}</strong><br>
            <small>Delivery Address</small>
          </div>
        `,
          );
      }

      this.map.flyTo([lat, lng], 16, {
        animate: true,
        duration: 0.8,
      });
    } catch (error) {
      console.error("Map Error:", error);
    }
  }
}

// Auto-initialize when DOM is ready
let riderMapController = null;

document.addEventListener("DOMContentLoaded", () => {
  console.log("🗺️ DOM loaded - initializing rider map...");

  // Small delay to ensure Leaflet is fully loaded
  setTimeout(() => {
    riderMapController = new RiderMapController();
    const success = riderMapController.init();

    if (success) {
      console.log("✅ Rider map controller ready");
      // Make available globally
      window.riderMapController = riderMapController;
    } else {
      console.error("❌ Failed to initialize rider map controller");
    }
  }, 100);
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (riderMapController) {
    riderMapController.stop();
  }
});

console.log("✅ map-rider.js loaded");
