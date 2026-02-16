// rider-chat.js - Rider Chat Manager with WebSocket
// ─────────────────────────────────────────────────────────────
// Handles real-time chat between rider and customer

const PASUGO_WS_BASE = "wss://pasugo.onrender.com";
const PASUGO_API_BASE = "https://pasugo.onrender.com";

class RiderChatManager {
  constructor() {
    this.ws = null;
    this.conversationId = null;
    this.requestId = null;
    this.customerId = null;
    this.customerName = "";
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
    this.pingInterval = null;
    this.typingTimeout = null;
    this.messageQueue = [];
    this.isOpen = false;
    this.unreadCount = 0;
    this.currentRequestStatus = null;
    this.currentRequestDetails = null;
    this.statusPollInterval = null;

    // DOM elements (will be set when panel is created)
    this.chatPanel = null;
    this.chatContainer = null;
    this.chatInput = null;
    this.customerStatus = null;

    console.log("🔧 RiderChatManager initialized");
  }

  // ── Initialize chat panel UI ─────────────────────────────
  initUI() {
    // Inject CSS styles
    this.injectStyles();

    // Create chat panel HTML
    this.createChatPanel();

    // Set up event listeners
    this.setupEventListeners();

    // Restore active request if any
    this.restoreActiveRequest();

    console.log("✅ Rider chat UI initialized");
  }

  // ── Restore active request on page reload ────────────────
  async restoreActiveRequest() {
    const savedRequestId = localStorage.getItem("active_request_id");
    const savedCustomerName = localStorage.getItem("active_request_customer");

    if (!savedRequestId) return;

    console.log(`🔄 [RiderChat] Restoring request ${savedRequestId}...`);

    try {
      // Verify the request is still active
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/requests/${savedRequestId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        console.log("📋 Request no longer exists, clearing state");
        this.clearActiveRequest();
        return;
      }

      const data = await res.json();
      const status = data.data?.status?.toLowerCase();

      // Check if request is completed or cancelled
      if (status === "completed" || status === "cancelled") {
        console.log(`📋 Request is ${status}, clearing state`);
        this.clearActiveRequest();
        return;
      }

      // Restore chat connection
      this.setCustomerInfo(savedCustomerName || "Customer");
      await this.connect(parseInt(savedRequestId, 10));
    } catch (e) {
      console.error("Failed to restore request:", e);
    }
  }

  clearActiveRequest() {
    localStorage.removeItem("active_request_id");
    localStorage.removeItem("active_request_customer");
    this.hideActiveTaskBanner();
  }

  injectStyles() {
    if (document.getElementById("rider-chat-styles")) return;

    const style = document.createElement("style");
    style.id = "rider-chat-styles";
    style.textContent = `
      /* Rider Chat Panel */
      .rider-chat-panel {
        position: fixed;
        bottom: calc(70px + env(safe-area-inset-bottom, 0px));
        left: 0;
        right: 0;
        height: 60vh;
        max-height: calc(100vh - 150px);
        background: #fff;
        border-top-left-radius: 25px;
        border-top-right-radius: 25px;
        box-shadow: 0 -5px 30px rgba(0,0,0,0.2);
        z-index: 50;
        display: flex;
        flex-direction: column;
        transform: translateY(100%);
        transition: transform 0.3s ease-out;
        pointer-events: none;
        visibility: hidden;
      }

      .rider-chat-panel.open {
        transform: translateY(0);
        pointer-events: auto;
        visibility: visible;
      }

      .rider-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        background: var(--primary-black);
        color: white;
        border-radius: 25px 25px 0 0;
      }

      .rider-chat-header .customer-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .rider-chat-header .customer-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--primary-yellow);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: var(--primary-black);
      }

      .rider-chat-header .customer-name {
        font-weight: 600;
        font-size: 14px;
      }

      .rider-chat-header .customer-status {
        font-size: 11px;
        opacity: 0.8;
      }

      .rider-chat-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 5px;
      }

      .rider-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        background: #f8f9fa;
        min-height: 120px;
      }

      .rider-chat-input-area {
        display: flex;
        gap: 10px;
        padding: 12px 15px;
        background: white;
        border-top: 1px solid #eee;
      }

      .rider-chat-input {
        flex: 1;
        padding: 12px 16px;
        border: 2px solid #eee;
        border-radius: 25px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }

      .rider-chat-input:focus {
        border-color: var(--primary-yellow);
      }

      .rider-chat-send {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--primary-yellow);
        border: none;
        color: var(--primary-black);
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }

      .rider-chat-send:hover {
        transform: scale(1.05);
      }

      .rider-chat-send:active {
        transform: scale(0.95);
      }

      /* Message bubbles */
      .rider-message-group {
        display: flex;
        margin-bottom: 10px;
      }

      .rider-message-group.rider {
        justify-content: flex-end;
      }

      .rider-message-group.customer {
        justify-content: flex-start;
      }

      .rider-message-bubble {
        max-width: 75%;
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.4;
        position: relative;
      }

      .rider-message-bubble.rider {
        background: var(--primary-yellow);
        color: var(--primary-black);
        border-bottom-right-radius: 6px;
      }

      .rider-message-bubble.customer {
        background: white;
        color: var(--primary-black);
        border-bottom-left-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .rider-msg-meta {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-left: 6px;
      }

      .rider-msg-time {
        font-size: 10px;
        opacity: 0.55;
        white-space: nowrap;
      }

      .rider-msg-status {
        font-size: 11px;
        opacity: 0.65;
      }

      .rider-chat-system-msg {
        text-align: center;
        margin: 8px auto;
        padding: 6px 14px;
        font-size: 12px;
        color: #999;
        background: rgba(0,0,0,0.05);
        border-radius: 12px;
        max-width: 75%;
      }

      /* Typing indicator */
      .rider-typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .rider-typing-dots span {
        width: 7px;
        height: 7px;
        background: #999;
        border-radius: 50%;
        animation: riderTypeBounce 1.2s infinite ease-in-out;
      }

      .rider-typing-dots span:nth-child(2) { animation-delay: .2s; }
      .rider-typing-dots span:nth-child(3) { animation-delay: .4s; }

      @keyframes riderTypeBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: .4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }

      /* Chat badge */
      .chat-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        min-width: 18px;
        height: 18px;
        background: #dc3545;
        color: white;
        font-size: 10px;
        font-weight: 700;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
      }

      .chat-badge.hidden {
        display: none;
      }

      /* Active task info */
      .active-task-banner {
        position: fixed;
        top: 65px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary-yellow);
        color: var(--primary-black);
        padding: 10px 20px;
        border-radius: 25px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        z-index: 40;
        display: none;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: transform 0.2s;
      }

      .active-task-banner:hover {
        transform: translateX(-50%) scale(1.02);
      }

      .active-task-banner.visible {
        display: flex;
      }

      /* Task Panel Styles */
      .rider-task-panel {
        background: #f8f9fa;
        border-bottom: 1px solid #eee;
        padding: 12px 15px;
        max-height: 150px;
        overflow-y: auto;
        flex-shrink: 0;
        transition: max-height 0.3s ease, padding 0.3s ease;
      }

      .rider-task-panel.collapsed {
        max-height: 45px;
        overflow: hidden;
        padding: 10px 15px;
      }

      .rider-task-panel.collapsed .task-items-list,
      .rider-task-panel.collapsed .task-meta,
      .rider-task-panel.collapsed .task-action-btns {
        display: none;
      }

      .task-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .task-panel-header h4 {
        margin: 0;
        font-size: 13px;
        color: #333;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .task-toggle-btn {
        background: none;
        border: none;
        font-size: 14px;
        color: #666;
        cursor: pointer;
        padding: 4px;
      }

      .task-items-list {
        background: white;
        border-radius: 10px;
        padding: 10px;
        font-size: 13px;
        line-height: 1.6;
        color: #333;
        margin-bottom: 10px;
      }

      .task-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 11px;
        color: #666;
        margin-bottom: 10px;
      }

      .task-meta span {
        background: #e9ecef;
        padding: 4px 8px;
        border-radius: 12px;
      }

      .task-action-btns {
        display: flex;
        gap: 8px;
      }

      .task-action-btn {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .task-action-btn.primary {
        background: #28a745;
        color: white;
      }

      .task-action-btn.secondary {
        background: #17a2b8;
        color: white;
      }

      .task-action-btn.complete {
        background: var(--primary-yellow);
        color: var(--primary-black);
      }

      .task-action-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      }

      .task-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .task-status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .task-status-badge.assigned {
        background: #ffc107;
        color: #000;
      }

      .task-status-badge.in_progress {
        background: #17a2b8;
        color: white;
      }

      .task-status-badge.completed {
        background: #28a745;
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  createChatPanel() {
    // Create chat panel container
    const panel = document.createElement("div");
    panel.className = "rider-chat-panel";
    panel.id = "riderChatPanel";
    panel.innerHTML = `
      <div class="rider-chat-header">
        <div class="customer-info">
          <div class="customer-avatar" id="chatCustomerAvatar">C</div>
          <div>
            <div class="customer-name" id="chatCustomerName">Customer</div>
            <div class="customer-status" id="chatCustomerStatus">Connecting...</div>
          </div>
        </div>
        <button class="rider-chat-close" id="closeChatBtn">
          <i class="fa-solid fa-chevron-down"></i>
        </button>
      </div>
      
      <!-- Task Panel -->
      <div class="rider-task-panel" id="riderTaskPanel">
        <div class="task-panel-header">
          <h4><i class="fa-solid fa-clipboard-list"></i> Task Details</h4>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="task-status-badge assigned" id="taskStatusBadge">Loading...</span>
            <button class="task-toggle-btn" id="taskToggleBtn" title="Toggle task details">
              <i class="fa-solid fa-chevron-up"></i>
            </button>
          </div>
        </div>
        <div class="task-items-list" id="taskItemsList">
          Loading task details...
        </div>
        <div class="task-meta" id="taskMeta"></div>
        <div class="task-action-btns" id="taskActionBtns">
          <button class="task-action-btn primary" id="startDeliveryBtn" disabled>
            <i class="fa-solid fa-truck"></i> Start Delivery
          </button>
        </div>
      </div>
      
      <div class="rider-chat-messages" id="riderChatMessages">
        <div class="rider-chat-system-msg">Loading messages...</div>
      </div>
      <div class="rider-chat-input-area">
        <input type="text" class="rider-chat-input" id="riderChatInput" 
               placeholder="Type a message..." autocomplete="off">
        <button class="rider-chat-send" id="riderChatSend">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    // Create active task banner
    const banner = document.createElement("div");
    banner.className = "active-task-banner";
    banner.id = "activeTaskBanner";
    banner.innerHTML = `
      <i class="fa-solid fa-shopping-bag"></i>
      <span id="activeTaskText">Active Task</span>
      <i class="fa-solid fa-comment-dots"></i>
    `;
    document.body.appendChild(banner);

    // Store references
    this.chatPanel = document.getElementById("riderChatPanel");
    this.chatContainer = document.getElementById("riderChatMessages");
    this.chatInput = document.getElementById("riderChatInput");
    this.customerStatus = document.getElementById("chatCustomerStatus");
  }

  setupEventListeners() {
    // Close button
    const closeBtn = document.getElementById("closeChatBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeChat());
    }

    // Send button
    const sendBtn = document.getElementById("riderChatSend");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendMessage());
    }

    // Enter key
    const input = document.getElementById("riderChatInput");
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.sendMessage();
      });
      input.addEventListener("input", () => this.startTyping());
    }

    // Message nav click
    const messageNav = document.getElementById("messageNav");
    if (messageNav) {
      messageNav.style.position = "relative";
      messageNav.addEventListener("click", (e) => {
        e.preventDefault();
        if (this.requestId) {
          this.toggleChat();
        } else {
          alert("No active request to chat about.");
        }
      });
    }

    // Active task banner click
    const banner = document.getElementById("activeTaskBanner");
    if (banner) {
      banner.addEventListener("click", () => this.openChat());
    }

    // Task action buttons
    const startDeliveryBtn = document.getElementById("startDeliveryBtn");
    if (startDeliveryBtn) {
      startDeliveryBtn.addEventListener("click", () => this.startDelivery());
    }

    const completeDeliveryBtn = document.getElementById("completeDeliveryBtn");
    if (completeDeliveryBtn) {
      completeDeliveryBtn.addEventListener("click", () =>
        this.completeDelivery(),
      );
    }

    // Task panel toggle
    const taskToggleBtn = document.getElementById("taskToggleBtn");
    if (taskToggleBtn) {
      taskToggleBtn.addEventListener("click", () => this.toggleTaskPanel());
    }
  }

  // ── Toggle task panel collapse ─────────────────────────────
  toggleTaskPanel() {
    const taskPanel = document.getElementById("riderTaskPanel");
    const toggleBtn = document.getElementById("taskToggleBtn");
    if (!taskPanel || !toggleBtn) return;

    taskPanel.classList.toggle("collapsed");
    const isCollapsed = taskPanel.classList.contains("collapsed");
    toggleBtn.innerHTML = isCollapsed
      ? '<i class="fa-solid fa-chevron-down"></i>'
      : '<i class="fa-solid fa-chevron-up"></i>';
  }

  // ── Connect to conversation ──────────────────────────────
  async connect(requestId) {
    this.requestId = requestId;
    console.log(`📱 [RiderChat] Connecting to request ${requestId}...`);

    try {
      const token = localStorage.getItem("access_token");

      // Get or create conversation
      const res = await fetch(`${PASUGO_API_BASE}/api/messages/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to get conversation");
      }

      const data = await res.json();
      this.conversationId = data.data.conversation_id;
      console.log(`✅ [RiderChat] Got conversation ${this.conversationId}`);

      // Load history and open WebSocket
      await this.loadHistory();
      this.openWS();

      // Show active task banner
      this.showActiveTaskBanner();

      // Fetch and display request details
      await this.fetchRequestDetails();

      // Start periodic status polling to detect external completions
      this.startStatusPolling();

      // Update badge on message nav
      this.updateChatBadge();
    } catch (err) {
      console.error("[RiderChat] connect error:", err);
      this.showSystem("Could not connect to chat: " + err.message);
    }
  }

  openWS() {
    const token = localStorage.getItem("access_token");
    if (!token || !this.conversationId) return;

    const url = `${PASUGO_WS_BASE}/api/messages/ws/${this.conversationId}?token=${token}`;
    console.log(`🔌 [RiderChat] Opening WebSocket...`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("✅ [RiderChat] WebSocket connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.setStatus("Online", "#4caf50");

      // Flush queued messages
      while (this.messageQueue.length) {
        this.ws.send(JSON.stringify(this.messageQueue.shift()));
      }

      // Keepalive ping
      this.pingInterval = setInterval(() => {
        if (this.isConnected) this.ws.send(JSON.stringify({ event: "ping" }));
      }, 30000);
    };

    this.ws.onmessage = (e) => {
      try {
        this.handleEvent(JSON.parse(e.data));
      } catch (err) {
        console.error("[RiderChat] parse error:", err);
      }
    };

    this.ws.onclose = (e) => {
      console.log("[RiderChat] WS closed:", e.code);
      this.isConnected = false;
      clearInterval(this.pingInterval);
      if (e.code !== 1000 && e.code !== 4001 && e.code !== 4003) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (e) => console.error("[RiderChat] WS error:", e);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.setStatus("Connection lost", "#dc3545");
      return;
    }
    this.reconnectAttempts++;
    this.setStatus("Reconnecting...", "#ff9800");
    setTimeout(() => this.openWS(), 2000 * this.reconnectAttempts);
  }

  disconnect() {
    console.log("🔌 [RiderChat] Disconnecting...");
    clearInterval(this.pingInterval);
    clearInterval(this.statusPollInterval);
    this.statusPollInterval = null;
    clearTimeout(this.typingTimeout);
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.isConnected = false;
    this.conversationId = null;
    this.requestId = null;
    this.currentRequestStatus = null;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.clearActiveRequest();
    this.closeChat();
  }

  // ── Periodic status polling (detects external status changes) ──
  startStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
    }
    this.statusPollInterval = setInterval(async () => {
      if (!this.requestId) {
        clearInterval(this.statusPollInterval);
        this.statusPollInterval = null;
        return;
      }
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(
          `${PASUGO_API_BASE}/api/requests/${this.requestId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const status = (data.data?.status || "").toLowerCase();

        if (status === "completed" || status === "cancelled") {
          console.log(
            `📋 [RiderChat] Request externally ${status}, auto-closing`,
          );
          this.showSystem(`This request has been ${status}.`);
          this.currentRequestDetails = data.data;
          this.updateTaskActionButtons(status);
          setTimeout(() => this.disconnect(), 2000);
          return;
        }

        // Update details if status changed (e.g. payment_status)
        if (data.data) {
          this.currentRequestDetails = data.data;
          if (this.currentRequestStatus !== status) {
            this.currentRequestStatus = status;
            this.updateTaskActionButtons(status);
          }
        }
      } catch (e) {
        // Silently ignore poll errors
      }
    }, 8000); // Poll every 8 seconds
  }

  // ── Fetch and display request details ────────────────────
  async fetchRequestDetails() {
    if (!this.requestId) return;

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/requests/${this.requestId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch request details");
      }

      const data = await res.json();
      const request = data.data;
      this.currentRequestDetails = request;

      const reqStatus = (request.status || "").toLowerCase();
      this.currentRequestStatus = request.status;

      // Auto-close chat if request is already completed or cancelled
      if (reqStatus === "completed" || reqStatus === "cancelled") {
        console.log(
          `📋 [RiderChat] Request is ${reqStatus}, auto-closing chat`,
        );
        this.showSystem(`This request has been ${reqStatus}.`);
        setTimeout(() => {
          this.disconnect();
        }, 1500);
        return;
      }

      this.displayTaskDetails(request);
      this.updateTaskActionButtons(request.status);

      // Update customer info
      const customerName = document.getElementById("chatCustomerName");
      if (customerName && request.customer_name) {
        customerName.textContent = request.customer_name;
      }
      const customerAvatar = document.getElementById("chatCustomerAvatar");
      if (customerAvatar && request.customer_name) {
        customerAvatar.textContent = request.customer_name
          .charAt(0)
          .toUpperCase();
      }
    } catch (err) {
      console.error("[RiderChat] fetchRequestDetails error:", err);
      const taskItemsList = document.getElementById("taskItemsList");
      if (taskItemsList) {
        taskItemsList.innerHTML = `<div style="color:#dc3545">Failed to load task details</div>`;
      }
    }
  }

  displayTaskDetails(request) {
    const taskItemsList = document.getElementById("taskItemsList");
    const taskMeta = document.getElementById("taskMeta");
    const taskStatusBadge = document.getElementById("taskStatusBadge");

    if (taskStatusBadge) {
      const statusText =
        request.status === "in_progress"
          ? "Delivering"
          : request.status.charAt(0).toUpperCase() + request.status.slice(1);
      taskStatusBadge.textContent = statusText;
      taskStatusBadge.className = `task-status-badge ${request.status}`;
    }

    if (taskItemsList) {
      // Format items/instructions
      const items =
        request.items_description ||
        request.special_instructions ||
        "No items specified";
      taskItemsList.innerHTML = `
        <div style="margin-bottom:8px"><strong>${this.getServiceIcon(request.service_type)} ${this.formatServiceType(request.service_type)}</strong></div>
        <div style="white-space:pre-wrap">${items}</div>
      `;
    }

    if (taskMeta) {
      const metaItems = [];
      if (request.budget_limit) {
        metaItems.push(
          `<span><i class="fa-solid fa-peso-sign"></i> ₱${parseFloat(request.budget_limit).toFixed(2)}</span>`,
        );
      }
      if (request.pickup_location) {
        metaItems.push(
          `<span><i class="fa-solid fa-location-dot"></i> ${this.truncateText(request.pickup_location, 30)}</span>`,
        );
      }
      if (request.delivery_address) {
        metaItems.push(
          `<span><i class="fa-solid fa-map-marker-alt"></i> ${this.truncateText(request.delivery_address, 30)}</span>`,
        );
      }
      taskMeta.innerHTML = metaItems.join("");
    }
  }

  updateTaskActionButtons(status) {
    const actionBtns = document.getElementById("taskActionBtns");
    if (!actionBtns) return;

    const req = this.currentRequestDetails || {};
    const hasBill = req.total_amount && req.total_amount > 0;
    const paymentMethod = req.payment_method || "cod";
    const paymentStatus = req.payment_status || "pending";

    if (status === "assigned") {
      let html = "";

      // Show bill form or bill summary
      if (!hasBill) {
        html += `
          <div class="bill-form-section" id="billFormSection">
            <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:#333">
              <i class="fa-solid fa-receipt"></i> Submit Bill to Customer
            </div>
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <div style="flex:1">
                <label style="font-size:11px;color:#666">Item Cost (₱)</label>
                <input type="number" id="billItemCost" placeholder="0.00" min="0" step="0.01"
                  style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:14px">
              </div>
              <div style="flex:1">
                <label style="font-size:11px;color:#666">Service Fee (₱)</label>
                <input type="number" id="billServiceFee" placeholder="0.00" min="0" step="0.01"
                  style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:14px">
              </div>
            </div>
            <div id="billTotalPreview" style="font-size:13px;color:#333;margin-bottom:8px;display:none">
              Total: <strong>₱<span id="billTotalValue">0.00</span></strong>
            </div>
            <button class="task-action-btn" id="submitBillBtn" style="background:#ff9800;color:#fff;margin-bottom:10px">
              <i class="fa-solid fa-paper-plane"></i> Send Bill to Customer
            </button>
          </div>
        `;
      } else {
        html += `
          <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:16px;margin-bottom:10px;font-family:monospace,sans-serif">
            <div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:10px;margin-bottom:10px">
              <div style="font-size:15px;font-weight:700;color:#333"><i class="fa-solid fa-receipt"></i> PASUGO</div>
              <div style="font-size:11px;color:#888">Transaction Receipt</div>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#555">
              <span>Item Cost</span>
              <span>₱${parseFloat(req.item_cost || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#555">
              <span>Service Fee</span>
              <span>₱${parseFloat(req.service_fee || 0).toFixed(2)}</span>
            </div>
            <div style="border-top:1px dashed #ccc;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:#333">
              <span>TOTAL</span>
              <span>₱${parseFloat(req.total_amount).toFixed(2)}</span>
            </div>
            <div style="text-align:center;margin-top:10px;padding-top:8px;border-top:1px dashed #ccc;font-size:11px;color:#888">
              Payment: ${paymentMethod === "gcash" ? "GCash" : "Cash on Delivery"}<br>
              Status: <span style="color:${paymentStatus === "confirmed" ? "#28a745" : paymentStatus === "submitted" ? "#1565c0" : "#ff9800"};font-weight:600">${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</span>
            </div>
          </div>
        `;
      }

      html += `
        <button class="task-action-btn primary" id="startDeliveryBtn">
          <i class="fa-solid fa-truck"></i> Done Shopping - Start Delivery
        </button>
      `;
      actionBtns.innerHTML = html;

      // Wire up bill form
      const itemCostInput = document.getElementById("billItemCost");
      const serviceFeeInput = document.getElementById("billServiceFee");
      const totalPreview = document.getElementById("billTotalPreview");
      const totalValue = document.getElementById("billTotalValue");

      const updateTotal = () => {
        const ic = parseFloat(itemCostInput?.value) || 0;
        const sf = parseFloat(serviceFeeInput?.value) || 0;
        if (totalPreview && totalValue) {
          totalPreview.style.display = ic + sf > 0 ? "block" : "none";
          totalValue.textContent = (ic + sf).toFixed(2);
        }
      };
      itemCostInput?.addEventListener("input", updateTotal);
      serviceFeeInput?.addEventListener("input", updateTotal);

      document
        .getElementById("submitBillBtn")
        ?.addEventListener("click", () => this.submitBill());
      document
        .getElementById("startDeliveryBtn")
        ?.addEventListener("click", () => this.startDelivery());
    } else if (status === "in_progress") {
      let html = "";

      // Show bill summary if submitted
      if (hasBill) {
        html += `
          <div style="background:#f0f7ff;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px">
            <div style="font-weight:600;color:#0066cc;margin-bottom:4px"><i class="fa-solid fa-receipt"></i> Bill Summary</div>
            <div>Items: ₱${parseFloat(req.item_cost).toFixed(2)} | Fee: ₱${parseFloat(req.service_fee).toFixed(2)}</div>
            <div style="font-weight:700;margin-top:2px">Total: ₱${parseFloat(req.total_amount).toFixed(2)}</div>
            <div style="color:#888;margin-top:2px">Payment: ${paymentMethod === "gcash" ? "GCash" : "COD"} | Status: <span id="paymentStatusText">${paymentStatus}</span></div>
          </div>
        `;
      }

      // GCash: show reference info if submitted
      if (paymentMethod === "gcash" && paymentStatus === "submitted") {
        html += `
          <div style="background:#e8f5e9;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px">
            <div style="font-weight:600;color:#2e7d32"><i class="fa-solid fa-mobile-screen-button"></i> GCash Payment Received</div>
            <div>Reference: <strong>${req.gcash_reference || "N/A"}</strong></div>
            ${req.gcash_screenshot_url ? `<div style="margin-top:6px"><img src="${req.gcash_screenshot_url}" style="max-width:100%;border-radius:8px;max-height:150px" onclick="window.open('${req.gcash_screenshot_url}')"></div>` : ""}
          </div>
        `;
      }

      // Confirm payment button (only if bill submitted but payment not yet confirmed)
      if (hasBill && paymentStatus !== "confirmed") {
        html += `
          <button class="task-action-btn" id="confirmPaymentBtn" style="background:#4caf50;color:#fff;margin-bottom:10px">
            <i class="fa-solid fa-check-double"></i> Confirm Payment Received
          </button>
        `;
      }

      if (paymentStatus === "confirmed") {
        html += `
          <div style="text-align:center;padding:6px;color:#28a745;font-weight:600;font-size:13px;margin-bottom:10px">
            <i class="fa-solid fa-check-circle"></i> Payment Confirmed!
          </div>
        `;
      }

      html += `
        <button class="task-action-btn complete" id="completeDeliveryBtn">
          <i class="fa-solid fa-check-circle"></i> Complete Delivery
        </button>
      `;
      actionBtns.innerHTML = html;

      document
        .getElementById("confirmPaymentBtn")
        ?.addEventListener("click", () => this.confirmPayment());
      document
        .getElementById("completeDeliveryBtn")
        ?.addEventListener("click", () => this.completeDelivery());
    } else if (status === "completed") {
      let html = "";
      if (hasBill) {
        html += `
          <div style="background:#f0f7ff;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px">
            <div>Total: <strong>₱${parseFloat(req.total_amount).toFixed(2)}</strong></div>
            <div style="color:#28a745"><i class="fa-solid fa-check-circle"></i> Payment ${paymentStatus}</div>
          </div>
        `;
      }
      html += `
        <div style="text-align:center;padding:10px;color:#28a745;font-weight:600">
          <i class="fa-solid fa-check-circle"></i> Task Completed!
        </div>
      `;
      actionBtns.innerHTML = html;
    } else {
      actionBtns.innerHTML = "";
    }
  }

  async startDelivery() {
    if (!this.requestId) return;

    const btn = document.getElementById("startDeliveryBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting...';
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/requests/${this.requestId}/start-delivery`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to start delivery");
      }

      const responseData = await res.json();

      this.currentRequestStatus = "in_progress";
      this.updateTaskActionButtons("in_progress");

      // Update status badge
      const taskStatusBadge = document.getElementById("taskStatusBadge");
      if (taskStatusBadge) {
        taskStatusBadge.textContent = "Delivering";
        taskStatusBadge.className = "task-status-badge in_progress";
      }

      // Send chat message
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            event: "send_message",
            content:
              "🚚 I've finished shopping and am now on my way to deliver your items!",
            message_type: "text",
          }),
        );
      }

      this.showSystem("Delivery started! On your way to the customer.");

      // Close chat and navigate to customer location
      this.closeChat();

      const customerLoc =
        responseData?.data?.customer_location ||
        this.currentRequestDetails?.customer_location;
      const customerName =
        responseData?.data?.customer_name ||
        this.currentRequestDetails?.customer_name ||
        "Customer";

      if (customerLoc?.latitude && customerLoc?.longitude) {
        // Use real GPS coordinates from the database
        console.log(
          `📍 Customer GPS: ${customerLoc.latitude}, ${customerLoc.longitude}`,
        );
        setTimeout(() => {
          if (window.riderMapController?.focusOnCoordinates) {
            window.riderMapController.focusOnCoordinates(
              customerLoc.latitude,
              customerLoc.longitude,
              customerName,
              customerLoc.address || "Customer Location",
            );
          }
        }, 300);
      } else {
        // Fallback: try text address geocoding
        const targetAddress =
          this.currentRequestDetails?.delivery_address ||
          this.currentRequestDetails?.pickup_location;
        if (
          targetAddress &&
          window.riderMapController?.focusOnDeliveryAddress
        ) {
          setTimeout(() => {
            window.riderMapController.focusOnDeliveryAddress(
              targetAddress,
              customerName,
              "Delivery Address",
            );
          }, 300);
        } else {
          // No GPS and no text address - alert the rider
          alert(
            `⚠️ Customer "${customerName}" has no saved location. ` +
              `Ask them to share their location in the chat, or contact them by phone.`,
          );
          console.warn(
            "[RiderChat] No customer location data available at all",
          );
        }
      }
    } catch (err) {
      console.error("[RiderChat] startDelivery error:", err);
      alert("Failed to start delivery: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-truck"></i> Done Shopping - Start Delivery';
      }
    }
  }

  async completeDelivery() {
    if (!this.requestId) return;

    // Confirm completion
    if (
      !confirm(
        "Are you sure you want to complete this delivery? Make sure you've received payment from the customer.",
      )
    ) {
      return;
    }

    const btn = document.getElementById("completeDeliveryBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Completing...';
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/requests/${this.requestId}/complete-delivery`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to complete delivery");
      }

      this.currentRequestStatus = "completed";
      this.updateTaskActionButtons("completed");

      // Update status badge
      const taskStatusBadge = document.getElementById("taskStatusBadge");
      if (taskStatusBadge) {
        taskStatusBadge.textContent = "Completed";
        taskStatusBadge.className = "task-status-badge completed";
      }

      // Send completion message
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            event: "send_message",
            content:
              "✅ Delivery completed! Thank you for using Pasugo. Have a great day!",
            message_type: "text",
          }),
        );
      }

      this.showSystem("Delivery completed successfully!");

      // Close chat after delay
      setTimeout(() => {
        alert("Task completed! Great job! 🎉");
        this.disconnect();
      }, 2000);
    } catch (err) {
      console.error("[RiderChat] completeDelivery error:", err);
      alert("Failed to complete delivery: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-check-circle"></i> Complete Delivery';
      }
    }
  }

  // ── Submit bill to customer ──────────────────────────────
  async submitBill() {
    if (!this.requestId) return;

    const itemCost = parseFloat(document.getElementById("billItemCost")?.value);
    const serviceFee = parseFloat(
      document.getElementById("billServiceFee")?.value,
    );

    if (!itemCost || itemCost <= 0) {
      alert("Please enter the item cost");
      return;
    }
    if (isNaN(serviceFee) || serviceFee < 0) {
      alert("Please enter a valid service fee");
      return;
    }

    const total = itemCost + serviceFee;
    if (
      !confirm(
        `Send bill to customer?\n\nItems: ₱${itemCost.toFixed(2)}\nService Fee: ₱${serviceFee.toFixed(2)}\nTotal: ₱${total.toFixed(2)}`,
      )
    ) {
      return;
    }

    const btn = document.getElementById("submitBillBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/requests/${this.requestId}/submit-bill`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_cost: itemCost,
            service_fee: serviceFee,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit bill");
      }

      const data = await res.json();

      // Update local state
      if (this.currentRequestDetails) {
        this.currentRequestDetails.item_cost = itemCost;
        this.currentRequestDetails.service_fee = serviceFee;
        this.currentRequestDetails.total_amount = total;
        this.currentRequestDetails.payment_status = "pending";
      }

      // Re-render buttons to show bill summary
      this.updateTaskActionButtons(this.currentRequestStatus);

      // Send chat message about the bill
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            event: "send_message",
            content: `💰 Bill Summary:\n• Item Cost: ₱${itemCost.toFixed(2)}\n• Service Fee: ₱${serviceFee.toFixed(2)}\n• Total: ₱${total.toFixed(2)}\n\nPlease prepare the payment.`,
            message_type: "text",
          }),
        );
      }

      this.showSystem("Bill sent to customer!");
    } catch (err) {
      console.error("[RiderChat] submitBill error:", err);
      alert("Failed to submit bill: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-paper-plane"></i> Send Bill to Customer';
      }
    }
  }

  // ── Confirm payment received ─────────────────────────────
  async confirmPayment() {
    if (!this.requestId) return;

    const paymentMethod = this.currentRequestDetails?.payment_method || "cod";
    const msg =
      paymentMethod === "gcash"
        ? "Confirm you received the GCash payment?"
        : "Confirm you received the cash payment?";

    if (!confirm(msg)) return;

    const btn = document.getElementById("confirmPaymentBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Confirming...';
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/requests/${this.requestId}/confirm-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to confirm payment");
      }

      const responseData = await res.json();

      // Update local state
      if (this.currentRequestDetails) {
        this.currentRequestDetails.payment_status = "confirmed";
      }

      // Check if delivery was auto-completed by backend
      if (responseData.data?.delivery_auto_completed) {
        this.currentRequestStatus = "completed";
        this.updateTaskActionButtons("completed");

        // Update status badge
        const taskStatusBadge = document.getElementById("taskStatusBadge");
        if (taskStatusBadge) {
          taskStatusBadge.textContent = "Completed";
          taskStatusBadge.className = "task-status-badge completed";
        }

        // Send completion chat message
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              event: "send_message",
              content:
                "✅ Payment confirmed and delivery completed! Thank you for using Pasugo. Have a great day!",
              message_type: "text",
            }),
          );
        }

        this.showSystem("Payment confirmed & delivery completed!");

        // Close chat after delay
        setTimeout(() => {
          alert("Task completed! Great job! 🎉");
          this.disconnect();
        }, 2000);
      } else {
        // Re-render buttons (payment only confirmed, delivery not auto-completed)
        this.updateTaskActionButtons(this.currentRequestStatus);

        // Send chat message
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              event: "send_message",
              content: "✅ Payment received and confirmed! Thank you.",
              message_type: "text",
            }),
          );
        }

        this.showSystem("Payment confirmed!");
      }
    } catch (err) {
      console.error("[RiderChat] confirmPayment error:", err);
      alert("Failed to confirm payment: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-check-double"></i> Confirm Payment Received';
      }
    }
  }

  // ── Helper methods ───────────────────────────────────────
  getServiceIcon(serviceType) {
    const icons = {
      pabili: "🛒",
      pasugo: "📦",
      pahatid: "🏍️",
    };
    return icons[serviceType?.toLowerCase()] || "📋";
  }

  formatServiceType(serviceType) {
    if (!serviceType) return "Service";
    return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  // ── Send message ─────────────────────────────────────────
  sendMessage() {
    const content = this.chatInput?.value?.trim();
    if (!content) return;

    const payload = {
      event: "send_message",
      content: content,
      message_type: "text",
    };

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
      this.scheduleReconnect();
    }

    this.chatInput.value = "";
    this.stopTyping();
  }

  // ── Typing indicators ────────────────────────────────────
  startTyping() {
    if (!this.isConnected) return;
    this.ws.send(JSON.stringify({ event: "typing_start" }));
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.stopTyping(), 3000);
  }

  stopTyping() {
    clearTimeout(this.typingTimeout);
    this.typingTimeout = null;
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: "typing_stop" }));
    }
  }

  // ── Mark messages read ───────────────────────────────────
  markRead(ids) {
    if (!this.isConnected || !ids?.length) return;
    this.ws.send(JSON.stringify({ event: "mark_read", message_ids: ids }));
  }

  // ── Load chat history ────────────────────────────────────
  async loadHistory() {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/messages/conversations/${this.conversationId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;

      const data = await res.json();
      const messages = data.data?.messages || [];

      this.chatContainer.innerHTML = "";
      if (!messages.length) {
        this.showSystem("Chat with your customer! 👋");
      } else {
        messages.forEach((m) => this.renderMessage(m));
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
      }

      // Mark unread
      const myId = this.getMyId();
      const unread = messages
        .filter((m) => m.sender_id !== myId)
        .map((m) => m.message_id);
      if (unread.length) this.markRead(unread);
    } catch (err) {
      console.error("[RiderChat] loadHistory error:", err);
    }
  }

  // ── Handle WebSocket events ──────────────────────────────
  handleEvent(data) {
    switch (data.event) {
      case "new_message":
        this.renderMessage(data);
        if (data.sender_id !== this.getMyId()) {
          this.unreadCount++;
          this.updateChatBadge();
          if (!this.isOpen) {
            this.playNotificationSound();
          }
        }
        this.markRead([data.message_id]);
        break;

      case "user_typing":
        this.handleTypingIndicator(data);
        break;

      case "messages_read":
        this.updateReadReceipts(data.message_ids);
        break;

      case "user_joined":
        if (data.user_id !== this.getMyId()) {
          this.setStatus("Online", "#4caf50");
        }
        break;

      case "user_left":
        if (data.user_id !== this.getMyId()) {
          this.setStatus("Offline", "#888");
        }
        break;

      case "pong":
        break;

      case "error":
        console.error("[RiderChat] server error:", data.message);
        break;
    }
  }

  // ── Render message bubble ────────────────────────────────
  renderMessage(msg) {
    if (!this.chatContainer) return;

    // Remove typing bubble
    this.chatContainer.querySelector(".rider-typing-bubble")?.remove();

    if (msg.message_type === "system") {
      this.showSystem(msg.content);
      return;
    }

    const myId = this.getMyId();
    const isOwn = msg.sender_id === myId;
    const time = msg.sent_at
      ? new Date(msg.sent_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    const group = document.createElement("div");
    group.className = `rider-message-group ${isOwn ? "rider" : "customer"}`;
    group.dataset.msgId = msg.message_id;
    group.innerHTML = `
      <div class="rider-message-bubble ${isOwn ? "rider" : "customer"}">
        ${this.escape(msg.content || "")}
        <span class="rider-msg-meta">
          <span class="rider-msg-time">${time}</span>
          ${isOwn ? `<span class="rider-msg-status" data-id="${msg.message_id}">✓</span>` : ""}
        </span>
      </div>
    `;

    this.chatContainer.appendChild(group);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  showSystem(text) {
    if (!this.chatContainer) return;
    const el = document.createElement("div");
    el.className = "rider-chat-system-msg";
    el.textContent = text;
    this.chatContainer.appendChild(el);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  // ── Typing indicator ─────────────────────────────────────
  handleTypingIndicator(data) {
    if (!this.chatContainer) return;
    const existing = this.chatContainer.querySelector(".rider-typing-bubble");

    if (data.is_typing && data.user_id !== this.getMyId()) {
      if (!existing) {
        const el = document.createElement("div");
        el.className = "rider-message-group customer rider-typing-bubble";
        el.innerHTML = `
          <div class="rider-message-bubble customer" style="padding:10px 14px">
            <span class="rider-typing-dots"><span></span><span></span><span></span></span>
          </div>
        `;
        this.chatContainer.appendChild(el);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
      }
      this.setStatus("typing...");
      clearTimeout(this._typingStatusReset);
      this._typingStatusReset = setTimeout(
        () => this.setStatus("Online", "#4caf50"),
        3500,
      );
    } else {
      existing?.remove();
    }
  }

  // ── Read receipts ────────────────────────────────────────
  updateReadReceipts(ids) {
    ids?.forEach((id) => {
      const el = this.chatContainer?.querySelector(
        `.rider-msg-status[data-id="${id}"]`,
      );
      if (el) {
        el.textContent = "✓✓";
        el.style.color = "#4fc3f7";
      }
    });
  }

  // ── UI Helpers ───────────────────────────────────────────
  setStatus(text, color = "") {
    if (this.customerStatus) {
      this.customerStatus.textContent = text;
      this.customerStatus.style.color = color;
    }
  }

  setCustomerInfo(name) {
    this.customerName = name;
    const nameEl = document.getElementById("chatCustomerName");
    const avatarEl = document.getElementById("chatCustomerAvatar");
    if (nameEl) nameEl.textContent = name || "Customer";
    if (avatarEl) avatarEl.textContent = (name || "C").charAt(0).toUpperCase();
  }

  openChat() {
    if (this.chatPanel) {
      this.chatPanel.classList.add("open");
      this.isOpen = true;
      this.unreadCount = 0;
      this.updateChatBadge();
      this.chatInput?.focus();
    }
  }

  closeChat() {
    if (this.chatPanel) {
      this.chatPanel.classList.remove("open");
      this.isOpen = false;
    }
  }

  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  showActiveTaskBanner() {
    const banner = document.getElementById("activeTaskBanner");
    if (banner) {
      banner.classList.add("visible");
      const text = document.getElementById("activeTaskText");
      if (text)
        text.textContent = `Chat with ${this.customerName || "Customer"}`;
    }
  }

  hideActiveTaskBanner() {
    const banner = document.getElementById("activeTaskBanner");
    if (banner) banner.classList.remove("visible");
  }

  updateChatBadge() {
    const messageNav = document.getElementById("messageNav");
    if (!messageNav) return;

    let badge = messageNav.querySelector(".chat-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "chat-badge hidden";
      messageNav.appendChild(badge);
    }

    if (this.unreadCount > 0 && !this.isOpen) {
      badge.textContent = this.unreadCount > 9 ? "9+" : this.unreadCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  playNotificationSound() {
    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 600;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }

  // ── Helpers ──────────────────────────────────────────────
  getMyId() {
    try {
      return JSON.parse(localStorage.getItem("user_data") || "{}").user_id;
    } catch {
      return null;
    }
  }

  escape(text) {
    const d = document.createElement("div");
    d.appendChild(document.createTextNode(text));
    return d.innerHTML;
  }
}

// ── Create global instance ─────────────────────────────────
window.riderChatManager = new RiderChatManager();

// ── Initialize on DOM ready ────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Only init if on rider dashboard
  const userData = localStorage.getItem("user_data");
  if (!userData) return;

  try {
    const user = JSON.parse(userData);
    const userType = String(user.user_type).toLowerCase();
    if (userType === "rider" || userType.includes("rider")) {
      window.riderChatManager.initUI();
    }
  } catch (e) {
    console.error("Failed to init rider chat:", e);
  }
});

console.log("✅ rider-chat.js loaded");
