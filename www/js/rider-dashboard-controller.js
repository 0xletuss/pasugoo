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
      this._setupProfile();
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
    if (!window.riderChatManager) {
      console.warn("RiderChatManager not available");
      return;
    }

    // If the rider already has an active live-chat for a DIFFERENT request,
    // warn before switching.
    const currentReqId = window.riderChatManager.requestId;
    if (currentReqId && requestId && currentReqId !== parseInt(requestId)) {
      if (
        !confirm(
          "You have an active chat open. Switch to this conversation instead?",
        )
      ) {
        return;
      }
      // Disconnect the old one before connecting the new one
      window.riderChatManager.disconnect();
    }

    // Set customer info on the live chat panel
    window.riderChatManager.customerName = customerName || "Customer";
    window.riderChatManager.setCustomerInfo(customerName || "Customer");

    if (requestId) {
      // Connect via full flow (gets/creates conversation, loads history,
      // opens WebSocket, auto-opens panel). If the request is completed,
      // connect → fetchRequestDetails will detect it and auto-close,
      // but the user still gets to see the history briefly.
      window.riderChatManager.connect(parseInt(requestId));
    } else if (conversationId) {
      // Legacy / no request_id: load history read-only
      window.riderChatManager.conversationId = parseInt(conversationId);
      window.riderChatManager.loadHistory();
      window.riderChatManager.openChat();
    }
  }

  // ═══════ PROFILE ═══════
  _setupProfile() {
    // Avatar tap → file input
    this._bindClick("rProfAvatarWrap", () => {
      const inp = document.getElementById("rProfPhotoInput");
      if (inp) inp.click();
    });
    const photoInput = document.getElementById("rProfPhotoInput");
    if (photoInput) {
      photoInput.addEventListener("change", (e) => this._uploadProfilePhoto(e));
    }

    // Inline edit buttons
    document
      .querySelectorAll("#riderProfilePanel .prof-field-edit")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this._toggleFieldEdit(btn.dataset.field),
        );
      });

    // Save changes
    this._bindClick("rProfSaveBtn", () => this._saveProfileChanges());

    // Change password modal
    this._bindClick("rProfChangePassword", () =>
      this._showModal("riderPasswordOverlay"),
    );
    this._bindClick("rClosePasswordModal", () =>
      this._hideModal("riderPasswordOverlay"),
    );
    this._bindClick("rSubmitPasswordBtn", () => this._submitPasswordChange());

    // Preferences modal
    this._bindClick("rProfPreferences", () => {
      this._loadPreferences();
      this._showModal("riderPrefsOverlay");
    });
    this._bindClick("rClosePrefsModal", () =>
      this._hideModal("riderPrefsOverlay"),
    );
    this._bindClick("rSavePrefsBtn", () => this._savePreferences());

    // Close modals on overlay click
    ["riderPasswordOverlay", "riderPrefsOverlay"].forEach((id) => {
      const overlay = document.getElementById(id);
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) this._hideModal(id);
        });
      }
    });
  }

  async _loadProfile() {
    // Load from localStorage first (fast)
    const userData = localStorage.getItem("user_data");
    if (userData) {
      const user = JSON.parse(userData);
      this._populateProfile(user);
    }

    // Then fetch fresh data from API
    try {
      const res = await fetch(`${RIDER_API_BASE}/api/users/me`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const freshUser = await res.json();
        localStorage.setItem("user_data", JSON.stringify(freshUser));
        this._populateProfile(freshUser);
      }
    } catch (e) {
      /* use cached data */
    }

    // Load rider-specific data
    try {
      const res = await fetch(`${RIDER_API_BASE}/api/riders/profile`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const rider = data.data || data;
        this._setText(
          "rProfStatRating",
          rider.rating ? parseFloat(rider.rating).toFixed(1) : "0.0",
        );
        this._setText("rProfStatDeliveries", rider.total_tasks_completed || 0);
        this._setText(
          "rProfStatEarnings",
          `₱${parseFloat(rider.total_earnings || 0).toFixed(0)}`,
        );

        // Vehicle info
        this._setText("rProfValVehicle", rider.vehicle_type || "—");
        this._setText("rProfValPlate", rider.vehicle_plate || "—");
        this._setText("rProfValLicense", rider.license_number || "—");
      }
    } catch (e) {
      /* silent */
    }
  }

  _populateProfile(user) {
    this._setText("rProfHeroName", user.full_name || "Rider");
    this._setText("rProfHeroEmail", user.email || "");

    if (user.created_at) {
      const d = new Date(user.created_at);
      const mn = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      this._setText(
        "rProfHeroSince",
        `Rider since ${mn[d.getMonth()]} ${d.getFullYear()}`,
      );
    }

    // Avatar
    const img = document.getElementById("rProfAvatarImg");
    const placeholder = document.getElementById("rProfAvatarPlaceholder");
    if (user.profile_photo_url) {
      if (img) {
        img.src = user.profile_photo_url;
        img.style.display = "";
      }
      if (placeholder) placeholder.style.display = "none";
    } else {
      if (img) img.style.display = "none";
      if (placeholder) placeholder.style.display = "";
    }

    // Editable fields
    this._setText("rProfValName", user.full_name || "—");
    this._setText("rProfValPhone", user.phone_number || "—");
    this._setText("rProfValEmail", user.email || "—");
  }

  // ── Photo Upload ──
  async _uploadProfilePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("access_token");

    try {
      this._profToast("Uploading photo...");
      const res = await fetch(`${RIDER_API_BASE}/api/uploads/profile-photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        const img = document.getElementById("rProfAvatarImg");
        const placeholder = document.getElementById("rProfAvatarPlaceholder");
        if (img) {
          img.src = data.data.url;
          img.style.display = "";
        }
        if (placeholder) placeholder.style.display = "none";
        const ud = JSON.parse(localStorage.getItem("user_data") || "{}");
        ud.profile_photo_url = data.data.url;
        localStorage.setItem("user_data", JSON.stringify(ud));
        this._profToast("Photo updated!");
      } else {
        this._profToast("Upload failed");
      }
    } catch (err) {
      this._profToast("Upload error");
    }
  }

  // ── Inline Field Editing ──
  _toggleFieldEdit(field) {
    const fieldMap = {
      name: { val: "rProfValName", inp: "rProfInputName" },
      phone: { val: "rProfValPhone", inp: "rProfInputPhone" },
    };
    const f = fieldMap[field];
    if (!f) return;

    const valEl = document.getElementById(f.val);
    const inpEl = document.getElementById(f.inp);
    if (!valEl || !inpEl) return;

    if (inpEl.style.display === "none") {
      inpEl.value = valEl.textContent === "—" ? "" : valEl.textContent;
      inpEl.style.display = "";
      valEl.style.display = "none";
      inpEl.focus();
      const saveBtn = document.getElementById("rProfSaveBtn");
      if (saveBtn) saveBtn.style.display = "";
    } else {
      inpEl.style.display = "none";
      valEl.style.display = "";
    }
  }

  async _saveProfileChanges() {
    const nameInp = document.getElementById("rProfInputName");
    const phoneInp = document.getElementById("rProfInputPhone");

    const body = {};
    if (nameInp && nameInp.style.display !== "none" && nameInp.value.trim()) {
      body.full_name = nameInp.value.trim();
    }
    if (
      phoneInp &&
      phoneInp.style.display !== "none" &&
      phoneInp.value.trim()
    ) {
      body.phone_number = phoneInp.value.trim();
    }

    if (Object.keys(body).length === 0) {
      this._profToast("No changes to save");
      return;
    }

    try {
      const res = await fetch(`${RIDER_API_BASE}/api/users/me`, {
        method: "PUT",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const ud = JSON.parse(localStorage.getItem("user_data") || "{}");
        Object.assign(ud, body);
        localStorage.setItem("user_data", JSON.stringify(ud));

        if (body.full_name) {
          this._setText("rProfValName", body.full_name);
          this._setText("rProfHeroName", body.full_name);
        }
        if (body.phone_number)
          this._setText("rProfValPhone", body.phone_number);

        ["rProfInputName", "rProfInputPhone"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        });
        ["rProfValName", "rProfValPhone"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "";
        });
        const saveBtn = document.getElementById("rProfSaveBtn");
        if (saveBtn) saveBtn.style.display = "none";

        this._profToast("Profile updated!");
      } else {
        this._profToast(data.detail || "Update failed");
      }
    } catch (e) {
      this._profToast("Error saving changes");
    }
  }

  // ── Change Password ──
  async _submitPasswordChange() {
    const current = document.getElementById("rCurrentPasswordInput").value;
    const newPass = document.getElementById("rNewPasswordInput").value;
    const confirmPass = document.getElementById("rConfirmPasswordInput").value;

    if (!current || !newPass || !confirmPass) {
      this._profToast("Fill all fields");
      return;
    }
    if (newPass !== confirmPass) {
      this._profToast("Passwords don't match");
      return;
    }
    if (newPass.length < 6) {
      this._profToast("Password must be 6+ characters");
      return;
    }

    const btn = document.getElementById("rSubmitPasswordBtn");
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(`${RIDER_API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({ old_password: current, new_password: newPass }),
      });
      const data = await res.json();
      if (data.success) {
        this._hideModal("riderPasswordOverlay");
        document.getElementById("rCurrentPasswordInput").value = "";
        document.getElementById("rNewPasswordInput").value = "";
        document.getElementById("rConfirmPasswordInput").value = "";
        this._profToast("Password changed!");
      } else {
        this._profToast(data.detail || "Failed to change password");
      }
    } catch (e) {
      this._profToast("Error changing password");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Preferences ──
  _loadPreferences() {
    const prefs = JSON.parse(localStorage.getItem("rider_prefs") || "{}");
    const notif = document.getElementById("rPrefNotifications");
    const sounds = document.getElementById("rPrefSounds");
    const autoAccept = document.getElementById("rPrefAutoAccept");
    if (notif) notif.checked = prefs.notifications !== false;
    if (sounds) sounds.checked = prefs.sounds !== false;
    if (autoAccept) autoAccept.checked = !!prefs.autoAccept;
  }

  _savePreferences() {
    const prefs = {
      notifications:
        document.getElementById("rPrefNotifications")?.checked !== false,
      sounds: document.getElementById("rPrefSounds")?.checked !== false,
      autoAccept: document.getElementById("rPrefAutoAccept")?.checked || false,
    };
    localStorage.setItem("rider_prefs", JSON.stringify(prefs));
    this._hideModal("riderPrefsOverlay");
    this._profToast("Preferences saved!");
  }

  // ── Modal Helpers ──
  _showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("show");
  }

  _hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
  }

  _profToast(msg) {
    let t = document.getElementById("rProfToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "rProfToast";
      t.className = "prof-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
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
