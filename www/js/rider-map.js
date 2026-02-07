// rider-map.js - Rider Location Tracking and Updates
// Handles rider location updates to backend for customer visibility

const API_BASE_URL = "https://pasugo.onrender.com";

class RiderLocationTracker {
  constructor() {
    this.watchId = null;
    this.updateInterval = null;
    this.currentPosition = null;

    // High accuracy geolocation options
    this.geoOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    };
  }

  // Initialize rider location tracking
  init() {
    console.log("🏍️ Starting rider location tracking...");

    // Check if user is authenticated using the same system as auth.js
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No auth token found. Rider must be logged in.");
      alert("Please login first to enable location tracking");
      return;
    }

    // Start tracking location
    this.startLocationTracking();

    // Update location every 5 seconds
    this.updateInterval = setInterval(() => {
      if (this.currentPosition) {
        this.updateLocationToBackend();
      }
    }, 5000);
  }

  // Start watching rider's location
  startLocationTracking() {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log(
          `📍 Rider location: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${accuracy.toFixed(2)}m)`,
        );

        this.currentPosition = {
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
        };

        // Update immediately on first position
        if (!this.updateInterval) {
          this.updateLocationToBackend();
        }
      },
      (error) => {
        console.error("Location error:", this.getErrorMessage(error));
      },
      this.geoOptions,
    );
  }

  // Update location to backend
  async updateLocationToBackend() {
    if (!this.currentPosition) {
      console.warn("No position available to update");
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No auth token found");
        this.showDebugError("No auth token found");
        return;
      }

      const payload = {
        latitude: parseFloat(this.currentPosition.latitude),
        longitude: parseFloat(this.currentPosition.longitude),
        accuracy: Math.round(this.currentPosition.accuracy),
      };

      console.log("📤 Sending location update:", payload);

      const response = await fetch(`${API_BASE_URL}/api/locations/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Rider location updated to backend:", data);
        this.showLocationStatus("online");
        this.clearDebugError();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "Failed to update rider location:",
          response.status,
          errorData,
        );

        // Show error on screen for mobile debugging
        this.showDebugError(
          `Error ${response.status}: ${JSON.stringify(errorData)}`,
        );
        this.showLocationStatus("error");
      }
    } catch (error) {
      console.error("Error updating rider location:", error);
      this.showDebugError(`Exception: ${error.message}`);
      this.showLocationStatus("error");
    }
  }

  // Show debug error on screen (for mobile debugging)
  showDebugError(message) {
    let debugDiv = document.getElementById("debugError");
    if (!debugDiv) {
      debugDiv = document.createElement("div");
      debugDiv.id = "debugError";
      debugDiv.style.cssText = `
        position: fixed;
        top: 80px;
        left: 10px;
        right: 10px;
        background: #dc3545;
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-size: 12px;
        z-index: 9999;
        word-wrap: break-word;
        max-height: 200px;
        overflow-y: auto;
      `;
      document.body.appendChild(debugDiv);
    }
    debugDiv.innerHTML = `<strong>DEBUG:</strong><br>${message}`;
  }

  // Clear debug error
  clearDebugError() {
    const debugDiv = document.getElementById("debugError");
    if (debugDiv) {
      debugDiv.remove();
    }
  }

  // Show location status indicator
  showLocationStatus(status) {
    const statusEl = document.getElementById("locationStatus");
    if (statusEl) {
      if (status === "online") {
        statusEl.innerHTML =
          '<i class="fa-solid fa-circle" style="color: #28a745;"></i> Location Active';
        statusEl.style.color = "#28a745";
      } else if (status === "error") {
        statusEl.innerHTML =
          '<i class="fa-solid fa-circle" style="color: #dc3545;"></i> Location Error';
        statusEl.style.color = "#dc3545";
      }
    }
  }

  // Get readable error message
  getErrorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission denied. Please enable location access.";
      case error.POSITION_UNAVAILABLE:
        return "Location information is unavailable.";
      case error.TIMEOUT:
        return "Location request timed out.";
      default:
        return "An unknown error occurred.";
    }
  }

  // Stop tracking
  stop() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    console.log("🛑 Rider location tracking stopped");
  }
}

// Auto-initialize when page loads
let riderTracker;

document.addEventListener("DOMContentLoaded", function () {
  riderTracker = new RiderLocationTracker();
  riderTracker.init();
});

// Cleanup on page unload
window.addEventListener("beforeunload", function () {
  if (riderTracker) {
    riderTracker.stop();
  }
});
