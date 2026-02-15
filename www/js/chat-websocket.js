// chat-websocket.js
// ─────────────────────────────────────────────────────────────
// Real-time WebSocket chat for Pasugo
// Replaces the fake sendMessage() in request-modal.js
// Drop this file alongside request-modal.js and include it in HTML
// ─────────────────────────────────────────────────────────────

const PASUGO_WS_BASE = "wss://pasugo.onrender.com";
const PASUGO_API_BASE = "https://pasugo.onrender.com";

class PasugoChat {
  constructor() {
    this.ws = null;
    this.conversationId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.isConnected = false;
    this.typingTimeout = null;
    this.messageQueue = []; // messages to send after reconnect
  }

  // ── Connect to a conversation ──────────────────────────────

  async connectToConversation(requestId) {
    try {
      // 1. Get or create conversation for this request
      const token = localStorage.getItem("access_token");
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

      // 2. Load existing message history
      await this.loadMessageHistory();

      // 3. Open WebSocket
      this.openWebSocket();

      return this.conversationId;
    } catch (err) {
      console.error("[Chat] connectToConversation error:", err);
      this.showSystemMessage(
        "Could not connect to chat. Messages may be delayed.",
      );
    }
  }

  openWebSocket() {
    const token = localStorage.getItem("access_token");
    if (!token || !this.conversationId) return;

    const url = `${PASUGO_WS_BASE}/api/messages/ws/${this.conversationId}?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[Chat] WebSocket connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);

      // Flush any queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        this.ws.send(JSON.stringify(msg));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleIncomingEvent(data);
      } catch (err) {
        console.error("[Chat] Failed to parse message:", err);
      }
    };

    this.ws.onclose = (event) => {
      console.log("[Chat] WebSocket closed:", event.code);
      this.isConnected = false;
      this.updateConnectionStatus(false);

      // Auto-reconnect unless it was intentional (code 1000) or auth failure (4001/4003)
      if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error("[Chat] WebSocket error:", err);
    };

    // Keepalive ping every 30s
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.ws.send(JSON.stringify({ event: "ping" }));
      }
    }, 30000);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showSystemMessage("Connection lost. Please refresh the page.");
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(
      `[Chat] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );
    setTimeout(() => this.openWebSocket(), delay);
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close(1000, "User closed chat");
      this.ws = null;
    }
    this.isConnected = false;
    this.conversationId = null;
  }

  // ── Send a message ─────────────────────────────────────────

  sendMessage(content) {
    if (!content?.trim()) return;

    const payload = {
      event: "send_message",
      content: content.trim(),
      message_type: "text",
    };

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      // Queue for when reconnected
      this.messageQueue.push(payload);
      this.scheduleReconnect();
    }

    this.stopTyping();
  }

  // ── Typing indicators ──────────────────────────────────────

  startTyping() {
    if (!this.isConnected) return;
    this.ws.send(JSON.stringify({ event: "typing_start" }));

    // Auto stop after 3 seconds of no keystrokes
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.stopTyping(), 3000);
  }

  stopTyping() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: "typing_stop" }));
    }
  }

  // ── Mark messages as read ──────────────────────────────────

  markRead(messageIds) {
    if (!this.isConnected || !messageIds?.length) return;
    this.ws.send(
      JSON.stringify({
        event: "mark_read",
        message_ids: messageIds,
      }),
    );
  }

  // ── Load message history via REST ──────────────────────────

  async loadMessageHistory() {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${PASUGO_API_BASE}/api/messages/conversations/${this.conversationId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data = await res.json();
      const messages = data.data?.messages || [];

      // Clear chat container and render history
      const container = document.getElementById("chatContainer");
      if (container) {
        container.innerHTML = "";
        if (messages.length === 0) {
          this.showSystemMessage("Start the conversation!");
        } else {
          messages.forEach((msg) => this.renderMessage(msg));
          container.scrollTop = container.scrollHeight;
        }
      }

      // Mark all as read
      const unread = messages
        .filter((m) => m.sender_type !== this.getCurrentUserType())
        .map((m) => m.message_id);
      if (unread.length) this.markRead(unread);
    } catch (err) {
      console.error("[Chat] loadMessageHistory error:", err);
    }
  }

  // ── Handle incoming WS events ──────────────────────────────

  handleIncomingEvent(data) {
    switch (data.event) {
      case "new_message":
        this.renderMessage(data);
        this.markRead([data.message_id]);
        break;

      case "user_typing":
        this.updateTypingIndicator(data);
        break;

      case "messages_read":
        this.updateReadReceipts(data.message_ids);
        break;

      case "user_joined":
        if (data.user_id !== this.getCurrentUserId()) {
          this.updateOnlineStatus(true, data.full_name);
        }
        break;

      case "user_left":
        if (data.user_id !== this.getCurrentUserId()) {
          this.updateOnlineStatus(false, data.full_name);
        }
        break;

      case "pong":
        // keepalive confirmed
        break;

      case "error":
        console.error("[Chat] Server error:", data.message);
        break;
    }
  }

  // ── Render a message bubble ────────────────────────────────

  renderMessage(msg) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const currentUserId = this.getCurrentUserId();
    const isOwn = msg.sender_id === currentUserId;
    const isSystem = msg.message_type === "system";

    if (isSystem) {
      this.showSystemMessage(msg.content);
      return;
    }

    // Remove typing indicator if present before adding message
    const typingEl = container.querySelector(".typing-indicator-bubble");
    if (typingEl) typingEl.remove();

    const group = document.createElement("div");
    group.className = `message-group ${isOwn ? "customer" : "rider"}`;
    group.dataset.messageId = msg.message_id;

    const time = msg.sent_at
      ? new Date(msg.sent_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    group.innerHTML = `
      <div class="message-bubble ${isOwn ? "customer" : "rider"}">
        ${this.escapeHtml(msg.content || "")}
        <span class="message-time">${time}</span>
        ${isOwn ? '<span class="message-status" data-id="' + msg.message_id + '">✓</span>' : ""}
      </div>
    `;

    container.appendChild(group);
    container.scrollTop = container.scrollHeight;
  }

  showSystemMessage(text) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "system-message";
    el.style.cssText = `
      text-align: center;
      padding: 8px 16px;
      margin: 8px auto;
      font-size: 12px;
      color: #888;
      background: rgba(0,0,0,0.05);
      border-radius: 12px;
      max-width: 80%;
    `;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // ── Typing indicator UI ────────────────────────────────────

  updateTypingIndicator(data) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const existing = container.querySelector(".typing-indicator-bubble");

    if (data.is_typing && data.user_id !== this.getCurrentUserId()) {
      if (!existing) {
        const el = document.createElement("div");
        el.className = "message-group rider typing-indicator-bubble";
        el.innerHTML = `
          <div class="message-bubble rider" style="padding: 10px 14px;">
            <span class="typing-dots">
              <span></span><span></span><span></span>
            </span>
          </div>
        `;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
      }

      // Update rider name in status
      const riderStatus = document.getElementById("riderStatus");
      if (riderStatus && data.full_name) {
        riderStatus.textContent = "typing...";
        setTimeout(() => {
          if (riderStatus.textContent === "typing...") {
            riderStatus.textContent = "On the way";
          }
        }, 3000);
      }
    } else {
      if (existing) existing.remove();
    }
  }

  // ── Read receipts UI ───────────────────────────────────────

  updateReadReceipts(messageIds) {
    messageIds?.forEach((id) => {
      const el = document.querySelector(`.message-status[data-id="${id}"]`);
      if (el) {
        el.textContent = "✓✓";
        el.style.color = "#4fc3f7";
      }
    });
  }

  // ── Connection status UI ───────────────────────────────────

  updateConnectionStatus(connected) {
    const statusEl = document.getElementById("riderStatus");
    if (!statusEl) return;

    if (!connected) {
      statusEl.textContent = "Reconnecting...";
      statusEl.style.color = "#ff9800";
    } else {
      statusEl.textContent = "Online";
      statusEl.style.color = "#4caf50";
      setTimeout(() => {
        if (statusEl.textContent === "Online") {
          statusEl.textContent = "On the way";
          statusEl.style.color = "";
        }
      }, 2000);
    }
  }

  updateOnlineStatus(isOnline, name) {
    const statusEl = document.getElementById("riderStatus");
    if (statusEl) {
      statusEl.textContent = isOnline ? "On the way" : "Offline";
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  getCurrentUserId() {
    try {
      const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
      return userData.user_id;
    } catch {
      return null;
    }
  }

  getCurrentUserType() {
    try {
      const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
      let t = userData.user_type || userData.role || "customer";
      if (t.includes(".")) t = t.split(".")[1];
      return t;
    } catch {
      return "customer";
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
}

// ── Singleton instance ─────────────────────────────────────
window.pasugoChat = new PasugoChat();

// ── CSS for typing animation & message time ────────────────
const chatStyles = document.createElement("style");
chatStyles.textContent = `
  .typing-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .typing-dots span {
    width: 7px;
    height: 7px;
    background: #888;
    border-radius: 50%;
    animation: typingBounce 1.2s infinite ease-in-out;
  }
  .typing-dots span:nth-child(1) { animation-delay: 0s; }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-6px); opacity: 1; }
  }

  .message-time {
    font-size: 10px;
    opacity: 0.6;
    margin-left: 6px;
    white-space: nowrap;
  }

  .message-status {
    font-size: 11px;
    margin-left: 4px;
    opacity: 0.7;
  }
`;
document.head.appendChild(chatStyles);
