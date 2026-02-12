// api_request.js - Pasugo API Request Handler (FIXED)
// Centralized API calls to backend
// FIXED: Properly handles tokens from localStorage

class PasugoAPI {
  constructor() {
    this.baseURL = "https://pasugo.onrender.com/api";
    // Initialize token and user data from localStorage
    this.updateToken();
    console.log("✅ PasugoAPI initialized", {
      hasToken: !!this.token,
      hasUserData: !!this.userData,
      userId: this.userData?.user_id || this.userData?.id,
    });
  }

  // ===== UTILITY METHODS =====

  updateToken() {
    // Get token from localStorage (saved by auth.js)
    this.token = localStorage.getItem("access_token");

    // Get user data from localStorage
    const userDataStr = localStorage.getItem("user_data");
    this.userData = userDataStr ? JSON.parse(userDataStr) : {};

    console.log("🔄 Token updated:", {
      hasToken: !!this.token,
      userData: this.userData,
    });
  }

  getAuthHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  handleError(error, endpoint) {
    console.error(`❌ API Error [${endpoint}]:`, error);
    return {
      success: false,
      message: error.message || "Unknown error occurred",
      data: null,
    };
  }

  // ===== REQUEST CREATION =====

  /**
   * Create a new request
   * @param {Object} requestData - {serviceType, itemsDescription, budgetLimit, specialInstructions, pickupLocation, deliveryAddress, deliveryOption}
   * @returns {Promise<Object>} - {success, data: {request_id, status, ...}}
   */
  async createRequest(requestData) {
    try {
      console.log("📋 Creating request...", requestData);

      // Update token before making request
      this.updateToken();

      // Check authentication
      if (!this.token) {
        console.error("❌ No token found in localStorage");
        console.log("📍 localStorage keys:", Object.keys(localStorage));
        throw new Error(
          "Not authenticated. Please login first. (No token found)",
        );
      }

      // Check user data
      if (!this.userData || (!this.userData.user_id && !this.userData.id)) {
        console.error("❌ No user data found in localStorage");
        console.log("📍 userData:", this.userData);
        throw new Error(
          "User data not found. Please login again. (userData missing)",
        );
      }

      const payload = {
        service_type: requestData.serviceType,
        items_description: requestData.itemsDescription,
        budget_limit: requestData.budgetLimit || null,
        special_instructions: requestData.specialInstructions || null,
        pickup_location: requestData.pickupLocation || null,
        delivery_address: requestData.deliveryAddress || null,
        delivery_option: requestData.deliveryOption || null,
      };

      console.log("📤 Sending payload:", payload);
      console.log(
        "📤 Auth header:",
        `Bearer ${this.token.substring(0, 20)}...`,
      );

      const response = await fetch(`${this.baseURL}/requests/create`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log("📥 Response status:", response.status);
      console.log("📥 Response data:", data);

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Failed to create request",
        );
      }

      console.log("✅ Request created successfully:", data);
      return {
        success: true,
        message: "Request created successfully",
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "createRequest");
    }
  }

  // ===== REQUEST RETRIEVAL =====

  /**
   * Get current user's requests
   * @param {Object} options - {serviceType, status, page, pageSize}
   * @returns {Promise<Object>}
   */
  async getMyRequests(options = {}) {
    try {
      console.log("📋 Fetching my requests...");

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const params = new URLSearchParams();
      if (options.serviceType)
        params.append("service_type", options.serviceType);
      if (options.status) params.append("status", options.status);
      if (options.page) params.append("page", options.page);
      if (options.pageSize) params.append("page_size", options.pageSize);

      const queryString = params.toString();
      const url = queryString
        ? `${this.baseURL}/requests/my-requests?${queryString}`
        : `${this.baseURL}/requests/my-requests`;

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to fetch requests");
      }

      console.log("✅ Requests fetched:", data);
      return {
        success: true,
        message: "Requests retrieved successfully",
        data: data.data,
        pagination: data.pagination,
      };
    } catch (error) {
      return this.handleError(error, "getMyRequests");
    }
  }

  /**
   * Get specific request details
   * @param {number} requestId
   * @returns {Promise<Object>}
   */
  async getRequestDetails(requestId) {
    try {
      console.log(`📋 Fetching request details for ID: ${requestId}`);

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const response = await fetch(`${this.baseURL}/requests/${requestId}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to fetch request details");
      }

      console.log("✅ Request details fetched:", data);
      return {
        success: true,
        message: "Request retrieved successfully",
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "getRequestDetails");
    }
  }

  // ===== REQUEST STATUS MANAGEMENT =====

  /**
   * Accept a request (RIDER ONLY)
   * @param {number} requestId
   * @returns {Promise<Object>}
   */
  async acceptRequest(requestId) {
    try {
      console.log(`✅ Accepting request ID: ${requestId}`);

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/accept`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to accept request");
      }

      console.log("✅ Request accepted:", data);
      return {
        success: true,
        message: "Request accepted successfully",
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "acceptRequest");
    }
  }

  /**
   * Update request status
   * @param {number} requestId
   * @param {string} newStatus - pending, assigned, in_progress, completed, cancelled
   * @returns {Promise<Object>}
   */
  async updateRequestStatus(requestId, newStatus) {
    try {
      console.log(`🔄 Updating request ${requestId} status to: ${newStatus}`);

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/status`,
        {
          method: "PATCH",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ new_status: newStatus }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update request status");
      }

      console.log("✅ Request status updated:", data);
      return {
        success: true,
        message: `Request status updated to ${newStatus}`,
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "updateRequestStatus");
    }
  }

  /**
   * Cancel a request
   * @param {number} requestId
   * @returns {Promise<Object>}
   */
  async cancelRequest(requestId) {
    try {
      console.log(`❌ Cancelling request ID: ${requestId}`);

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/cancel`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to cancel request");
      }

      console.log("✅ Request cancelled:", data);
      return {
        success: true,
        message: "Request cancelled successfully",
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "cancelRequest");
    }
  }

  // ===== FILE UPLOADS =====

  /**
   * Add bill photo to request
   * NOTE: Upload to Cloudinary first, then use this endpoint with the URL
   * @param {number} requestId
   * @param {string} photoUrl - Cloudinary URL
   * @param {string} fileName - Original file name
   * @param {number} fileSize - File size in bytes
   * @returns {Promise<Object>}
   */
  async addBillPhoto(requestId, photoUrl, fileName, fileSize) {
    try {
      console.log(`📸 Adding bill photo to request ${requestId}`);

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const payload = {
        photo_url: photoUrl,
        file_name: fileName,
        file_size: fileSize,
      };

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/add-bill-photo`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to add bill photo");
      }

      console.log("✅ Bill photo added:", data);
      return {
        success: true,
        message: "Bill photo added successfully",
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "addBillPhoto");
    }
  }

  /**
   * Add attachment to request
   * NOTE: Upload to Cloudinary first, then use this endpoint with the URL
   * @param {number} requestId
   * @param {string} fileName
   * @param {string} fileUrl - Cloudinary URL
   * @param {string} fileType - MIME type
   * @param {number} fileSize - File size in bytes
   * @returns {Promise<Object>}
   */
  async addAttachment(requestId, fileName, fileUrl, fileType, fileSize) {
    try {
      console.log(`📎 Adding attachment to request ${requestId}`);

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const payload = {
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        file_size: fileSize,
      };

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/add-attachment`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to add attachment");
      }

      console.log("✅ Attachment added:", data);
      return {
        success: true,
        message: "Attachment added successfully",
        data: data.data,
      };
    } catch (error) {
      return this.handleError(error, "addAttachment");
    }
  }

  /**
   * Delete bill photo
   * @param {number} requestId
   * @param {number} photoId
   * @returns {Promise<Object>}
   */
  async deleteBillPhoto(requestId, photoId) {
    try {
      console.log(
        `🗑️ Deleting bill photo ${photoId} from request ${requestId}`,
      );

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/photos/${photoId}`,
        {
          method: "DELETE",
          headers: this.getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete bill photo");
      }

      console.log("✅ Bill photo deleted:", data);
      return {
        success: true,
        message: "Photo deleted successfully",
      };
    } catch (error) {
      return this.handleError(error, "deleteBillPhoto");
    }
  }

  /**
   * Delete attachment
   * @param {number} requestId
   * @param {number} attachmentId
   * @returns {Promise<Object>}
   */
  async deleteAttachment(requestId, attachmentId) {
    try {
      console.log(
        `🗑️ Deleting attachment ${attachmentId} from request ${requestId}`,
      );

      // Update token before making request
      this.updateToken();

      if (!this.token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const response = await fetch(
        `${this.baseURL}/requests/${requestId}/attachments/${attachmentId}`,
        {
          method: "DELETE",
          headers: this.getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete attachment");
      }

      console.log("✅ Attachment deleted:", data);
      return {
        success: true,
        message: "Attachment deleted successfully",
      };
    } catch (error) {
      return this.handleError(error, "deleteAttachment");
    }
  }

  // ===== HEALTH CHECK =====

  /**
   * Check if backend is online
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await fetch(
        `${this.baseURL.replace("/api", "")}/health`,
      );
      return response.ok;
    } catch (error) {
      console.error("❌ Backend health check failed");
      return false;
    }
  }
}

// Create global instance
const pasugoAPI = new PasugoAPI();

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = PasugoAPI;
}

console.log("✅ API module loaded. pasugoAPI is ready to use.");
