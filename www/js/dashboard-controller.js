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
      this._setupProfile();
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
  _setupProfile() {
    // Avatar tap → file input
    this._bindClick("profAvatarWrap", () => {
      const inp = document.getElementById("profPhotoInput");
      if (inp) inp.click();
    });
    const photoInput = document.getElementById("profPhotoInput");
    if (photoInput) {
      photoInput.addEventListener("change", (e) => this._uploadProfilePhoto(e));
    }

    // Inline edit buttons
    document.querySelectorAll(".prof-field-edit").forEach((btn) => {
      btn.addEventListener("click", () =>
        this._toggleFieldEdit(btn.dataset.field),
      );
    });

    // Save changes
    this._bindClick("profSaveBtn", () => this._saveProfileChanges());

    // Change password modal
    this._bindClick("profChangePassword", () =>
      this._showModal("changePasswordOverlay"),
    );
    this._bindClick("closePasswordModal", () =>
      this._hideModal("changePasswordOverlay"),
    );
    this._bindClick("submitPasswordBtn", () => this._submitPasswordChange());

    // Preferences modal
    this._bindClick("profPreferences", () => {
      this._loadPreferences();
      this._showModal("preferencesOverlay");
    });
    this._bindClick("closePrefsModal", () =>
      this._hideModal("preferencesOverlay"),
    );
    this._bindClick("savePrefsBtn", () => this._savePreferences());

    // Address modal
    this._bindClick("profAddAddress", () => {
      this._resetAddressModal();
      this._showModal("addAddressOverlay");
    });
    this._bindClick("closeAddressModal", () =>
      this._hideModal("addAddressOverlay"),
    );
    this._bindClick("saveAddressBtn", () => this._saveAddress());

    // Address label chips
    document
      .querySelectorAll("#addAddressOverlay .prof-chip")
      .forEach((chip) => {
        chip.addEventListener("click", () => {
          document
            .querySelectorAll("#addAddressOverlay .prof-chip")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          const customInput = document.getElementById("addressLabelInput");
          if (chip.dataset.label === "Other") {
            if (customInput) customInput.style.display = "";
          } else {
            if (customInput) {
              customInput.style.display = "none";
              customInput.value = "";
            }
          }
        });
      });

    // Close modals on overlay click
    [
      "changePasswordOverlay",
      "preferencesOverlay",
      "addAddressOverlay",
    ].forEach((id) => {
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
      const res = await fetch(`${API_BASE}/api/users/me`, {
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

    // Load addresses
    this._loadAddresses();

    // Load quick stats
    this._loadProfileStats();
  }

  _populateProfile(user) {
    // Hero section
    this._setText("profHeroName", user.full_name || "Customer");
    this._setText("profHeroEmail", user.email || "");

    // Member since
    if (user.created_at) {
      const d = new Date(user.created_at);
      const monthNames = [
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
        "profHeroSince",
        `Member since ${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      );
    }

    // Avatar
    const img = document.getElementById("profAvatarImg");
    const placeholder = document.getElementById("profAvatarPlaceholder");
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
    this._setText("profValName", user.full_name || "—");
    this._setText("profValPhone", user.phone_number || "—");
    this._setText("profValAddress", user.address || "—");
    this._setText("profValEmail", user.email || "—");
  }

  async _loadProfileStats() {
    try {
      const res = await fetch(
        `${API_BASE}/api/requests/my-requests?page_size=999`,
        { headers: this._getHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        const orders = data.data || [];
        const completed = orders.filter(
          (o) => o.status === "completed" || o.status === "delivered",
        );
        const totalSpent = completed.reduce(
          (sum, o) => sum + parseFloat(o.total_amount || 0),
          0,
        );

        this._setText("profStatOrders", completed.length);
        this._setText("profStatSpent", `₱${totalSpent.toFixed(0)}`);
      }
    } catch (e) {
      /* silent */
    }

    try {
      const res = await fetch(`${API_BASE}/api/ratings/my-given-ratings`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        this._setText("profStatRated", data.data?.total_ratings || 0);
      }
    } catch (e) {
      this._setText("profStatRated", "—");
    }
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
      const res = await fetch(`${API_BASE}/api/uploads/profile-photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        const img = document.getElementById("profAvatarImg");
        const placeholder = document.getElementById("profAvatarPlaceholder");
        if (img) {
          img.src = data.data.url;
          img.style.display = "";
        }
        if (placeholder) placeholder.style.display = "none";
        // Update localStorage
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
      name: { val: "profValName", inp: "profInputName" },
      phone: { val: "profValPhone", inp: "profInputPhone" },
      address: { val: "profValAddress", inp: "profInputAddress" },
    };
    const f = fieldMap[field];
    if (!f) return;

    const valEl = document.getElementById(f.val);
    const inpEl = document.getElementById(f.inp);
    if (!valEl || !inpEl) return;

    if (inpEl.style.display === "none") {
      // Show input, hide value
      inpEl.value = valEl.textContent === "—" ? "" : valEl.textContent;
      inpEl.style.display = "";
      valEl.style.display = "none";
      inpEl.focus();
      // Show save button
      const saveBtn = document.getElementById("profSaveBtn");
      if (saveBtn) saveBtn.style.display = "";
    } else {
      // Hide input, show value
      inpEl.style.display = "none";
      valEl.style.display = "";
    }

    // Hide save button if no inputs visible
    this._checkSaveBtnVisibility();
  }

  _checkSaveBtnVisibility() {
    const anyEditing =
      document.querySelector('.prof-field-input[style=""]') ||
      document.querySelector('.prof-field-input:not([style*="none"])');
    const saveBtn = document.getElementById("profSaveBtn");
    // Always keep it visible if any field is being edited
    // (will be re-hidden after save)
  }

  async _saveProfileChanges() {
    const nameInp = document.getElementById("profInputName");
    const phoneInp = document.getElementById("profInputPhone");
    const addrInp = document.getElementById("profInputAddress");

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
    if (addrInp && addrInp.style.display !== "none" && addrInp.value.trim()) {
      body.address = addrInp.value.trim();
    }

    if (Object.keys(body).length === 0) {
      this._profToast("No changes to save");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PUT",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Update localStorage
        const ud = JSON.parse(localStorage.getItem("user_data") || "{}");
        Object.assign(ud, body);
        localStorage.setItem("user_data", JSON.stringify(ud));

        // Update display values & hide inputs
        if (body.full_name) {
          this._setText("profValName", body.full_name);
          this._setText("profHeroName", body.full_name);
        }
        if (body.phone_number) this._setText("profValPhone", body.phone_number);
        if (body.address) this._setText("profValAddress", body.address);

        // Hide all inputs
        ["profInputName", "profInputPhone", "profInputAddress"].forEach(
          (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
          },
        );
        ["profValName", "profValPhone", "profValAddress"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "";
        });
        const saveBtn = document.getElementById("profSaveBtn");
        if (saveBtn) saveBtn.style.display = "none";

        this._profToast("Profile updated!");
      } else {
        this._profToast(data.detail || "Update failed");
      }
    } catch (e) {
      this._profToast("Error saving changes");
    }
  }

  // ── Addresses ──
  async _loadAddresses() {
    const container = document.getElementById("profAddressList");
    if (!container) return;

    try {
      const res = await fetch(`${API_BASE}/api/addresses/`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const addrs = data.data || [];
        if (addrs.length === 0) {
          container.innerHTML =
            '<div class="prof-empty-mini">No saved addresses yet</div>';
          return;
        }
        container.innerHTML = addrs
          .map((a) => {
            const iconMap = { Home: "fa-house", Work: "fa-briefcase" };
            const icon = iconMap[a.label] || "fa-location-dot";
            return `
            <div class="prof-address-card" data-id="${a.address_id}">
              <div class="prof-address-icon"><i class="fa-solid ${icon}"></i></div>
              <div class="prof-address-body">
                <div class="prof-address-label">${this._escHtml(a.label)}</div>
                <div class="prof-address-text">${this._escHtml(a.address_text)}</div>
                ${a.is_default ? '<div class="prof-address-default">Default</div>' : ""}
              </div>
              <div class="prof-address-actions">
                <button onclick="window.dashCtrl._editAddress(${a.address_id})"><i class="fa-solid fa-pen"></i></button>
                <button class="danger" onclick="window.dashCtrl._deleteAddress(${a.address_id})"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>`;
          })
          .join("");
      }
    } catch (e) {
      container.innerHTML =
        '<div class="prof-empty-mini">Failed to load addresses</div>';
    }
  }

  _resetAddressModal() {
    document.getElementById("addressModalTitle").textContent = "Add Address";
    document.getElementById("addressTextInput").value = "";
    document.getElementById("editAddressId").value = "";
    document.getElementById("addressDefaultCheck").checked = false;
    const customLabel = document.getElementById("addressLabelInput");
    if (customLabel) {
      customLabel.value = "";
      customLabel.style.display = "none";
    }
    document
      .querySelectorAll("#addAddressOverlay .prof-chip")
      .forEach((c, i) => {
        c.classList.toggle("active", i === 0);
      });
  }

  async _editAddress(id) {
    try {
      const res = await fetch(`${API_BASE}/api/addresses/`, {
        headers: this._getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const addr = (data.data || []).find((a) => a.address_id === id);
        if (addr) {
          document.getElementById("addressModalTitle").textContent =
            "Edit Address";
          document.getElementById("addressTextInput").value =
            addr.address_text || "";
          document.getElementById("editAddressId").value = addr.address_id;
          document.getElementById("addressDefaultCheck").checked =
            !!addr.is_default;

          // Set chip
          const chips = document.querySelectorAll(
            "#addAddressOverlay .prof-chip",
          );
          let found = false;
          chips.forEach((c) => {
            const match = c.dataset.label === addr.label;
            c.classList.toggle("active", match);
            if (match) found = true;
          });
          if (!found) {
            chips.forEach((c) =>
              c.classList.toggle("active", c.dataset.label === "Other"),
            );
            const customLabel = document.getElementById("addressLabelInput");
            if (customLabel) {
              customLabel.style.display = "";
              customLabel.value = addr.label;
            }
          }

          this._showModal("addAddressOverlay");
        }
      }
    } catch (e) {
      this._profToast("Error loading address");
    }
  }

  async _saveAddress() {
    const activeChip = document.querySelector(
      "#addAddressOverlay .prof-chip.active",
    );
    let label = activeChip ? activeChip.dataset.label : "Home";
    if (label === "Other") {
      const custom = document.getElementById("addressLabelInput");
      label = custom && custom.value.trim() ? custom.value.trim() : "Other";
    }
    const addressText = document
      .getElementById("addressTextInput")
      .value.trim();
    const isDefault = document.getElementById("addressDefaultCheck").checked;
    const editId = document.getElementById("editAddressId").value;

    if (!addressText) {
      this._profToast("Please enter an address");
      return;
    }

    const body = { label, address_text: addressText, is_default: isDefault };

    try {
      let res;
      if (editId) {
        res = await fetch(`${API_BASE}/api/addresses/${editId}`, {
          method: "PUT",
          headers: this._getHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_BASE}/api/addresses/`, {
          method: "POST",
          headers: this._getHeaders(),
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (data.success || res.ok) {
        this._hideModal("addAddressOverlay");
        this._loadAddresses();
        this._profToast(editId ? "Address updated!" : "Address added!");
      } else {
        this._profToast(data.detail || "Failed to save");
      }
    } catch (e) {
      this._profToast("Error saving address");
    }
  }

  async _deleteAddress(id) {
    if (!confirm("Delete this address?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/addresses/${id}`, {
        method: "DELETE",
        headers: this._getHeaders(),
      });
      if (res.ok) {
        this._loadAddresses();
        this._profToast("Address deleted");
      }
    } catch (e) {
      this._profToast("Error deleting");
    }
  }

  // ── Change Password ──
  async _submitPasswordChange() {
    const current = document.getElementById("currentPasswordInput").value;
    const newPass = document.getElementById("newPasswordInput").value;
    const confirm = document.getElementById("confirmPasswordInput").value;

    if (!current || !newPass || !confirm) {
      this._profToast("Fill all fields");
      return;
    }
    if (newPass !== confirm) {
      this._profToast("Passwords don't match");
      return;
    }
    if (newPass.length < 6) {
      this._profToast("Password must be 6+ characters");
      return;
    }

    const btn = document.getElementById("submitPasswordBtn");
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({ old_password: current, new_password: newPass }),
      });
      const data = await res.json();
      if (data.success) {
        this._hideModal("changePasswordOverlay");
        document.getElementById("currentPasswordInput").value = "";
        document.getElementById("newPasswordInput").value = "";
        document.getElementById("confirmPasswordInput").value = "";
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
    const prefs = JSON.parse(localStorage.getItem("user_prefs") || "{}");
    const notif = document.getElementById("prefNotifications");
    const sounds = document.getElementById("prefSounds");
    const payment = document.getElementById("prefPayment");
    if (notif) notif.checked = prefs.notifications !== false;
    if (sounds) sounds.checked = prefs.sounds !== false;
    if (payment) payment.value = prefs.payment || "cod";
  }

  _savePreferences() {
    const prefs = {
      notifications:
        document.getElementById("prefNotifications")?.checked !== false,
      sounds: document.getElementById("prefSounds")?.checked !== false,
      payment: document.getElementById("prefPayment")?.value || "cod",
    };
    localStorage.setItem("user_prefs", JSON.stringify(prefs));
    this._hideModal("preferencesOverlay");
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
    let t = document.getElementById("profToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "profToast";
      t.className = "prof-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
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
window.dashCtrl = window.dashboardController;

// Also trigger rating modal after delivery completion
// (Called from request-modal.js when delivery completes)
window.showRatingModal = function (requestId) {
  if (window.dashboardController) {
    window.dashboardController.showRatingModal(requestId);
  }
};
