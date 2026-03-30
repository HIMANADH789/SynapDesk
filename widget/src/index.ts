(function () {
  const script = document.currentScript as HTMLScriptElement;
  if (!script) return;

  const clientId = script.getAttribute("data-client-id") || "default";
  const themeColor = script.getAttribute("data-theme-color") || "#1E40AF";
  const apiUrl =
    script.getAttribute("data-api-url") || script.src.replace(/\/widget\/.*/, "");

  // Create shadow DOM container
  const host = document.createElement("div");
  host.id = "ai-frontdesk-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  // Styles
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    .widget-btn {
      position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
      border-radius: 50%; background: ${themeColor}; color: #fff; border: none;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 99999;
      display: flex; align-items: center; justify-content: center; font-size: 24px;
      transition: transform 0.2s;
    }
    .widget-btn:hover { transform: scale(1.1); }

    .chat-panel {
      position: fixed; bottom: 92px; right: 24px; width: 380px; height: 520px;
      border-radius: 16px; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: none; flex-direction: column; overflow: hidden; z-index: 99998;
    }
    .chat-panel.open { display: flex; }

    .chat-header {
      padding: 16px 20px; background: ${themeColor}; color: #fff;
      display: flex; align-items: center; justify-content: space-between;
    }
    .chat-header h3 { font-size: 16px; font-weight: 600; }
    .chat-header button { background: none; border: none; color: #fff; cursor: pointer; font-size: 18px; }

    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }

    .msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .msg.user { align-self: flex-end; background: ${themeColor}; color: #fff; border-bottom-right-radius: 4px; }
    .msg.bot { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }

    .chat-input {
      padding: 12px 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;
    }
    .chat-input input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
      font-size: 14px; outline: none;
    }
    .chat-input input:focus { border-color: ${themeColor}; }
    .chat-input button {
      background: ${themeColor}; color: #fff; border: none; border-radius: 10px;
      padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 500;
    }
    .chat-input button:disabled { opacity: 0.5; }

    .typing { display: flex; gap: 4px; padding: 10px 14px; }
    .typing span {
      width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;
      animation: bounce 1.4s infinite both;
    }
    .typing span:nth-child(2) { animation-delay: 0.16s; }
    .typing span:nth-child(3) { animation-delay: 0.32s; }
    @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }

    @media (max-width: 480px) {
      .chat-panel { width: calc(100vw - 32px); right: 16px; bottom: 88px; height: 70vh; }
    }
  `;
  shadow.appendChild(style);

  // State
  let isOpen = false;
  let sessionId: string | undefined;
  let loading = false;

  // Toggle button
  const btn = document.createElement("button");
  btn.className = "widget-btn";
  btn.innerHTML = "💬";
  btn.onclick = () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    btn.innerHTML = isOpen ? "✕" : "💬";
    if (isOpen) inputEl.focus();
  };
  shadow.appendChild(btn);

  // Chat panel
  const panel = document.createElement("div");
  panel.className = "chat-panel";

  panel.innerHTML = `
    <div class="chat-header">
      <h3>Chat with us</h3>
      <button class="close-btn">✕</button>
    </div>
    <div class="chat-messages"></div>
    <form class="chat-input">
      <input type="text" placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
  `;
  shadow.appendChild(panel);

  const messagesEl = panel.querySelector(".chat-messages") as HTMLElement;
  const inputEl = panel.querySelector(".chat-input input") as HTMLInputElement;
  const formEl = panel.querySelector(".chat-input") as HTMLFormElement;
  const sendBtn = panel.querySelector(".chat-input button") as HTMLButtonElement;
  const closeBtn = panel.querySelector(".close-btn") as HTMLButtonElement;

  closeBtn.onclick = () => {
    isOpen = false;
    panel.classList.remove("open");
    btn.innerHTML = "💬";
  };

  function addMessage(role: "user" | "bot", text: string) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "msg bot typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    div.id = "typing-indicator";
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = shadow.getElementById("typing-indicator");
    if (el) el.remove();
  }

  formEl.onsubmit = async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text || loading) return;

    inputEl.value = "";
    addMessage("user", text);
    loading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${apiUrl}/api/chat/${clientId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      const data = await res.json();
      sessionId = data.session_id;
      hideTyping();
      addMessage("bot", data.response);
    } catch {
      hideTyping();
      addMessage("bot", "Sorry, something went wrong. Please try again.");
    } finally {
      loading = false;
      sendBtn.disabled = false;
    }
  };

  // Load welcome message from client settings, then show it
  fetch(`${apiUrl}/api/clients/${clientId}`, { method: "GET" })
    .then((r) => r.json())
    .then((data) => {
      const welcome = data?.settings?.welcome_message || "Hello! How can I help you today?";
      addMessage("bot", welcome);
    })
    .catch(() => {
      addMessage("bot", "Hello! How can I help you today?");
    });
})();
