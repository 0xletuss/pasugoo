// request-modal.js - WITH REAL WEBSOCKET CHAT
// ─────────────────────────────────────────────────────────────
// WebSocket constants
const PASUGO_WS_BASE = "wss://pasugo.onrender.com";
const PASUGO_API_BASE = "https://pasugo.onrender.com";

// ─────────────────────────────────────────────────────────────
// WebSocket Chat Manager (embedded — no extra file needed)
// ─────────────────────────────────────────────────────────────
class ChatManager {
  constructor(controller) {
    this.ctrl = controller; // reference back to RequestModalController
    this.ws = null;
    this.conversationId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
    this.pingInterval = null;
    this.typingTimeout = null;
    this.messageQueue = [];
  }

  // ── Connect ──────────────────────────────────────────────
  async connect(requestId) {
    try {
      const token = localStorage.getItem("access_token");

      // 1. Get or create conversation for this request
      const res = await fetch(`${PASUGO_API_BASE}/api/messages/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (!res.ok) throw new Error("Failed to get conversation");
      const data = await res.json();
      this.conversationId = data.data.conversation_id;

      // 2. Load history first, then open WS
      await this.loadHistory();
      this.openWS();
    } catch (err) {
      console.error("[Chat] connect error:", err);
      this.showSystem("Could not connect to chat.");
    }
  }

  openWS() {
    const token = localStorage.getItem("access_token");
    if (!token || !this.conversationId) return;

    const url = `${PASUGO_WS_BASE}/api/messages/ws/${this.conversationId}?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[Chat] WS connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.setStatus("Online", "#4caf50");
      setTimeout(() => this.setStatus("On the way"), 2000);

      // Flush queued messages
      while (this.messageQueue.length) {
        this.ws.send(JSON.stringify(this.messageQueue.shift()));
      }

      // Keepalive ping every 30s
      this.pingInterval = setInterval(() => {
        if (this.isConnected) this.ws.send(JSON.stringify({ event: "ping" }));
      }, 30000);
    };

    this.ws.onmessage = (e) => {
      try {
        this.handleEvent(JSON.parse(e.data));
      } catch (err) {
        console.error("[Chat] parse error:", err);
      }
    };

    this.ws.onclose = (e) => {
      console.log("[Chat] WS closed:", e.code);
      this.isConnected = false;
      clearInterval(this.pingInterval);
      if (e.code !== 1000 && e.code !== 4001 && e.code !== 4003) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (e) => console.error("[Chat] WS error:", e);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.showSystem("Connection lost. Please refresh.");
      return;
    }
    this.reconnectAttempts++;
    this.setStatus("Reconnecting...", "#ff9800");
    setTimeout(() => this.openWS(), 2000 * this.reconnectAttempts);
  }

  disconnect() {
    clearInterval(this.pingInterval);
    clearTimeout(this.typingTimeout);
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.isConnected = false;
    this.conversationId = null;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  // ── Send ─────────────────────────────────────────────────
  send(content) {
    if (!content?.trim()) return;
    const payload = {
      event: "send_message",
      content: content.trim(),
      message_type: "text",
    };
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
      this.scheduleReconnect();
    }
    this.stopTyping();
  }

  // ── Typing ───────────────────────────────────────────────
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

  // ── Mark read ────────────────────────────────────────────
  markRead(ids) {
    if (!this.isConnected || !ids?.length) return;
    this.ws.send(JSON.stringify({ event: "mark_read", message_ids: ids }));
  }

  // ── Load history ─────────────────────────────────────────
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
      const container = this.ctrl.chatContainer;
      if (!container) return;

      container.innerHTML = "";
      if (!messages.length) {
        this.showSystem("Say hello to your rider! 👋");
      } else {
        messages.forEach((m) => this.renderMessage(m));
        container.scrollTop = container.scrollHeight;
      }

      // Mark unread
      const myId = this.getMyId();
      const unread = messages
        .filter((m) => m.sender_id !== myId)
        .map((m) => m.message_id);
      if (unread.length) this.markRead(unread);
    } catch (err) {
      console.error("[Chat] loadHistory error:", err);
    }
  }

  // ── Handle incoming WS event ─────────────────────────────
  handleEvent(data) {
    switch (data.event) {
      case "new_message":
        this.renderMessage(data);
        this.markRead([data.message_id]);
        break;
      case "user_typing":
        this.handleTypingIndicator(data);
        break;
      case "messages_read":
        this.updateReadReceipts(data.message_ids);
        break;
      case "user_joined":
        if (data.user_id !== this.getMyId()) this.setStatus("On the way");
        break;
      case "user_left":
        if (data.user_id !== this.getMyId()) this.setStatus("Offline", "#888");
        break;
      case "pong":
        break;
      case "error":
        console.error("[Chat] server error:", data.message);
        break;
    }
  }

  // ── Render message bubble ────────────────────────────────
  renderMessage(msg) {
    const container = this.ctrl.chatContainer;
    if (!container) return;

    // Remove typing bubble before adding real message
    container.querySelector(".typing-indicator-bubble")?.remove();

    if (msg.message_type === "system") {
      this.showSystem(msg.content);
      return;
    }

    const isOwn = msg.sender_id === this.getMyId();
    const time = msg.sent_at
      ? new Date(msg.sent_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    const group = document.createElement("div");
    group.className = `message-group ${isOwn ? "customer" : "rider"}`;
    group.dataset.msgId = msg.message_id;
    group.innerHTML = `
      <div class="message-bubble ${isOwn ? "customer" : "rider"}">
        ${this.escape(msg.content || "")}
        <span class="msg-meta">
          <span class="msg-time">${time}</span>
          ${isOwn ? `<span class="msg-status" data-id="${msg.message_id}">✓</span>` : ""}
        </span>
      </div>`;

    container.appendChild(group);
    container.scrollTop = container.scrollHeight;
  }

  showSystem(text) {
    const container = this.ctrl.chatContainer;
    if (!container) return;
    const el = document.createElement("div");
    el.className = "chat-system-msg";
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // ── Typing indicator ─────────────────────────────────────
  handleTypingIndicator(data) {
    const container = this.ctrl.chatContainer;
    if (!container) return;
    const existing = container.querySelector(".typing-indicator-bubble");

    if (data.is_typing && data.user_id !== this.getMyId()) {
      if (!existing) {
        const el = document.createElement("div");
        el.className = "message-group rider typing-indicator-bubble";
        el.innerHTML = `
          <div class="message-bubble rider" style="padding:10px 14px">
            <span class="typing-dots"><span></span><span></span><span></span></span>
          </div>`;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
      }
      this.setStatus("typing...");
      clearTimeout(this._typingStatusReset);
      this._typingStatusReset = setTimeout(
        () => this.setStatus("On the way"),
        3500,
      );
    } else {
      existing?.remove();
    }
  }

  // ── Read receipts ────────────────────────────────────────
  updateReadReceipts(ids) {
    ids?.forEach((id) => {
      const el = document.querySelector(`.msg-status[data-id="${id}"]`);
      if (el) {
        el.textContent = "✓✓";
        el.style.color = "#4fc3f7";
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  setStatus(text, color = "") {
    const el = this.ctrl.riderStatus;
    if (el) {
      el.textContent = text;
      el.style.color = color;
    }
  }

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

// ── Inject chat CSS ────────────────────────────────────────
(function injectChatStyles() {
  const s = document.createElement("style");
  s.textContent = `
    .chat-system-msg {
      text-align: center;
      margin: 8px auto;
      padding: 6px 14px;
      font-size: 12px;
      color: #999;
      background: rgba(0,0,0,0.05);
      border-radius: 12px;
      max-width: 75%;
    }
    .msg-meta {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 6px;
    }
    .msg-time  { font-size: 10px; opacity: 0.55; white-space: nowrap; }
    .msg-status { font-size: 11px; opacity: 0.65; }
    .typing-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .typing-dots span {
      width: 7px; height: 7px;
      background: #999;
      border-radius: 50%;
      animation: tdBounce 1.2s infinite ease-in-out;
    }
    .typing-dots span:nth-child(2) { animation-delay: .2s; }
    .typing-dots span:nth-child(3) { animation-delay: .4s; }
    @keyframes tdBounce {
      0%,60%,100% { transform: translateY(0); opacity: .4; }
      30%          { transform: translateY(-6px); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
})();

// ─────────────────────────────────────────────────────────────
// RequestModalController
// ─────────────────────────────────────────────────────────────
class RequestModalController {
  constructor() {
    this.currentStep = 1;
    this.maxSteps = 3;
    this.formData = {
      serviceType: null,
      vehicleType: null,
      billPhotos: [],
      attachedFiles: [],
      pickupItems: [],
      pickupLocation: "",
      deliveryOption: "current-location",
      deliveryAddress: "",
      items: "",
      budget: 0,
      instructions: "",
      location: null,
    };
    this.isWaiting = false;
    this.waitingTimer = 0;
    this.waitingTimerId = null;
    this.statusPollInterval = null;
    this.deliveryStatusPollInterval = null;
    this.requestId = null;
    this.requestStatus = null; // Track current status: null, 'waiting', 'shopping', 'delivering', 'completed'
    this.chat = new ChatManager(this); // ✅ real WebSocket chat

    if (typeof pasugoAPI === "undefined") {
      console.error("❌ pasugoAPI not found!");
      return;
    }
    this.init();

    // Restore active request state on page load
    this.restoreActiveRequest();
  }

  init() {
    if (!this.initElements()) return;
    this.setupEventListeners();
    console.log("✅ RequestModalController initialized");
  }

  initElements() {
    const ids = [
      "requestModalOverlay",
      "requestModal",
      "closeRequestBtn",
      "step1",
      "step2",
      "step3",
      "step1Indicator",
      "step2Indicator",
      "step3Indicator",
      "formTitle",
      "vehicleSection",
      "billPhotoSection",
      "photoUploadArea",
      "billPhotoInput",
      "photoPreviewContainer",
      "fileUploadSection",
      "fileUploadArea",
      "generalFileInput",
      "filePreviewContainer",
      "itemsList",
      "budgetLimit",
      "budgetSection",
      "instructions",
      "itemsLabel",
      "itemsHelper",
      "groceriesItemsForm",
      "itemsContainer",
      "addItemBtn",
      "pickDeliverForm",
      "pickupItemsContainer",
      "addPickupItemBtn",
      "pickupLocation",
      "currentLocationDisplay",
      "deliveryAddress",
      "step1Next",
      "step2Title",
      "step2Back",
      "step2Next",
      "step3Back",
      "submitRequest",
      "confService",
      "confVehicleItem",
      "confVehicle",
      "confItems",
      "confBudget",
      "confLocation",
      "waitingModal",
      "closeWaitingBtn",
      "cancelRequestBtn",
      "waitingStatus",
      "waitingTime",
      "chatModal",
      "closeChatBtn",
      "messageInput",
      "sendMessageBtn",
      "chatContainer",
      "riderName",
      "riderStatus",
      "riderCallBtn",
    ];

    ids.forEach((id) => (this[id] = document.getElementById(id)));

    this.formSteps = { 1: this.step1, 2: this.step2, 3: this.step3 };
    this.stepIndicators = {
      1: this.step1Indicator,
      2: this.step2Indicator,
      3: this.step3Indicator,
    };
    this.serviceCards = document.querySelectorAll(".service-card");
    this.vehicleCards = document.querySelectorAll(".vehicle-card");
    this.deliveryRadioButtons = document.querySelectorAll(
      'input[name="deliveryOption"]',
    );
    this.waitingModalOverlay = document.querySelectorAll(
      ".waiting-modal-overlay",
    )[0];
    this.chatModalOverlay = document.querySelectorAll(".chat-modal-overlay")[0];
    this.modalBackdrop = document.querySelectorAll(".modal-backdrop")[0];

    return !!this.requestModalOverlay;
  }

  setupEventListeners() {
    const navFab = document.querySelector(".nav-fab");
    if (navFab)
      navFab.addEventListener("click", (e) => {
        e.preventDefault();
        this.openRequestModal();
      });

    this.closeRequestBtn?.addEventListener("click", () =>
      this.closeRequestModal(),
    );
    this.closeWaitingBtn?.addEventListener("click", () =>
      this.closeWaitingModal(),
    );
    this.closeChatBtn?.addEventListener("click", () => this.closeChatModal());
    this.modalBackdrop?.addEventListener(
      "click",
      () => !this.isWaiting && this.closeRequestModal(),
    );

    this.serviceCards.forEach((c) =>
      c.addEventListener("click", () => this.selectService(c)),
    );
    this.vehicleCards.forEach((c) =>
      c.addEventListener("click", () => this.selectVehicle(c)),
    );

    // Photo upload
    this.photoUploadArea?.addEventListener("click", () =>
      this.billPhotoInput.click(),
    );
    this.photoUploadArea?.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.photoUploadArea.classList.add("active");
    });
    this.photoUploadArea?.addEventListener("dragleave", () =>
      this.photoUploadArea.classList.remove("active"),
    );
    this.photoUploadArea?.addEventListener("drop", (e) => {
      e.preventDefault();
      this.photoUploadArea.classList.remove("active");
      this.handlePhotoUpload(e.dataTransfer.files);
    });
    this.billPhotoInput?.addEventListener("change", (e) =>
      this.handlePhotoUpload(e.target.files),
    );

    // File upload
    this.fileUploadArea?.addEventListener("click", () =>
      this.generalFileInput.click(),
    );
    this.fileUploadArea?.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.fileUploadArea.classList.add("active");
    });
    this.fileUploadArea?.addEventListener("dragleave", () =>
      this.fileUploadArea.classList.remove("active"),
    );
    this.fileUploadArea?.addEventListener("drop", (e) => {
      e.preventDefault();
      this.fileUploadArea.classList.remove("active");
      this.handleFileUpload(e.dataTransfer.files);
    });
    this.generalFileInput?.addEventListener("change", (e) =>
      this.handleFileUpload(e.target.files),
    );

    this.addItemBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      this.addItemField();
    });
    this.addPickupItemBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      this.addPickupItemField();
    });

    this.deliveryRadioButtons.forEach((radio) =>
      radio.addEventListener("change", (e) => {
        this.formData.deliveryOption = e.target.value;
        this.deliveryAddress.style.display =
          e.target.value === "custom-address" ? "block" : "none";
        if (e.target.value !== "custom-address") {
          this.deliveryAddress.value = "";
          this.formData.deliveryAddress = "";
        }
      }),
    );

    this.step1Next?.addEventListener("click", () => this.nextStep());
    this.step2Back?.addEventListener("click", () => this.prevStep());
    this.step2Next?.addEventListener("click", () => this.nextStep());
    this.step3Back?.addEventListener("click", () => this.prevStep());
    this.submitRequest?.addEventListener("click", () =>
      this.submitNewRequest(),
    );
    this.cancelRequestBtn?.addEventListener("click", () =>
      this.cancelRequest(),
    );

    // ✅ Real send + typing
    this.sendMessageBtn?.addEventListener("click", () => this.sendMessage());
    this.messageInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.messageInput?.addEventListener("input", () => this.chat.startTyping());

    this.riderCallBtn?.addEventListener("click", () =>
      alert("Calling rider feature - integrate with Twilio"),
    );
  }

  // ── Modal open/close ──────────────────────────────────────
  openRequestModal() {
    // If there's an active request, don't show form - show appropriate modal
    if (this.requestId && this.requestStatus) {
      if (this.requestStatus === "waiting") {
        this.openWaitingModal();
        this.startPollingForRiderResponse();
        return;
      } else if (
        this.requestStatus === "shopping" ||
        this.requestStatus === "delivering"
      ) {
        this.openChatModal();
        return;
      }
    }

    this.requestModalOverlay.style.display = "flex";
    this.modalBackdrop?.classList.add("active");
    // Only reset if no active request
    if (!this.requestId) {
      this.resetForm();
    }
  }

  closeRequestModal() {
    this.requestModalOverlay.classList.add("closing");
    setTimeout(() => {
      this.requestModalOverlay.style.display = "none";
      this.requestModalOverlay.classList.remove("closing");
      this.modalBackdrop?.classList.remove("active");
    }, 300);
    // Don't clear state - just hide the modal
  }

  openWaitingModal() {
    this.requestModalOverlay.style.display = "none";
    this.waitingModalOverlay.style.display = "flex";
    this.modalBackdrop?.classList.add("active");
    this.isWaiting = true;
  }

  closeWaitingModal() {
    this.waitingModalOverlay.style.display = "none";
    this.modalBackdrop?.classList.remove("active");
    this.isWaiting = false;
    this.stopWaitingTimer();
  }

  openChatModal() {
    this.waitingModalOverlay.style.display = "none";
    this.chatModalOverlay.style.display = "flex";
    this.modalBackdrop?.classList.add("active");
  }

  // Just minimize the chat modal - don't disconnect unless delivery is complete
  closeChatModal() {
    this.chatModalOverlay.style.display = "none";
    this.modalBackdrop?.classList.remove("active");
    // DON'T disconnect - keep chat running in background
    // Chat will be disconnected when request is completed/cancelled
  }

  // Fully close chat and clear everything (call when delivery is done)
  completeDelivery() {
    this.stopDeliveryStatusPolling();
    this.chat.disconnect();
    this.clearRequestState();
    this.resetForm();
    this.chatModalOverlay.style.display = "none";
    this.modalBackdrop?.classList.remove("active");
  }

  // ── Steps ─────────────────────────────────────────────────
  nextStep() {
    if (this.validateStep(this.currentStep) && this.currentStep < this.maxSteps)
      this.goToStep(this.currentStep + 1);
  }

  prevStep() {
    if (this.currentStep > 1) this.goToStep(this.currentStep - 1);
  }

  goToStep(n) {
    this.formSteps[this.currentStep].classList.remove("active");
    this.stepIndicators[this.currentStep].classList.remove("active");
    if (n > this.currentStep)
      this.stepIndicators[this.currentStep].classList.add("completed");

    this.currentStep = n;
    this.formSteps[n].classList.add("active");
    this.stepIndicators[n].classList.add("active");

    const titles = ["", "Select Service", "Add Details", "Confirm Request"];
    this.formTitle.textContent = titles[n];
    this.requestModal.scrollTop = 0;
  }

  validateStep(step) {
    switch (step) {
      case 1:
        if (!this.formData.serviceType) {
          alert("Please select a service type");
          return false;
        }
        return true;
      case 2:
        if (
          this.formData.serviceType === "pickup" &&
          !this.formData.vehicleType
        ) {
          alert("Please select a vehicle type");
          return false;
        }
        if (
          this.formData.serviceType === "bills" &&
          !this.formData.billPhotos.length
        ) {
          alert("Please upload at least one bill photo");
          return false;
        }
        if (this.formData.serviceType === "delivery") {
          const pickupItems = this.getPickupItems();
          if (!pickupItems.trim()) {
            alert("Please add at least one item");
            return false;
          }
          if (!this.pickupLocation.value.trim()) {
            alert("Please enter pickup location");
            return false;
          }
          if (
            this.formData.deliveryOption === "custom-address" &&
            !this.deliveryAddress.value.trim()
          ) {
            alert("Please enter delivery address");
            return false;
          }
          this.formData.pickupItems = pickupItems;
          this.formData.pickupLocation = this.pickupLocation.value.trim();
          this.formData.deliveryAddress = this.deliveryAddress.value.trim();
          this.formData.items = `Pick from: ${this.formData.pickupLocation} | Items: ${pickupItems}`;
          return true;
        }
        let itemsText =
          this.formData.serviceType === "groceries"
            ? this.getGroceriesItems()
            : this.itemsList.value.trim();
        if (!itemsText.trim()) {
          alert("Please add at least one item");
          return false;
        }
        this.formData.items = itemsText;
        this.formData.budget = parseFloat(this.budgetLimit.value) || 0;
        this.formData.instructions = this.instructions.value.trim();
        return true;
      default:
        return true;
    }
  }

  // ── Service / Vehicle selection ───────────────────────────
  selectService(card) {
    this.serviceCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    this.formData.serviceType = card.dataset.service;
    this.step1Next.disabled = false;

    const config = {
      groceries: {
        title: "What groceries do you need?",
        label: "Items List",
        placeholder: "E.g., 2kg rice, 1L milk...",
        helper: "List all items you need",
      },
      bills: {
        title: "Which bills do you need to pay?",
        label: "Bills to Pay",
        placeholder: "E.g., Electricity, Water...",
        helper: "List which bills need to be paid",
      },
      delivery: {
        title: "What needs to be picked up & delivered?",
        label: "Items to Deliver",
        placeholder: "E.g., Documents, Package...",
        helper: "What needs to be picked up?",
      },
      pharmacy: {
        title: "What items do you need from pharmacy?",
        label: "Pharmacy Items",
        placeholder: "E.g., Paracetamol...",
        helper: "List pharmacy items",
      },
      pickup: {
        title: "Where would you like to go?",
        label: "Destination",
        placeholder: "E.g., SM Mall, Airport...",
        helper: "Where to pick you up and go?",
      },
      documents: {
        title: "Which documents do you need to process?",
        label: "Documents Needed",
        placeholder: "E.g., Birth certificate...",
        helper: "What documents to process?",
      },
    };

    const c = config[this.formData.serviceType];
    this.step2Title.textContent = c.title;
    this.itemsLabel.textContent = c.label;
    this.itemsList.placeholder = c.placeholder;
    this.itemsHelper.textContent = c.helper;

    this.vehicleSection.style.display =
      this.formData.serviceType === "pickup" ? "block" : "none";
    this.billPhotoSection.style.display =
      this.formData.serviceType === "bills" ? "block" : "none";
    this.fileUploadSection.style.display =
      this.formData.serviceType !== "bills" ? "block" : "none";

    if (this.formData.serviceType === "groceries") {
      this.budgetSection.style.display = "block";
      this.groceriesItemsForm.style.display = "block";
      this.itemsList.style.display = "none";
      this.itemsHelper.style.display = "none";
      this.pickDeliverForm.style.display = "none";
      if (!this.itemsContainer.children.length) this.addItemField();
    } else if (this.formData.serviceType === "delivery") {
      this.budgetSection.style.display = "none";
      this.groceriesItemsForm.style.display = "none";
      this.pickDeliverForm.style.display = "block";
      this.itemsList.style.display = "none";
      this.itemsHelper.style.display = "none";
      const loc = document.getElementById("locationName");
      if (loc) this.currentLocationDisplay.textContent = loc.textContent;
      if (!this.pickupItemsContainer.children.length) this.addPickupItemField();
    } else {
      this.budgetSection.style.display = "none";
      this.groceriesItemsForm.style.display = "none";
      this.pickDeliverForm.style.display = "none";
      this.itemsList.style.display = "block";
      this.itemsHelper.style.display = "block";
    }
  }

  selectVehicle(card) {
    this.vehicleCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    this.formData.vehicleType = card.dataset.vehicle;
  }

  // ── Item fields ───────────────────────────────────────────
  addItemField() {
    const num = this.itemsContainer.children.length + 1;
    const group = document.createElement("div");
    group.className = "item-input-group";
    group.innerHTML = `<label>Item ${num}</label><input type="text" class="grocery-item-input" placeholder="Item name">
      ${num > 1 ? '<button class="item-remove-btn">×</button>' : ""}`;
    group.querySelector(".item-remove-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.removeItemField(group);
    });
    this.itemsContainer.appendChild(group);
    group.querySelector("input").focus();
  }

  removeItemField(group) {
    group.style.animation = "slideOutDown 0.3s ease";
    setTimeout(() => {
      group.remove();
      this.updateItemLabels();
    }, 300);
  }

  updateItemLabels() {
    this.itemsContainer
      .querySelectorAll(".item-input-group")
      .forEach((g, i) => {
        g.querySelector("label").textContent = `Item ${i + 1}`;
      });
  }

  getGroceriesItems() {
    return Array.from(
      this.itemsContainer.querySelectorAll(".grocery-item-input"),
    )
      .map((i) => i.value.trim())
      .filter(Boolean)
      .join(", ");
  }

  addPickupItemField() {
    const num = this.pickupItemsContainer.children.length + 1;
    const group = document.createElement("div");
    group.className = "item-input-group";
    group.innerHTML = `<label>Item ${num}</label><input type="text" class="pickup-item-input" placeholder="Item to pick up">
      ${num > 1 ? '<button class="item-remove-btn">×</button>' : ""}`;
    group.querySelector(".item-remove-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.removePickupItemField(group);
    });
    this.pickupItemsContainer.appendChild(group);
    group.querySelector("input").focus();
  }

  removePickupItemField(group) {
    group.style.animation = "slideOutDown 0.3s ease";
    setTimeout(() => {
      group.remove();
      this.updatePickupItemLabels();
    }, 300);
  }

  updatePickupItemLabels() {
    this.pickupItemsContainer
      .querySelectorAll(".item-input-group")
      .forEach((g, i) => {
        g.querySelector("label").textContent = `Item ${i + 1}`;
      });
  }

  getPickupItems() {
    return Array.from(
      this.pickupItemsContainer.querySelectorAll(".pickup-item-input"),
    )
      .map((i) => i.value.trim())
      .filter(Boolean)
      .join(", ");
  }

  // ── Photo / File upload ───────────────────────────────────
  handlePhotoUpload(files) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Images only");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("Max 10MB");
        return;
      }
      if (this.formData.billPhotos.length >= 5) {
        alert("Max 5 photos");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const d = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result,
        };
        this.formData.billPhotos.push(d);
        this.displayPhotoPreview(d, this.formData.billPhotos.length - 1);
      };
      reader.readAsDataURL(file);
    });
  }

  displayPhotoPreview(data, idx) {
    const item = document.createElement("div");
    item.className = "photo-preview-item";
    item.innerHTML = `<img src="${data.data}" alt="${data.name}"><button class="photo-remove-btn">×</button>`;
    item.querySelector(".photo-remove-btn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removePhoto(idx);
    });
    this.photoPreviewContainer.appendChild(item);
  }

  removePhoto(idx) {
    this.formData.billPhotos.splice(idx, 1);
    this.photoPreviewContainer.innerHTML = "";
    this.formData.billPhotos.forEach((p, i) => this.displayPhotoPreview(p, i));
    this.billPhotoInput.value = "";
  }

  handleFileUpload(files) {
    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) {
        alert(`"${file.name}" too large (max 25MB)`);
        return;
      }
      if (this.formData.attachedFiles.length >= 10) {
        alert("Max 10 files");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const d = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result,
        };
        this.formData.attachedFiles.push(d);
        this.displayFilePreview(d, this.formData.attachedFiles.length - 1);
      };
      reader.readAsDataURL(file);
    });
  }

  displayFilePreview(data, idx) {
    const item = document.createElement("div");
    item.className = "file-preview-item";
    item.innerHTML = `<div><i class="${this.getFileIcon(data.type)}"></i><div>
      <div class="file-name">${data.name}</div>
      <div class="file-size">${this.formatFileSize(data.size)}</div></div></div>
      <button class="file-remove-btn">×</button>`;
    item.querySelector(".file-remove-btn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeFile(idx);
    });
    this.filePreviewContainer.appendChild(item);
  }

  removeFile(idx) {
    this.formData.attachedFiles.splice(idx, 1);
    this.filePreviewContainer.innerHTML = "";
    this.formData.attachedFiles.forEach((f, i) =>
      this.displayFilePreview(f, i),
    );
    this.generalFileInput.value = "";
  }

  getFileIcon(type) {
    if (type.startsWith("image/")) return "fa-solid fa-file-image";
    if (type.startsWith("video/")) return "fa-solid fa-file-video";
    if (type.includes("pdf")) return "fa-solid fa-file-pdf";
    if (type.includes("word")) return "fa-solid fa-file-word";
    if (type.includes("excel")) return "fa-solid fa-file-excel";
    if (type.includes("zip")) return "fa-solid fa-file-zipper";
    return "fa-solid fa-file";
  }

  formatFileSize(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024,
      sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  // ── Submit request ────────────────────────────────────────
  async submitNewRequest() {
    this.updateConfirmationDisplay();
    if (!this.formData.serviceType || !this.formData.items) {
      alert("Fill all required fields");
      return;
    }
    this.submitRequest.disabled = true;
    this.submitRequest.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    try {
      pasugoAPI.updateToken();
      const result = await pasugoAPI.createRequest({
        serviceType: this.formData.serviceType,
        itemsDescription: this.formData.items,
        budgetLimit: this.formData.budget || null,
        specialInstructions: this.formData.instructions || null,
        pickupLocation: this.formData.pickupLocation || null,
        deliveryAddress: this.formData.deliveryAddress || null,
        deliveryOption: this.formData.deliveryOption || null,
      });

      if (!result.success) {
        alert("Error: " + result.message);
        return;
      }

      this.requestId = result.data.request_id;
      this.requestStatus = "waiting";
      this.saveRequestState();
      this.requestModalOverlay.style.display = "none";
      this.showRiderSelection();
    } catch (error) {
      alert("Failed: " + error.message);
    } finally {
      this.submitRequest.disabled = false;
      this.submitRequest.innerHTML = "Find a Rider";
    }
  }

  // ── Rider selection ───────────────────────────────────────
  async showRiderSelection() {
    this.waitingModalOverlay.style.display = "flex";
    this.waitingStatus.textContent = "Finding available riders nearby...";
    this.modalBackdrop?.classList.add("active");

    const userPos = pasugoMap?.userPosition;
    if (!userPos) {
      alert("Location unavailable");
      this.closeWaitingModal();
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/locations/riders/available?lat=${userPos.lat}&lng=${userPos.lng}&radius=10&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to fetch riders");
      const data = await res.json();

      if (!data.riders?.length) {
        this.waitingStatus.innerHTML =
          '<div style="text-align:center"><h3>No riders available</h3><p>Try again soon</p></div>';
        setTimeout(() => this.closeWaitingModal(), 3000);
        return;
      }
      this.displayRiderList(data.riders);
    } catch (error) {
      alert("Failed to find riders");
      this.closeWaitingModal();
    }
  }

  displayRiderList(riders) {
    const content = this.waitingModal.querySelector(".waiting-content");
    content.innerHTML = `<h2>Select a Rider</h2><p>${riders.length} available nearby</p>
      <div class="rider-list">${riders
        .map(
          (r) => `
        <div class="rider-card" data-rider-id="${r.rider_id}"
          style="cursor:pointer;padding:15px;border:2px solid #eee;margin:10px 0;border-radius:8px;transition:all 0.2s">
          <div><strong>${r.full_name}</strong></div>
          <div style="font-size:14px;color:#666">${r.vehicle_type} - ${r.license_plate}</div>
          <div style="font-size:13px;color:#888">⭐ ${r.rating?.toFixed(1) || "New"} (${r.total_tasks_completed} rides) • ${r.distance_km?.toFixed(1) || "0.0"}km away</div>
        </div>`,
        )
        .join("")}</div>
      <button id="cancelRiderSelection"
        style="width:100%;padding:12px;margin-top:15px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer">Cancel</button>`;

    content.querySelectorAll(".rider-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = parseInt(card.dataset.riderId);
        this.selectRiderById(
          id,
          riders.find((r) => r.rider_id === id),
        );
      });
      card.addEventListener("mouseenter", () => {
        card.style.borderColor = "#ffc107";
        card.style.transform = "scale(1.02)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.borderColor = "#eee";
        card.style.transform = "scale(1)";
      });
    });

    content
      .querySelector("#cancelRiderSelection")
      ?.addEventListener("click", async () => {
        await pasugoAPI.cancelRequest(this.requestId);
        this.closeWaitingModal();
        this.resetForm();
      });
  }

  async selectRiderById(riderId, riderData) {
    const content = this.waitingModal.querySelector(".waiting-content");
    content.innerHTML = `<div style="text-align:center">
      <h2>Notifying ${riderData.full_name}...</h2>
      <p>Waiting for rider to accept</p>
      <div id="waitingTime" style="font-size:24px;margin:20px 0">0:00</div></div>`;

    try {
      const result = await pasugoAPI.selectRider(this.requestId, riderId);
      if (!result.success) {
        alert("Failed: " + result.message);
        this.closeWaitingModal();
        return;
      }
      this.startPollingForRiderResponse();
    } catch (error) {
      alert("Failed to notify rider");
      this.closeWaitingModal();
    }
  }

  startPollingForRiderResponse() {
    this.isWaiting = true;
    this.waitingTimer = 0;

    this.waitingTimerId = setInterval(() => {
      this.waitingTimer++;
      const m = Math.floor(this.waitingTimer / 60),
        s = this.waitingTimer % 60;
      const el = document.getElementById("waitingTime");
      if (el) el.textContent = `${m}:${s.toString().padStart(2, "0")}`;
      if (this.waitingTimer >= 600) this.handleRiderTimeout();
    }, 1000);

    this.statusPollInterval = setInterval(async () => {
      const result = await pasugoAPI.pollRequestStatus(this.requestId);
      if (result.success) {
        const { status, timed_out, rider_info } = result.data;
        if (timed_out) {
          this.handleRiderTimeout();
          return;
        }
        if (status === "assigned" && rider_info) {
          this.handleRiderAccepted(rider_info);
          return;
        }
        if (status === "pending" && !result.data.selected_rider_id) {
          this.handleRiderDeclined();
          return;
        }
      }
    }, 3000);
  }

  handleRiderTimeout() {
    this.stopWaitingTimer();
    const content = this.waitingModal.querySelector(".waiting-content");
    content.innerHTML = `<div style="text-align:center"><h2>Rider didn't respond</h2><p>No response within 10 minutes</p>
      <button id="selectAnotherRider" style="width:100%;padding:12px;margin-top:15px;background:#28a745;color:white;border:none;border-radius:8px;cursor:pointer">Select Another Rider</button></div>`;
    content
      .querySelector("#selectAnotherRider")
      ?.addEventListener("click", () => this.showRiderSelection());
  }

  handleRiderDeclined() {
    this.stopWaitingTimer();
    const content = this.waitingModal.querySelector(".waiting-content");
    content.innerHTML = `<div style="text-align:center"><h2>Rider Declined</h2><p>Rider is not available</p>
      <button id="selectAnotherRider" style="width:100%;padding:12px;margin-top:15px;background:#28a745;color:white;border:none;border-radius:8px;cursor:pointer">Select Another Rider</button></div>`;
    content
      .querySelector("#selectAnotherRider")
      ?.addEventListener("click", () => this.showRiderSelection());
  }

  handleRiderAccepted(riderInfo) {
    this.stopWaitingTimer();
    this.requestStatus = "shopping";
    this.saveRequestState();
    this.showChatWithRider(riderInfo);
  }

  stopWaitingTimer() {
    if (this.waitingTimerId) {
      clearInterval(this.waitingTimerId);
      this.waitingTimerId = null;
    }
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
  }

  // ── Confirmation display ──────────────────────────────────
  updateConfirmationDisplay() {
    const sNames = {
      groceries: "Buy Groceries",
      bills: "Pay Bills",
      delivery: "Pick & Deliver",
      pharmacy: "Pharmacy",
      pickup: "Pick Me Up",
      documents: "Documents",
    };
    const vNames = { motorcycle: "Motorcycle", car: "Car", van: "Van" };

    this.confService.textContent = sNames[this.formData.serviceType] || "-";

    if (this.formData.serviceType === "pickup") {
      this.confVehicleItem.style.display = "flex";
      this.confVehicle.textContent = vNames[this.formData.vehicleType] || "-";
    } else {
      this.confVehicleItem.style.display = "none";
    }

    let items = "";
    if (this.formData.serviceType === "delivery") {
      items = `From: ${this.formData.pickupLocation} → ${this.formData.deliveryOption === "current-location" ? "Your Location" : this.formData.deliveryAddress}`;
    } else if (this.formData.serviceType === "bills") {
      items = `[${this.formData.billPhotos.length} photo(s)]`;
      if (this.formData.attachedFiles.length)
        items += ` + ${this.formData.attachedFiles.length} file(s)`;
    } else {
      items =
        this.formData.items.substring(0, 50) +
        (this.formData.items.length > 50 ? "..." : "");
      if (this.formData.attachedFiles.length)
        items += ` [${this.formData.attachedFiles.length} file(s)]`;
    }

    this.confItems.textContent = items;
    this.confBudget.textContent = this.formData.budget
      ? `₱${this.formData.budget.toFixed(2)}`
      : "No limit";
    const loc = document.getElementById("locationName");
    if (loc) this.confLocation.textContent = loc.textContent;
  }

  async cancelRequest() {
    if (!confirm("Cancel this request?")) return;
    try {
      pasugoAPI.updateToken();
      const result = await pasugoAPI.cancelRequest(this.requestId);
      if (result.success) {
        this.closeWaitingModal();
        this.clearRequestState();
        this.resetForm();
        alert("Request cancelled");
      } else alert("Error: " + result.message);
    } catch {
      alert("Failed to cancel");
    }
  }

  // ✅ Real WebSocket chat — replaces fake version
  showChatWithRider(rider) {
    this.riderName.textContent = rider.name;
    this.riderStatus.textContent = "Connecting...";
    const chatName = document.getElementById("chatRiderName");
    if (chatName) chatName.textContent = rider.name;

    this.openChatModal();
    this.chatContainer.innerHTML = "";

    // Connect WebSocket and load history
    this.chat.connect(this.requestId);

    // Start polling for delivery status changes
    this.startDeliveryStatusPolling();
  }

  // ── Delivery Status Polling ───────────────────────────────
  startDeliveryStatusPolling() {
    // Clear any existing interval
    if (this.deliveryStatusPollInterval) {
      clearInterval(this.deliveryStatusPollInterval);
    }

    // Poll every 5 seconds for status changes
    this.deliveryStatusPollInterval = setInterval(async () => {
      if (!this.requestId) {
        clearInterval(this.deliveryStatusPollInterval);
        return;
      }

      try {
        const result = await pasugoAPI.getRequestDetails(this.requestId);
        if (!result.success) return;

        const request = result.data;
        const status = request.status?.toLowerCase();

        // Handle status transitions
        if (status === 'in_progress' && this.requestStatus !== 'delivering') {
          this.handleDeliveryStarted(request);
        } else if (status === 'completed') {
          this.handleDeliveryCompleted(request);
        } else if (status === 'cancelled') {
          this.handleRequestCancelled();
        }
      } catch (err) {
        console.error('[StatusPoll] Error:', err);
      }
    }, 5000);
  }

  stopDeliveryStatusPolling() {
    if (this.deliveryStatusPollInterval) {
      clearInterval(this.deliveryStatusPollInterval);
      this.deliveryStatusPollInterval = null;
    }
  }

  handleDeliveryStarted(request) {
    console.log('🚚 Delivery started!');
    this.requestStatus = 'delivering';
    this.saveRequestState();

    // Update UI to show delivery status
    if (this.riderStatus) {
      this.riderStatus.textContent = 'Delivering';
      this.riderStatus.style.color = '#17a2b8';
    }

    // Show delivery notification
    this.showDeliveryBanner(request);
  }

  handleDeliveryCompleted(request) {
    console.log('✅ Delivery completed!');
    this.stopDeliveryStatusPolling();
    
    // Show completion UI
    this.showCompletionModal(request);
  }

  handleRequestCancelled() {
    console.log('❌ Request was cancelled');
    this.stopDeliveryStatusPolling();
    this.chat.disconnect();
    this.clearRequestState();
    this.closeChatModal();
    alert('Request has been cancelled.');
  }

  showDeliveryBanner(request) {
    // Create or update delivery banner
    let banner = document.getElementById('deliveryStatusBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'deliveryStatusBanner';
      banner.style.cssText = 'background:linear-gradient(135deg, #17a2b8, #138496);color:white;padding:12px 15px;text-align:center;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;';

      // Insert at top of chat modal
      const chatHeader = this.chatModalOverlay?.querySelector('.chat-header') || this.chatModalOverlay?.querySelector('.chat-modal');
      if (chatHeader?.parentElement) {
        chatHeader.parentElement.insertBefore(banner, chatHeader.nextSibling);
      }
    }

    banner.innerHTML = `
      <i class="fa-solid fa-truck fa-beat-fade"></i>
      <span>Rider is on the way to deliver your items!</span>
    `;
    banner.style.display = 'flex';

    // Show payment reminder
    if (request.total_cost || request.budget) {
      const cost = request.total_cost || request.budget;
      setTimeout(() => {
        this.showPaymentReminder(cost, request.service_fee || 0);
      }, 2000);
    }
  }

  showPaymentReminder(totalCost, serviceFee) {
    let reminder = document.getElementById('paymentReminder');
    if (!reminder) {
      reminder = document.createElement('div');
      reminder.id = 'paymentReminder';
      reminder.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;padding:15px;margin:10px;border-radius:12px;';
      
      // Insert in chat messages area
      if (this.chatContainer?.parentElement) {
        this.chatContainer.parentElement.insertBefore(reminder, this.chatContainer);
      }
    }

    const total = parseFloat(totalCost) + parseFloat(serviceFee);
    reminder.innerHTML = `
      <div style="font-weight:600;color:#856404;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <i class="fa-solid fa-peso-sign"></i> Payment Summary
      </div>
      <div style="font-size:13px;color:#333;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Items Cost:</span>
          <span>₱${parseFloat(totalCost).toFixed(2)}</span>
        </div>
        ${serviceFee ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Service Fee:</span>
          <span>₱${parseFloat(serviceFee).toFixed(2)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:600;border-top:1px solid #ddd;padding-top:8px;margin-top:8px;">
          <span>Total to Pay:</span>
          <span style="color:#28a745;font-size:16px;">₱${total.toFixed(2)}</span>
        </div>
      </div>
      <div style="font-size:11px;color:#666;margin-top:10px;text-align:center;">
        <i class="fa-solid fa-info-circle"></i> Please prepare exact payment for the rider
      </div>
    `;
    reminder.style.display = 'block';
  }

  showCompletionModal(request) {
    // Remove delivery banner and payment reminder
    document.getElementById('deliveryStatusBanner')?.remove();
    document.getElementById('paymentReminder')?.remove();

    // Create completion overlay
    const overlay = document.createElement('div');
    overlay.id = 'completionOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;';
    
    overlay.innerHTML = `
      <div style="background:white;padding:30px;border-radius:20px;text-align:center;max-width:320px;margin:20px;">
        <div style="font-size:60px;margin-bottom:15px;">🎉</div>
        <h2 style="margin:0 0 10px;color:#28a745;">Delivery Complete!</h2>
        <p style="color:#666;margin-bottom:20px;">Thank you for using Pasugo! We hope you enjoyed our service.</p>
        
        <div style="background:#f8f9fa;padding:15px;border-radius:12px;margin-bottom:20px;">
          <div style="font-size:13px;color:#666;margin-bottom:5px;">Total Paid</div>
          <div style="font-size:24px;font-weight:600;color:#28a745;">₱${parseFloat(request.total_cost || request.budget || 0).toFixed(2)}</div>
        </div>
        
        <button id="rateRiderBtn" style="width:100%;padding:14px;background:var(--primary-yellow, #ffc107);color:#000;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:10px;">
          <i class="fa-solid fa-star"></i> Rate Your Rider
        </button>
        <button id="doneBtn" style="width:100%;padding:14px;background:#f8f9fa;color:#333;border:1px solid #ddd;border-radius:12px;font-size:16px;cursor:pointer;">
          Done
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    overlay.querySelector('#rateRiderBtn')?.addEventListener('click', () => {
      // TODO: Implement rating modal
      alert('Rating feature coming soon!');
    });

    overlay.querySelector('#doneBtn')?.addEventListener('click', () => {
      overlay.remove();
      this.completeDelivery();
    });
  }

  // ✅ Real send — goes through WebSocket
  sendMessage() {
    const msg = this.messageInput.value.trim();
    if (!msg) return;
    this.messageInput.value = "";
    this.chat.send(msg);
  }

  // ── State Persistence ─────────────────────────────────────
  saveRequestState() {
    const state = {
      requestId: this.requestId,
      requestStatus: this.requestStatus,
      riderName: this.riderName?.textContent || null,
      serviceType: this.formData.serviceType,
    };
    localStorage.setItem("active_customer_request", JSON.stringify(state));
    console.log("💾 Request state saved:", state);
  }

  clearRequestState() {
    localStorage.removeItem("active_customer_request");
    this.requestId = null;
    this.requestStatus = null;
    console.log("🗑️ Request state cleared");
  }

  restoreActiveRequest() {
    try {
      const savedState = localStorage.getItem("active_customer_request");
      if (!savedState) return;

      const state = JSON.parse(savedState);
      if (!state.requestId) return;

      console.log("🔄 Restoring active request:", state);
      this.requestId = state.requestId;
      this.requestStatus = state.requestStatus;

      // Check if request is still active from backend
      this.checkAndRestoreRequest(state);
    } catch (e) {
      console.error("Failed to restore request state:", e);
      this.clearRequestState();
    }
  }

  async checkAndRestoreRequest(state) {
    try {
      pasugoAPI.updateToken();
      const result = await pasugoAPI.getRequestDetails(state.requestId);

      if (!result.success) {
        console.log("📋 Request no longer exists, clearing state");
        this.clearRequestState();
        return;
      }

      const request = result.data;
      const status = request.status?.toLowerCase();

      // Check if request is completed or cancelled
      if (status === "completed" || status === "cancelled") {
        console.log(`📋 Request is ${status}, clearing state`);
        this.clearRequestState();
        return;
      }

      // Restore based on status
      if (status === "pending") {
        // Still waiting for rider
        this.requestStatus = "waiting";
        this.openWaitingModal();
        this.startPollingForRiderResponse();
      } else if (status === "assigned") {
        // Rider accepted, in shopping phase
        this.requestStatus = "shopping";

        // If we have rider info, show chat
        if (request.rider_name) {
          this.showChatWithRider({
            name: request.rider_name,
            id: request.rider_id,
          });
        }
      } else if (status === "in_progress") {
        // Rider is delivering
        this.requestStatus = "delivering";

        // If we have rider info, show chat
        if (request.rider_name) {
          this.showChatWithRider({
            name: request.rider_name,
            id: request.rider_id,
          });
          // Show delivery banner after a short delay for UI to load
          setTimeout(() => {
            this.showDeliveryBanner(request);
          }, 500);
        }
      }

      console.log(
        `✅ Request restored: ${this.requestId} (${this.requestStatus})`,
      );
    } catch (e) {
      console.error("Failed to check request status:", e);
    }
  }

  // ── Reset ─────────────────────────────────────────────────
  resetForm() {
    this.currentStep = 1;
    this.formData = {
      serviceType: null,
      vehicleType: null,
      billPhotos: [],
      attachedFiles: [],
      pickupItems: [],
      pickupLocation: "",
      deliveryOption: "current-location",
      deliveryAddress: "",
      items: "",
      budget: 0,
      instructions: "",
      location: null,
    };

    this.serviceCards.forEach((c) => c.classList.remove("selected"));
    this.vehicleCards.forEach((c) => c.classList.remove("selected"));

    this.vehicleSection.style.display = "none";
    this.billPhotoSection.style.display = "none";
    this.fileUploadSection.style.display = "none";
    this.budgetSection.style.display = "none";
    this.groceriesItemsForm.style.display = "none";
    this.pickDeliverForm.style.display = "none";
    this.itemsList.style.display = "block";
    this.itemsHelper.style.display = "block";

    this.photoPreviewContainer.innerHTML = "";
    this.filePreviewContainer.innerHTML = "";
    this.itemsContainer.innerHTML = "";
    this.pickupItemsContainer.innerHTML = "";

    [
      this.billPhotoInput,
      this.generalFileInput,
      this.itemsList,
      this.budgetLimit,
      this.pickupLocation,
      this.deliveryAddress,
      this.instructions,
    ].forEach((el) => el && (el.value = ""));

    this.step1Next.disabled = true;

    Object.keys(this.formSteps).forEach((step) => {
      this.formSteps[step].classList.remove("active");
      this.stepIndicators[step].classList.remove("active", "completed");
    });

    this.formSteps[1].classList.add("active");
    this.stepIndicators[1].classList.add("active");
    this.formTitle.textContent = "New Request";
  }
}

// ── Bootstrap ──────────────────────────────────────────────
let requestModalInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!requestModalInstance)
    requestModalInstance = new RequestModalController();
});
window.addEventListener("load", () => {
  if (!requestModalInstance)
    requestModalInstance = new RequestModalController();
});
