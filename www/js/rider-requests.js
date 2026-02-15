// rider-requests.js - Rider Request Notification Handler (UPDATED)
// Polls for incoming requests and handles accept/decline

class RiderRequestHandler {
  constructor() {
    this.pollInterval = null;
    this.currentRequests = [];
    this.isRunning = false;

    console.log("🔧 RiderRequestHandler constructor called");
  }

  // Initialize the handler
  async init() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔔 RIDER REQUEST HANDLER INITIALIZING");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Step 1: Check if pasugoAPI exists
    if (typeof pasugoAPI === "undefined") {
      console.error("❌ FATAL: pasugoAPI is not defined!");
      console.error(
        "❌ Make sure api_request.js is loaded BEFORE rider-requests.js",
      );
      return false;
    }
    console.log("✅ Step 1: pasugoAPI is available");

    // Step 2: Check authentication
    const token = localStorage.getItem("access_token");
    const userData = localStorage.getItem("user_data");

    console.log("🔍 Step 2: Checking authentication...");
    console.log("   - Token exists:", !!token);
    console.log("   - User data exists:", !!userData);

    if (!token || !userData) {
      console.error("❌ Not authenticated - missing token or user data");
      return false;
    }

    // Step 3: Parse and validate user
    let user;
    try {
      user = JSON.parse(userData);
      console.log("✅ Step 3: User data parsed:", {
        id: user.user_id || user.id,
        name: user.full_name,
        type: user.user_type,
        rawType: typeof user.user_type,
      });
    } catch (error) {
      console.error("❌ Failed to parse user data:", error);
      return false;
    }

    // Step 4: Verify user is a rider
    const userType = String(user.user_type).toLowerCase();
    const isRider = userType === "rider" || userType.includes("rider");

    console.log("🔍 Step 4: Checking user type...");
    console.log("   - Raw user_type:", user.user_type);
    console.log("   - Normalized:", userType);
    console.log("   - Is rider?:", isRider);

    if (!isRider) {
      console.warn("⚠️ User is not a rider (type: " + user.user_type + ")");
      console.warn("⚠️ Request handler will not start");
      return false;
    }
    console.log("✅ Step 4: User is confirmed as RIDER");

    // Step 5: Check if required API method exists
    if (typeof pasugoAPI.getPendingRequestsForMe !== "function") {
      console.error(
        "❌ FATAL: pasugoAPI.getPendingRequestsForMe is not a function!",
      );
      console.error(
        "Available methods:",
        Object.keys(pasugoAPI).filter(
          (k) => typeof pasugoAPI[k] === "function",
        ),
      );
      return false;
    }
    console.log("✅ Step 5: API method getPendingRequestsForMe exists");

    // Step 6: Test API call
    console.log("🧪 Step 6: Testing API connection...");
    try {
      const testResult = await pasugoAPI.getPendingRequestsForMe();
      console.log("✅ API test successful:", testResult);
    } catch (error) {
      console.error("❌ API test failed:", error);
      console.error("   The API might be down or unreachable");
    }

    // Step 7: Start polling
    console.log("🚀 Step 7: Starting request polling...");
    this.startPolling();
    this.isRunning = true;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ RIDER REQUEST HANDLER IS RUNNING");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return true;
  }

  // Start polling every 5 seconds
  startPolling() {
    // Clear any existing interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Poll immediately
    console.log("⏱️ Starting immediate poll...");
    this.checkForRequests();

    // Then poll every 5 seconds
    this.pollInterval = setInterval(() => {
      this.checkForRequests();
    }, 5000);

    console.log("✅ Polling interval set (5 seconds)");
  }

  // Check for pending requests
  async checkForRequests() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n🔍 [${timestamp}] Checking for requests...`);

    try {
      // Call API
      const result = await pasugoAPI.getPendingRequestsForMe();

      // Log raw response
      console.log("📥 API Response:", {
        success: result.success,
        message: result.message,
        dataLength: result.data?.length || 0,
      });

      // Check if call was successful
      if (!result.success) {
        console.warn("⚠️ API call failed:", result.message);
        this.showError(result.message);
        return;
      }

      // Extract requests
      const requests = result.data || [];
      console.log(`📋 Found ${requests.length} pending request(s)`);

      // Log each request
      if (requests.length > 0) {
        requests.forEach((req, index) => {
          console.log(
            `   ${index + 1}. ${req.service_type} - ${req.customer_name} (${req.time_remaining_seconds}s remaining)`,
          );
        });
      }

      // Check for new requests (notification)
      if (requests.length > this.currentRequests.length) {
        const newCount = requests.length - this.currentRequests.length;
        console.log(`🔔 NEW REQUEST ALERT! (+${newCount} new)`);
        this.playNotificationSound();
      }

      // Update state and UI
      this.currentRequests = requests;
      this.updateUI(requests);
    } catch (error) {
      console.error("❌ Error in checkForRequests:", error);
      this.showError("Failed to check for requests: " + error.message);
    }
  }

  // Update the UI
  updateUI(requests) {
    console.log("🎨 Updating UI with", requests.length, "requests");

    // Update the requests badge (on main map view)
    const requestsBadge = document.getElementById("requestsBadge");
    const requestCount = document.getElementById("requestCount");

    if (requestsBadge && requestCount) {
      if (requests.length > 0) {
        requestsBadge.style.display = "flex";
        requestCount.textContent = requests.length;
        console.log("   Badge updated:", requests.length);
      } else {
        requestsBadge.style.display = "none";
      }
    }

    // Update the modal container
    const container = document.getElementById("requestsContainer");

    // Check if container exists
    if (!container) {
      console.error("❌ Element 'requestsContainer' not found in DOM!");
      return;
    }

    // Show empty state
    if (requests.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <i class="fa-solid fa-inbox" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
          <p style="font-size: 14px; font-weight: 600;">No pending requests</p>
          <p style="font-size: 12px; margin-top: 5px;">You'll be notified when customers select you</p>
          <p style="font-size: 11px; margin-top: 10px; color: #28a745;">
            <i class="fa-solid fa-circle-check"></i> Polling active
          </p>
        </div>
      `;
      console.log("   Showing empty state");
      return;
    }

    // Render request cards
    console.log("   Rendering", requests.length, "card(s)");
    container.innerHTML = requests
      .map((req) => this.createRequestCard(req))
      .join("");

    // Attach event listeners
    this.attachEventListeners(requests);
  }

  // Show error in UI
  showError(message) {
    const container = document.getElementById("requestsContainer");
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #dc3545;">
        <i class="fa-solid fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
        <p style="font-size: 14px; font-weight: 600;">Error Loading Requests</p>
        <p style="font-size: 12px; margin-top: 5px;">${message}</p>
        <p style="font-size: 11px; margin-top: 10px; color: #666;">
          Retrying automatically...
        </p>
      </div>
    `;
  }

  // Create HTML for a request card (compact version for modal)
  createRequestCard(req) {
    const minutes = Math.floor(req.time_remaining_seconds / 60);
    const seconds = req.time_remaining_seconds % 60;
    const timeRemaining = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const serviceIcons = {
      groceries: "fa-bag-shopping",
      bills: "fa-receipt",
      delivery: "fa-box",
      pharmacy: "fa-pills",
      pickup: "fa-person",
      documents: "fa-file-contract",
    };

    const icon = serviceIcons[req.service_type] || "fa-circle-question";
    const isUrgent = req.time_remaining_seconds < 300; // Less than 5 minutes

    return `
      <div class="request-card-compact ${isUrgent ? "urgent" : ""}">
        <div class="request-card-header">
          <div>
            <div class="request-service-type">
              <i class="fa-solid ${icon}"></i> 
              ${req.service_type.replace("_", " ")}
            </div>
            <div class="request-customer">
              <i class="fa-solid fa-user"></i> ${req.customer_name}
            </div>
            ${
              req.budget_limit
                ? `
              <div style="font-size: 12px; color: #28a745; font-weight: 600; margin-top: 4px;">
                <i class="fa-solid fa-peso-sign"></i> ₱${req.budget_limit.toFixed(2)}
              </div>
            `
                : ""
            }
          </div>
          <div class="request-timer ${isUrgent ? "urgent" : ""}">
            <i class="fa-solid fa-clock"></i> ${timeRemaining}
          </div>
        </div>

        <div class="request-items">
          ${
            req.items_description.length > 80
              ? req.items_description.substring(0, 80) + "..."
              : req.items_description
          }
        </div>

        ${
          req.special_instructions
            ? `
          <div style="font-size: 11px; color: #666; font-style: italic; margin-bottom: 10px;">
            <i class="fa-solid fa-note-sticky"></i> ${req.special_instructions}
          </div>
        `
            : ""
        }

        <div class="request-actions">
          <button 
            id="accept-${req.request_id}"
            class="request-action-btn request-accept-btn"
          >
            <i class="fa-solid fa-check"></i> Accept
          </button>
          <button 
            id="decline-${req.request_id}"
            class="request-action-btn request-decline-btn"
          >
            <i class="fa-solid fa-times"></i> Decline
          </button>
        </div>
      </div>
    `;
  }

  // Attach event listeners to buttons
  attachEventListeners(requests) {
    console.log("🔗 Attaching event listeners...");

    requests.forEach((req) => {
      const acceptBtn = document.getElementById(`accept-${req.request_id}`);
      const declineBtn = document.getElementById(`decline-${req.request_id}`);

      if (acceptBtn) {
        acceptBtn.addEventListener("click", () =>
          this.acceptRequest(req.request_id),
        );
      }
      if (declineBtn) {
        declineBtn.addEventListener("click", () =>
          this.declineRequest(req.request_id),
        );
      }
    });

    console.log("   Listeners attached to", requests.length, "cards");
  }

  // Accept a request
  async acceptRequest(requestId) {
    if (
      !confirm(
        "Accept this request? You will be responsible for completing it.",
      )
    ) {
      return;
    }

    console.log(`✅ Accepting request ${requestId}...`);

    try {
      const result = await pasugoAPI.acceptRequest(requestId);

      if (result.success) {
        console.log("✅ Request accepted successfully");

        // Get customer name from the request data
        const req = this.currentRequests.find(
          (r) => r.request_id === requestId,
        );
        const customerName = req?.customer_name || "Customer";

        // Connect to chat
        if (window.riderChatManager) {
          console.log("💬 Connecting to chat...");
          window.riderChatManager.setCustomerInfo(customerName);
          await window.riderChatManager.connect(requestId);

          // Store active request
          localStorage.setItem("active_request_id", requestId);
          localStorage.setItem("active_request_customer", customerName);
        }

        alert("✅ Request accepted! You can chat with the customer now.");

        // Close the requests modal
        const requestsModal = document.getElementById("requestsModal");
        if (requestsModal) requestsModal.classList.add("hidden");

        // Refresh the list
        this.checkForRequests();
      } else {
        console.error("❌ Failed to accept:", result.message);
        alert("❌ Failed to accept: " + result.message);
      }
    } catch (error) {
      console.error("❌ Error accepting request:", error);
      alert("❌ Error: " + error.message);
    }
  }

  // Decline a request
  async declineRequest(requestId) {
    if (!confirm("Decline this request? The customer will be notified.")) {
      return;
    }

    console.log(`❌ Declining request ${requestId}...`);

    try {
      const result = await pasugoAPI.declineRequest(requestId);

      if (result.success) {
        console.log("✅ Request declined successfully");
        alert("Request declined");
        // Refresh the list
        this.checkForRequests();
      } else {
        console.error("❌ Failed to decline:", result.message);
        alert("❌ Failed to decline: " + result.message);
      }
    } catch (error) {
      console.error("❌ Error declining request:", error);
      alert("❌ Error: " + error.message);
    }
  }

  // Play notification sound
  playNotificationSound() {
    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log("🔔 Notification sound played");
    } catch (error) {
      console.warn("⚠️ Could not play sound:", error);
    }
  }

  // Stop polling
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.isRunning = false;
      console.log("🛑 Request handler stopped");
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTO-INITIALIZATION
// ═══════════════════════════════════════════════════════════════

let riderRequestHandler = null;

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📄 rider-requests.js: DOM Content Loaded");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Small delay to ensure other scripts are loaded
  setTimeout(() => {
    const userData = localStorage.getItem("user_data");

    if (!userData) {
      console.log("⚠️ No user data found - user not logged in");
      return;
    }

    let user;
    try {
      user = JSON.parse(userData);
    } catch (error) {
      console.error("❌ Failed to parse user data:", error);
      return;
    }

    console.log("👤 Logged in as:", {
      name: user.full_name,
      type: user.user_type,
      id: user.user_id || user.id,
    });

    // Handle both "rider" and "UserType.rider" formats
    const userType = String(user.user_type).toLowerCase();
    const isRider = userType === "rider" || userType.includes("rider");

    if (isRider) {
      console.log("🏍️ User is a RIDER - initializing request handler...\n");

      riderRequestHandler = new RiderRequestHandler();
      riderRequestHandler.init();
    } else {
      console.log(
        `ℹ️ User is ${user.user_type} (not rider) - skipping request handler`,
      );
    }
  }, 500); // 500ms delay
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (riderRequestHandler) {
    riderRequestHandler.stop();
  }
});

// Make available globally for debugging
window.riderRequestHandler = riderRequestHandler;

console.log("✅ rider-requests.js loaded");
