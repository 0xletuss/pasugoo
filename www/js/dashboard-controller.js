/**
 * Dashboard Controller - Pasugo Customer Dashboard
 * Handles: Navigation, Panels, Notifications, Chat History, Order History, Rating
 */

const API_BASE = window.API_BASE_URL || "https://pasugo.onrender.com";

class DashboardController {
  constructor() {
    this.currentPanel = "mapPanel";
    this.notifications = [];
    this.conversations = [];
    this.orders = [];
    this.unreadCount = 0;
    this.notifPollInterval = null;
    this.orderFilter = "all";
    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this._setupNavigation();
      this._setupPanels();
      this._setupRating();
      this._loadProfile();
      this._startNotificationPolling();
      this._setupFAB();
    });
  }

  // ═══════ AUTHENTICATION HELPER ═══════
  _getHeaders() {
    const token = localStorage.getItem("access_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // ═══════ NAVIGATION ═══════
  _setupNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    navTabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const panelId = tab.dataset.panel;
        if (panelId) this.showPanel(panelId, tab);
      });
    });

    // Profile menu items
    this._bindClick("menuChatHistory", () =>
      this.showPanel("chatHistoryPanel"),
    );
    this._bindClick("menuOrders", () => this.showPanel("historyPanel"));
    this._bindClick("menuNotifications", () =>
      this.showPanel("notificationsPanel"),
    );
    this._bindClick("menuLogout", () => this._logout());

    // Back buttons
    [
      "historyBackBtn",
      "notifsBackBtn",
      "profileBackBtn",
      "chatHistoryBackBtn",
    ].forEach((id) => {
      this._bindClick(id, () => this.showPanel("mapPanel"));
    });

    // Mark all read
    this._bindClick("markAllReadBtn", () => this._markAllNotificationsRead());
  }

  _setupFAB() {
    const fab = document.getElementById("navNewRequest");
    if (fab) {
      fab.addEventListener("click", () => {
        // Make sure we're on the map panel
        this.showPanel("mapPanel");
        // Open the request modal
        const overlay = document.getElementById("requestModalOverlay");
        if (overlay) overlay.style.display = "flex";
      });
    }
  }

  showPanel(panelId, clickedTab = null) {
    // Hide all panels
    document
      .querySelectorAll(".app-panel")
      .forEach((p) => (p.style.display = "none"));

    // Hide/show the page-wrapper (map + bottom sheet).
    // bottom-nav-dock is a sibling of page-wrapper so it stays visible.
    const pageWrapper = document.querySelector(".page-wrapper");
    const bottomNav = document.querySelector(".bottom-nav-dock");

    if (panelId === "mapPanel") {
      if (pageWrapper) pageWrapper.style.display = "";
      if (bottomNav) bottomNav.style.display = "";
    } else {
      if (pageWrapper) pageWrapper.style.display = "none";
      const panel = document.getElementById(panelId);
      if (panel) panel.style.display = "";
      // Keep bottom nav visible for main panels, hide for sub-panels
      if (
        ["historyPanel", "notificationsPanel", "profilePanel"].includes(panelId)
      ) {
        if (bottomNav) bottomNav.style.display = "";
      } else {
        if (bottomNav) bottomNav.style.display = "none";
      }
    }

    // Update nav tabs active state
    document
      .querySelectorAll(".nav-tab")
      .forEach((t) => t.classList.remove("active"));
    if (clickedTab) {
      clickedTab.classList.add("active");
    } else {
      // Find matching tab
      const matchTab = document.querySelector(
        `.nav-tab[data-panel="${panelId}"]`,
      );
      if (matchTab) matchTab.classList.add("active");
      if (panelId === "mapPanel") {
        const mapTab = document.getElementById("navMap");
        if (mapTab) mapTab.classList.add("active");
      }
    }

    this.currentPanel = panelId;

    // Load data for panel
    if (panelId === "historyPanel") this._loadOrders();
    if (panelId === "notificationsPanel") this._loadNotifications();
    if (panelId === "chatHistoryPanel") this._loadConversations();
    if (panelId === "profilePanel") this._loadProfile();
  }

  // ═══════ PANELS SETUP ═══════
  _setupPanels() {
    // History filter tabs
    const historyTabs = document.getElementById("historyTabs");
    if (historyTabs) {
      historyTabs.addEventListener("click", (e) => {
        const tab = e.target.closest(".section-tab");
        if (!tab) return;
        historyTabs
          .querySelectorAll(".section-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.orderFilter = tab.dataset.filter;
        this._renderOrders();
      });
    }
  }

  // ═══════ PROFILE ═══════
  _loadProfile() {
    const userData = localStorage.getItem("user_data");
    if (!userData) return;
    const user = JSON.parse(userData);
    this._setText("profileName", user.full_name || "Customer");
    this._setText("profileEmail", user.email || "");
    this._setText("profilePhone", user.phone_number || "");
  }

  // ═══════ NOTIFICATIONS ═══════
  _startNotificationPolling() {
    this._fetchUnreadCount();
    this.notifPollInterval = setInterval(() => this._fetchUnreadCount(), 30000);
  }

  async _fetchUnreadCount() {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        this.unreadCount = data.data?.unread_count || 0;
        this._updateNotifBadge();
      }
    } catch (e) {
      /* silent */
    }
  }

  _updateNotifBadge() {
    const badge = document.getElementById("notifBadge");
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? "99+" : this.unreadCount;
        badge.classList.add("show");
      } else {
        badge.classList.remove("show");
      }
    }
  }

  async _loadNotifications() {
    const container = document.getElementById("notificationList");
    if (!container) return;

    container.innerHTML =
      '<div class="page-loader"><div class="spinner"></div><span>Loading...</span></div>';

    try {
      const res = await fetch(`${API_BASE}/api/notifications/`, {
        headers: this._getHeaders(),
      });
      const data = await res.json();

      if (data.success && data.data) {
        this.notifications = data.data;
        this._renderNotifications();
      } else {
        container.innerHTML =
          '<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><h3>No notifications</h3><p>You\'re all caught up!</p></div>';
      }
    } catch (e) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><h3>Error loading</h3><p>Please try again</p></div>';
    }
  }

  _renderNotifications() {
    const container = document.getElementById("notificationList");
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><h3>No notifications</h3><p>You\'re all caught up!</p></div>';
      return;
    }

    container.innerHTML = this.notifications
      .map((n) => {
        const iconClass = this._getNotifIconClass(n.notification_type);
        const timeAgo = this._timeAgo(n.created_at);
        return `
                <div class="notification-item ${n.is_read ? "" : "unread"}" data-id="${n.notification_id}">
                    <div class="notif-icon ${iconClass.type}"><i class="${iconClass.icon}"></i></div>
                    <div class="notif-content">
                        <div class="notif-title">${this._escHtml(n.title)}</div>
                        <div class="notif-body">${this._escHtml(n.message)}</div>
                        <div class="notif-time">${timeAgo}</div>
                    </div>
                </div>
            `;
      })
      .join("");

    // Click to mark as read
    container.querySelectorAll(".notification-item.unread").forEach((item) => {
      item.addEventListener("click", () =>
        this._markNotificationRead(item.dataset.id, item),
      );
    });
  }

  _getNotifIconClass(type) {
    const map = {
      request_update: { type: "request", icon: "fa-solid fa-clipboard-list" },
      payment_confirmation: {
        type: "payment",
        icon: "fa-solid fa-money-check",
      },
      delivery_update: { type: "delivery", icon: "fa-solid fa-truck" },
      system: { type: "system", icon: "fa-solid fa-gear" },
      promotion: { type: "system", icon: "fa-solid fa-gift" },
    };
    return map[type] || map["system"];
  }

  async _markNotificationRead(notifId, element) {
    try {
      await fetch(`${API_BASE}/api/notifications/${notifId}/read`, {
        method: "PATCH",
        headers: this._getHeaders(),
      });
      element.classList.remove("unread");
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this._updateNotifBadge();
    } catch (e) {
      /* silent */
    }
  }

  async _markAllNotificationsRead() {
    try {
      await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
        method: "PATCH",
        headers: this._getHeaders(),
      });
      this.unreadCount = 0;
      this._updateNotifBadge();
      document
        .querySelectorAll(".notification-item.unread")
        .forEach((el) => el.classList.remove("unread"));
    } catch (e) {
      /* silent */
    }
  }

  // ═══════ ORDER HISTORY ═══════
  async _loadOrders() {
    const container = document.getElementById("orderList");
    if (!container) return;

    container.innerHTML =
      '<div class="page-loader"><div class="spinner"></div><span>Loading orders...</span></div>';

    try {
      const res = await fetch(
        `${API_BASE}/api/requests/my-requests?page_size=50`,
        {
          headers: this._getHeaders(),
        },
      );
      const data = await res.json();

      if (data.success && data.data) {
        this.orders = data.data;
        this._renderOrders();
      } else {
        container.innerHTML =
          '<div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>No orders yet</h3><p>Your order history will appear here</p></div>';
      }
    } catch (e) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><h3>Error loading</h3><p>Please try again</p></div>';
    }
  }

  _renderOrders() {
    const container = document.getElementById("orderList");
    if (!container) return;

    let filtered = this.orders;
    if (this.orderFilter !== "all") {
      filtered = this.orders.filter((o) => o.status === this.orderFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>No orders found</h3><p>No orders match this filter</p></div>';
      return;
    }

    const serviceIcons = {
      groceries: "fa-bag-shopping",
      delivery: "fa-box",
      pharmacy: "fa-pills",
      pickup: "fa-person",
      documents: "fa-file-contract",
      bills: "fa-receipt",
    };

    container.innerHTML = filtered
      .map((o) => {
        const icon = serviceIcons[o.service_type] || "fa-box";
        const statusClass = (o.status || "").replace(" ", "_");
        const amount = o.total_amount
          ? `₱${parseFloat(o.total_amount).toFixed(2)}`
          : "—";
        const date = this._formatDate(o.created_at);
        const showRate = o.status === "completed";

        return `
                <div class="order-card" data-id="${o.request_id}">
                    <div class="order-card-header">
                        <div class="order-service"><i class="fa-solid ${icon}"></i> ${o.service_type}</div>
                        <span class="order-status ${statusClass}">${(o.status || "").replace("_", " ")}</span>
                    </div>
                    <div class="order-details">${this._escHtml(o.items_description || "").substring(0, 100)}${(o.items_description || "").length > 100 ? "..." : ""}</div>
                    <div class="order-footer">
                        <span>${date}</span>
                        <span class="order-amount">${amount}</span>
                    </div>
                    ${
                      showRate
                        ? `
                        <div class="order-actions">
                            <button class="order-action-btn primary rate-btn" data-request-id="${o.request_id}">
                                <i class="fa-solid fa-star"></i> Rate Rider
                            </button>
                        </div>
                    `
                        : ""
                    }
                </div>
            `;
      })
      .join("");

    // Bind rate buttons
    container.querySelectorAll(".rate-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showRatingModal(btn.dataset.requestId);
      });
    });
  }

  // ═══════ CHAT HISTORY ═══════
  async _loadConversations() {
    const container = document.getElementById("conversationList");
    if (!container) return;

    container.innerHTML =
      '<div class="page-loader"><div class="spinner"></div><span>Loading chats...</span></div>';

    try {
      const res = await fetch(`${API_BASE}/api/messages/conversations`, {
        headers: this._getHeaders(),
      });
      const data = await res.json();

      if (data.success && data.data) {
        this.conversations = data.data;
        this._renderConversations();
      } else {
        container.innerHTML =
          '<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No conversations</h3><p>Chat with riders during active deliveries</p></div>';
      }
    } catch (e) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><h3>Error loading</h3><p>Please try again</p></div>';
    }
  }

  _renderConversations() {
    const container = document.getElementById("conversationList");
    if (!container) return;

    if (this.conversations.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No conversations</h3><p>Chat with riders during active deliveries</p></div>';
      return;
    }

    container.innerHTML = this.conversations
      .map((c) => {
        const name = c.other_user_name || c.rider_name || "Rider";
        const initial = name.charAt(0).toUpperCase();
        const lastMsg = c.last_message || "No messages yet";
        const time = c.last_message_at ? this._timeAgo(c.last_message_at) : "";
        const unread = c.unread_count || 0;

        return `
                <div class="conversation-item ${unread > 0 ? "unread" : ""}" data-conversation-id="${c.conversation_id}" data-request-id="${c.request_id || ""}">
                    <div class="conv-avatar">${initial}</div>
                    <div class="conv-details">
                        <div class="conv-header">
                            <span class="conv-name">${this._escHtml(name)}</span>
                            <span class="conv-time">${time}</span>
                        </div>
                        <div class="conv-last-msg ${unread > 0 ? "unread" : ""}">${this._escHtml(lastMsg)}</div>
                    </div>
                    ${unread > 0 ? `<div class="conv-badge">${unread}</div>` : ""}
                </div>
            `;
      })
      .join("");

    // Click to open chat (reconnect to active request chat)
    container.querySelectorAll(".conversation-item").forEach((item) => {
      item.addEventListener("click", () => {
        const requestId = item.dataset.requestId;
        if (requestId) {
          // Navigate back to map and open chat modal if there's an active request
          this.showPanel("mapPanel");
          // Store and trigger chat reopening
          localStorage.setItem("open_chat_request_id", requestId);
          // If request modal exists and has reconnect capability
          if (
            window.requestModalInstance &&
            typeof window.requestModalInstance.reconnectToRequest === "function"
          ) {
            window.requestModalInstance.reconnectToRequest(parseInt(requestId));
          }
        }
      });
    });
  }

  // ═══════ RATING SYSTEM ═══════
  _setupRating() {
    const overlay = document.getElementById("ratingOverlay");
    if (!overlay) return;

    // Main star rating
    const mainStars = document.querySelectorAll("#mainStarRating .star");
    mainStars.forEach((star) => {
      star.addEventListener("click", () => {
        const val = parseInt(star.dataset.value);
        mainStars.forEach((s) => {
          s.classList.toggle("active", parseInt(s.dataset.value) <= val);
        });
        this._checkRatingReady();
      });

      star.addEventListener("mouseenter", () => {
        const val = parseInt(star.dataset.value);
        mainStars.forEach((s) => {
          s.style.color = parseInt(s.dataset.value) <= val ? "#ffc107" : "#ddd";
        });
      });

      star.addEventListener("mouseleave", () => {
        mainStars.forEach((s) => {
          s.style.color = s.classList.contains("active") ? "#ffc107" : "#ddd";
        });
      });
    });

    // Category star ratings
    document.querySelectorAll(".cat-stars").forEach((catStarsEl) => {
      const stars = catStarsEl.querySelectorAll(".star");
      stars.forEach((star) => {
        star.addEventListener("click", () => {
          const val = parseInt(star.dataset.value);
          stars.forEach((s) => {
            s.classList.toggle("active", parseInt(s.dataset.value) <= val);
          });
        });
      });
    });

    // Submit rating
    this._bindClick("submitRatingBtn", () => this._submitRating());
    this._bindClick("skipRatingBtn", () => this._hideRatingModal());
  }

  showRatingModal(requestId) {
    const overlay = document.getElementById("ratingOverlay");
    const input = document.getElementById("ratingRequestId");
    if (!overlay || !input) return;

    // Check if already rated
    this._checkAlreadyRated(requestId).then((rated) => {
      if (rated) {
        alert("You have already rated this delivery!");
        return;
      }
      input.value = requestId;
      // Reset stars
      document
        .querySelectorAll(".star-rating .star, .cat-stars .star")
        .forEach((s) => s.classList.remove("active"));
      const feedback = document.getElementById("ratingFeedback");
      if (feedback) feedback.value = "";
      const btn = document.getElementById("submitRatingBtn");
      if (btn) btn.disabled = true;
      overlay.classList.add("show");
    });
  }

  _hideRatingModal() {
    const overlay = document.getElementById("ratingOverlay");
    if (overlay) overlay.classList.remove("show");
  }

  async _checkAlreadyRated(requestId) {
    try {
      const res = await fetch(`${API_BASE}/api/ratings/check/${requestId}`, {
        headers: this._getHeaders(),
      });
      const data = await res.json();
      return data.data?.has_rated || false;
    } catch {
      return false;
    }
  }

  _checkRatingReady() {
    const activeStars = document.querySelectorAll(
      "#mainStarRating .star.active",
    );
    const btn = document.getElementById("submitRatingBtn");
    if (btn) btn.disabled = activeStars.length === 0;
  }

  async _submitRating() {
    const requestId = document.getElementById("ratingRequestId")?.value;
    if (!requestId) return;

    const mainStars = document.querySelectorAll("#mainStarRating .star.active");
    if (mainStars.length === 0) return;

    const overallRating = mainStars.length;

    // Get category ratings
    const getCatRating = (cat) => {
      const active = document.querySelectorAll(
        `.cat-stars[data-cat="${cat}"] .star.active`,
      );
      return active.length > 0 ? active.length : null;
    };

    const feedback = document.getElementById("ratingFeedback")?.value || "";

    const btn = document.getElementById("submitRatingBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting...";
    }

    try {
      const res = await fetch(`${API_BASE}/api/ratings/submit`, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({
          request_id: parseInt(requestId),
          overall_rating: overallRating,
          communication_rating: getCatRating("communication"),
          speed_rating: getCatRating("speed"),
          service_rating: getCatRating("service"),
          feedback_text: feedback || null,
          is_anonymous: false,
        }),
      });

      const data = await res.json();

      if (data.success) {
        this._hideRatingModal();
        this._showToast("Rating submitted! Thank you!", "success");
      } else {
        this._showToast(
          data.detail || data.message || "Failed to submit rating",
          "error",
        );
      }
    } catch (e) {
      this._showToast("Network error. Please try again.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit Rating";
      }
    }
  }

  // ═══════ LOGOUT ═══════
  _logout() {
    if (confirm("Are you sure you want to logout?")) {
      if (this.notifPollInterval) clearInterval(this.notifPollInterval);
      if (window.auth && window.auth.logout) {
        window.auth.logout();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "login.html";
      }
    }
  }

  // ═══════ UTILITY ═══════
  _bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _escHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  _timeAgo(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  _showToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999;
            padding: 12px 24px; border-radius: 50px; font-size: 14px; font-weight: 600;
            color: white; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: fadeInDown 0.3s ease;
            font-family: 'Poppins', sans-serif; max-width: 90%;
            background: ${type === "success" ? "#28a745" : type === "error" ? "#dc3545" : "#333"};
        `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Expose globally
window.dashboardController = new DashboardController();

// Also trigger rating modal after delivery completion
// (Called from request-modal.js when delivery completes)
window.showRatingModal = function (requestId) {
  if (window.dashboardController) {
    window.dashboardController.showRatingModal(requestId);
  }
};
