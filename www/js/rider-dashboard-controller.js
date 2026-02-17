/**
 * Rider Dashboard Controller - Pasugo
 * Handles: Navigation, Online/Offline, Stats, Chat History, Notifications, Profile, Ratings
 */

const RIDER_API_BASE = window.API_BASE_URL || "https://pasugo.onrender.com";

class RiderDashboardController {
  constructor() {
    this.isOnline = false;
    this.currentPanel = "riderMapPanel";
    this.unreadNotifCount = 0;
    this.notifPollInterval = null;
    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this._checkAuth();
      this._setupOnlineToggle();
      this._setupNavigation();
      this._setupRequestsModal();
      this._startNotificationPolling();
    });
  }

  _getHeaders() {
    const token = localStorage.getItem("access_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // ═══════ AUTH ═══════
  _checkAuth() {
    const userData = localStorage.getItem("user_data");
    if (!userData) {
      window.location.href = "login.html";
      return;
    }
    const user = JSON.parse(userData);
    const riderNameEl = document.getElementById("riderName");
    if (riderNameEl) riderNameEl.textContent = user.full_name || "Rider";
  }

  // ═══════ ONLINE/OFFLINE TOGGLE ═══════
  _setupOnlineToggle() {
    const btn = document.getElementById("toggleOnlineBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        this.isOnline = !this.isOnline;
        this._updateOnlineStatus(this.isOnline);
      });
    }
  }

  async _updateOnlineStatus(online) {
    const btn = document.getElementById("toggleOnlineBtn");
    const newStatus = online ? "available" : "offline";

    try {
      const res = await fetch(`${RIDER_API_BASE}/api/riders/status`, {
        method: "PATCH",
        headers: this._getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        console.error("Failed to update rider status");
      }
    } catch (e) {
      console.error("Error updating rider status:", e);
    }

    if (online) {
      btn.innerHTML =
        '<i class="fa-solid fa-circle" style="color: #28a745;"></i> Go Offline';
      btn.classList.remove("offline");
      btn.style.background = "#28a745";
      btn.style.color = "white";
      if (window.riderTracker) window.riderTracker.init();
    } else {
      btn.innerHTML = '<i class="fa-solid fa-circle"></i> Go Online';
      btn.classList.add("offline");
      btn.style.background = "#dc3545";
      btn.style.color = "white";
      if (window.riderTracker) window.riderTracker.stop();
    }
  }

  // ═══════ NAVIGATION ═══════
  _setupNavigation() {
    // Bottom nav items
    document.querySelectorAll(".rider-nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const panelId = item.dataset.panel;
        if (panelId) this.showPanel(panelId, item);
      });
    });

    // Back buttons
    [
      "riderStatsBack",
      "riderChatBack",
      "riderNotifBack",
      "riderProfileBack",
    ].forEach((id) => {
      this._bindClick(id, () => this.showPanel("riderMapPanel"));
    });

    // Profile menu items
    this._bindClick("riderMenuStats", () => this.showPanel("riderStatsPanel"));
    this._bindClick("riderMenuChat", () => this.showPanel("riderChatPanel"));
    this._bindClick("riderMenuNotifs", () => this.showPanel("riderNotifPanel"));
    this._bindClick("riderMenuLogout", () => this._logout());

    // Mark all read
    this._bindClick("riderMarkAllRead", () => this._markAllRead());
  }

  showPanel(panelId, clickedTab = null) {
    // Hide all panels
    document
      .querySelectorAll(".app-panel")
      .forEach((p) => (p.style.display = "none"));

    // Map elements
    const mapEl = document.getElementById("riderMap");
    const statusBar = document.querySelector(".rider-status-bar");
    const mapControls = document.querySelector(".rider-map-controls");
    const requestsBadge = document.getElementById("requestsBadge");
    const locationCard = document.querySelector(".location-status-card");
    const requestsModal = document.getElementById("requestsModal");
    const bottomNav = document.querySelector(".rider-bottom-nav");

    const mapElements = [
      mapEl,
      statusBar,
      mapControls,
      requestsBadge,
      locationCard,
    ];

    if (panelId === "riderMapPanel") {
      mapElements.forEach((el) => {
        if (el) el.style.display = "";
      });
      if (bottomNav) bottomNav.style.display = "";
    } else {
      mapElements.forEach((el) => {
        if (el) el.style.display = "none";
      });
      if (requestsModal) requestsModal.classList.add("hidden");
      const panel = document.getElementById(panelId);
      if (panel) panel.style.display = "";
      if (bottomNav) bottomNav.style.display = "";
    }

    // Update active nav
    document
      .querySelectorAll(".rider-nav-item")
      .forEach((n) => n.classList.remove("active"));
    if (clickedTab) {
      clickedTab.classList.add("active");
    } else {
      const match = document.querySelector(
        `.rider-nav-item[data-panel="${panelId}"]`,
      );
      if (match) match.classList.add("active");
    }

    this.currentPanel = panelId;

    // Load data
    if (panelId === "riderStatsPanel") this._loadStats();
    if (panelId === "riderChatPanel") this._loadConversations();
    if (panelId === "riderNotifPanel") this._loadNotifications();
    if (panelId === "riderProfilePanel") this._loadProfile();
  }

  _setupRequestsModal() {
    const requestsBadge = document.getElementById("requestsBadge");
    const requestsModal = document.getElementById("requestsModal");
    const closeBtn = document.getElementById("closeRequestsBtn");

    if (requestsBadge) {
      requestsBadge.addEventListener("click", () => {
        if (requestsModal) requestsModal.classList.toggle("hidden");
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (requestsModal) requestsModal.classList.add("hidden");
      });
    }
  }

  // ═══════ NOTIFICATIONS ═══════
  _startNotificationPolling() {
    this._fetchUnreadCount();
    this.notifPollInterval = setInterval(() => this._fetchUnreadCount(), 30000);
  }

  async _fetchUnreadCount() {
    try {
      const res = await fetch(
        `${RIDER_API_BASE}/api/notifications/unread-count`,
        {
          headers: this._getHeaders(),
        },
      );
      if (res.ok) {
        const data = await res.json();
        this.unreadNotifCount = data.data?.unread_count || 0;
        const badge = document.getElementById("riderNotifBadge");
        if (badge) {
          if (this.unreadNotifCount > 0) {
            badge.textContent = this.unreadNotifCount;
            badge.classList.add("active");
          } else {
            badge.classList.remove("active");
          }
        }
      }
    } catch (e) {
      /* silent */
    }
  }

  async _loadNotifications() {
    const container = document.getElementById("riderNotifList");
    if (!container) return;

    container.innerHTML =
      '<div class="page-loader"><div class="spinner"></div><span>Loading...</span></div>';

    try {
      const res = await fetch(`${RIDER_API_BASE}/api/notifications/`, {
        headers: this._getHeaders(),
      });
      const data = await res.json();

      if (data.success && data.data && data.data.length > 0) {
        container.innerHTML = data.data
          .map((n) => {
            const iconMap = {
              request_update: {
                type: "request",
                icon: "fa-solid fa-clipboard-list",
              },
              payment_confirmation: {
                type: "payment",
                icon: "fa-solid fa-money-check",
              },
              delivery_update: { type: "delivery", icon: "fa-solid fa-truck" },
              system: { type: "system", icon: "fa-solid fa-gear" },
            };
            const ic = iconMap[n.notification_type] || iconMap["system"];
            return `
                        <div class="notification-item ${n.is_read ? "" : "unread"}" data-id="${n.notification_id}">
                            <div class="notif-icon ${ic.type}"><i class="${ic.icon}"></i></div>
                            <div class="notif-content">
                                <div class="notif-title">${this._esc(n.title)}</div>
                                <div class="notif-body">${this._esc(n.message)}</div>
                                <div class="notif-time">${this._timeAgo(n.created_at)}</div>
                            </div>
                        </div>`;
          })
          .join("");

        container
          .querySelectorAll(".notification-item.unread")
          .forEach((item) => {
            item.addEventListener("click", () =>
              this._markRead(item.dataset.id, item),
            );
          });
      } else {
        container.innerHTML =
          '<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><h3>No notifications</h3><p>You\'re all caught up!</p></div>';
      }
    } catch (e) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><h3>Error loading</h3><p>Please try again</p></div>';
    }
  }

  async _markRead(id, el) {
    try {
      await fetch(`${RIDER_API_BASE}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: this._getHeaders(),
      });
      el.classList.remove("unread");
      this.unreadNotifCount = Math.max(0, this.unreadNotifCount - 1);
      this._fetchUnreadCount();
    } catch (e) {
      /* silent */
    }
  }

  async _markAllRead() {
    try {
      await fetch(`${RIDER_API_BASE}/api/notifications/mark-all-read`, {
        method: "PATCH",
        headers: this._getHeaders(),
      });
      this.unreadNotifCount = 0;
      this._fetchUnreadCount();
      document
        .querySelectorAll("#riderNotifList .notification-item.unread")
        .forEach((el) => el.classList.remove("unread"));
    } catch (e) {
      /* silent */
    }
  }

  // ═══════ STATS & RATINGS ═══════
  async _loadStats() {
    // Load profile data for stats
    try {
      const res = await fetch(`${RIDER_API_BASE}/api/riders/profile`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const rider = data.data || data;

        this._setText(
          "statRating",
          rider.rating ? parseFloat(rider.rating).toFixed(1) : "0.0",
        );
        this._setText("statCompleted", rider.total_tasks_completed || 0);
        this._setText(
          "statEarnings",
          `₱${parseFloat(rider.total_earnings || 0).toFixed(0)}`,
        );
      }
    } catch (e) {
      console.warn("Failed to load rider profile", e);
    }

    // Load ratings
    try {
      const res = await fetch(`${RIDER_API_BASE}/api/ratings/my-ratings`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const ratingsData = data.data || {};
        this._setText("statTotalRatings", ratingsData.total_ratings || 0);

        const container = document.getElementById("riderRatingsList");
        if (
          container &&
          ratingsData.ratings &&
          ratingsData.ratings.length > 0
        ) {
          container.innerHTML = ratingsData.ratings
            .map(
              (r) => `
                        <div class="order-card">
                            <div class="order-card-header">
                                <div class="order-service">
                                    <i class="fa-solid fa-star" style="color:#ffc107;"></i>
                                    ${"★".repeat(Math.round(r.overall_rating))}${"☆".repeat(5 - Math.round(r.overall_rating))}
                                    <span style="font-size:13px;color:#666;margin-left:4px;">(${r.overall_rating})</span>
                                </div>
                                <span style="font-size:11px;color:#999;">${this._timeAgo(r.rating_date)}</span>
                            </div>
                            ${r.feedback_text ? `<div class="order-details">"${this._esc(r.feedback_text)}"</div>` : ""}
                            <div class="order-footer">
                                <span>${r.customer_name || "Customer"}</span>
                            </div>
                        </div>
                    `,
            )
            .join("");
        } else if (container) {
          container.innerHTML =
            '<div class="empty-state"><i class="fa-solid fa-star-half-stroke"></i><h3>No ratings yet</h3><p>Complete deliveries to receive ratings</p></div>';
        }
      }
    } catch (e) {
      console.warn("Failed to load ratings", e);
    }

    // Load recent deliveries
    try {
      const res = await fetch(
        `${RIDER_API_BASE}/api/requests/my-requests?page_size=20`,
        { headers: this._getHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        const orders = data.data || [];

        const container = document.getElementById("riderOrdersList");
        if (container && orders.length > 0) {
          const serviceIcons = {
            groceries: "fa-bag-shopping",
            delivery: "fa-box",
            pharmacy: "fa-pills",
            pickup: "fa-person",
            documents: "fa-file-contract",
            bills: "fa-receipt",
          };

          container.innerHTML = orders
            .slice(0, 10)
            .map((o) => {
              const icon = serviceIcons[o.service_type] || "fa-box";
              const statusClass = (o.status || "").replace(" ", "_");
              const amount = o.total_amount
                ? `₱${parseFloat(o.total_amount).toFixed(2)}`
                : "—";

              return `
                            <div class="order-card">
                                <div class="order-card-header">
                                    <div class="order-service"><i class="fa-solid ${icon}"></i> ${o.service_type}</div>
                                    <span class="order-status ${statusClass}">${(o.status || "").replace("_", " ")}</span>
                                </div>
                                <div class="order-details">${this._esc(o.items_description || "").substring(0, 80)}</div>
                                <div class="order-footer">
                                    <span>${this._formatDate(o.created_at)}</span>
                                    <span class="order-amount">${amount}</span>
                                </div>
                            </div>
                        `;
            })
            .join("");
        } else if (container) {
          container.innerHTML =
            '<div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>No deliveries yet</h3><p>Go online to receive requests!</p></div>';
        }
      }
    } catch (e) {
      console.warn("Failed to load orders", e);
    }
  }

  // ═══════ CHAT HISTORY ═══════
  async _loadConversations() {
    const container = document.getElementById("riderConversationList");
    if (!container) return;

    container.innerHTML =
      '<div class="page-loader"><div class="spinner"></div><span>Loading chats...</span></div>';

    try {
      const res = await fetch(`${RIDER_API_BASE}/api/messages/conversations`, {
        headers: this._getHeaders(),
      });
      const data = await res.json();

      if (data.success && data.data && data.data.length > 0) {
        container.innerHTML = data.data
          .map((c) => {
            const name = c.other_user_name || "Customer";
            const initial = name.charAt(0).toUpperCase();
            const lastMsg = c.last_message || "No messages yet";
            const time = c.last_message_at
              ? this._timeAgo(c.last_message_at)
              : "";
            const unread = c.unread_count || 0;

            return `
                        <div class="conversation-item ${unread > 0 ? "unread" : ""}" data-conversation-id="${c.conversation_id}" data-request-id="${c.request_id || ""}" data-customer-name="${this._esc(name)}">
                            <div class="conv-avatar">${initial}</div>
                            <div class="conv-details">
                                <div class="conv-header">
                                    <span class="conv-name">${this._esc(name)}</span>
                                    <span class="conv-time">${time}</span>
                                </div>
                                <div class="conv-last-msg ${unread > 0 ? "unread" : ""}">${this._esc(lastMsg)}</div>
                            </div>
                            ${unread > 0 ? `<div class="conv-badge">${unread}</div>` : ""}
                        </div>
                    `;
          })
          .join("");

        // Add click handlers to open chat
        container.querySelectorAll(".conversation-item").forEach((item) => {
          item.addEventListener("click", () => {
            const convId = item.dataset.conversationId;
            const reqId = item.dataset.requestId;
            const custName = item.dataset.customerName;
            this._openConversation(convId, reqId, custName);
          });
        });
      } else {
        container.innerHTML =
          '<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No conversations</h3><p>Chat history will appear here</p></div>';
      }
    } catch (e) {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><h3>Error loading</h3><p>Please try again</p></div>';
    }
  }

  _openConversation(conversationId, requestId, customerName) {
    // Use the existing RiderChatManager if available and we have a request ID
    if (window.riderChatManager && requestId) {
      // Switch back to map panel first
      this.showPanel("riderMapPanel");
      // Set customer name and connect via the standard flow
      window.riderChatManager.customerName = customerName || "Customer";
      window.riderChatManager.setCustomerInfo(customerName || "Customer");
      window.riderChatManager.connect(parseInt(requestId));
    } else if (window.riderChatManager && conversationId) {
      // If we only have conversation_id but no request_id, load history directly
      this.showPanel("riderMapPanel");
      window.riderChatManager.conversationId = parseInt(conversationId);
      window.riderChatManager.customerName = customerName || "Customer";
      window.riderChatManager.setCustomerInfo(customerName || "Customer");
      window.riderChatManager.loadHistory();
      window.riderChatManager.openChat();
    } else {
      console.warn("RiderChatManager not available or no request ID");
    }
  }

  // ═══════ PROFILE ═══════
  _loadProfile() {
    const userData = localStorage.getItem("user_data");
    if (!userData) return;
    const user = JSON.parse(userData);
    this._setText("riderProfileName", user.full_name || "Rider");
    this._setText("riderProfileEmail", user.email || "");
    this._setText("riderProfilePhone", user.phone_number || "");

    // Load rider-specific data
    fetch(`${RIDER_API_BASE}/api/riders/profile`, {
      headers: this._getHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const rider = data.data || data;
        this._setText(
          "riderProfileRating",
          rider.rating ? parseFloat(rider.rating).toFixed(1) : "0.0",
        );
        this._setText("riderProfileTasks", rider.total_tasks_completed || 0);
      })
      .catch(() => {});
  }

  // ═══════ LOGOUT ═══════
  _logout() {
    if (
      confirm("Are you sure you want to logout? Location tracking will stop.")
    ) {
      if (this.notifPollInterval) clearInterval(this.notifPollInterval);
      if (window.riderTracker) window.riderTracker.stop();
      if (window.riderRequestHandler) window.riderRequestHandler.stop();
      if (window.riderMapController) window.riderMapController.stop();
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

  _esc(str) {
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
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

// Initialize
window.riderDashboardController = new RiderDashboardController();
