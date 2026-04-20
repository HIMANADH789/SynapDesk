(function () {
  const script = document.currentScript as HTMLScriptElement;
  if (!script) return;

  const clientId = script.getAttribute("data-client-id") || "default";
  const themeColor = script.getAttribute("data-theme-color") || "#1E40AF";
  const apiUrl =
    script.getAttribute("data-api-url") || script.src.replace(/\/widget\/.*/, "");
  const widgetToken = script.getAttribute("data-token") || "";

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

    .msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
    .msg.user { align-self: flex-end; background: ${themeColor}; color: #fff; border-bottom-right-radius: 4px; }
    .msg.bot { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }

    .cursor {
      display: inline-block; width: 2px; height: 14px;
      background: #64748b; margin-left: 2px; vertical-align: middle;
      animation: blink 0.8s step-end infinite;
    }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }

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

  function addMessage(role: "user" | "bot", text: string): HTMLElement {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping(): HTMLElement {
    const div = document.createElement("div");
    div.className = "msg bot typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    div.id = "typing-indicator";
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function removeTyping() {
    const el = shadow.getElementById("typing-indicator");
    if (el) el.remove();
  }

  // Streaming send — calls /stream endpoint, appends each SSE token chunk directly.
  // The SSE stream itself creates a progressive "typing" effect without blocking.
  async function sendStreaming(text: string) {
    const typingEl = showTyping();
    let botEl: HTMLElement | null = null;
    let cursorEl: HTMLElement | null = null;

    try {
      const res = await fetch(`${apiUrl}/api/chat/${clientId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(widgetToken ? { "X-Widget-Token": widgetToken } : {}),
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "token") {
              // First token — replace typing indicator with real message bubble
              if (!botEl) {
                typingEl.remove();
                botEl = document.createElement("div");
                botEl.className = "msg bot";
                cursorEl = document.createElement("span");
                cursorEl.className = "cursor";
                messagesEl.appendChild(botEl);
                botEl.appendChild(cursorEl);
              }
              // Append chunk directly before cursor (SSE streaming is the animation)
              if (event.text) {
                botEl.insertBefore(document.createTextNode(event.text as string), cursorEl!);
                messagesEl.scrollTop = messagesEl.scrollHeight;
              }

            } else if (event.type === "done") {
              if (event.session_id) sessionId = event.session_id as string;
              if (cursorEl) cursorEl.remove();
              // If stream ended with no tokens, show fallback
              if (!botEl) {
                typingEl.remove();
                addMessage("bot", "I'm sorry, I couldn't generate a response. Please try again.");
              }
            } else if (event.type === "error") {
              typingEl.remove();
              if (cursorEl) cursorEl.remove();
              addMessage("bot", (event.content as string) || "Sorry, something went wrong. Please try again.");
            }
          } catch {
            // skip malformed SSE chunk
          }
        }
      }

      // Stream ended without a done event — clean up gracefully
      if (botEl && cursorEl) cursorEl.remove();
      else if (!botEl) { typingEl.remove(); addMessage("bot", "Sorry, something went wrong. Please try again."); }

    } catch (err) {
      removeTyping();
      if (!botEl) addMessage("bot", "Sorry, something went wrong. Please try again.");
      else if (cursorEl) cursorEl.remove();
    }
  }

  formEl.onsubmit = async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text || loading) return;

    inputEl.value = "";
    addMessage("user", text);
    loading = true;
    sendBtn.disabled = true;

    await sendStreaming(text);

    loading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  };

  // Load welcome message
  fetch(`${apiUrl}/api/clients/${clientId}`)
    .then((r) => r.json())
    .then((data) => {
      const welcome = data?.settings?.welcome_message || "Hello! How can I help you today?";
      addMessage("bot", welcome);
    })
    .catch(() => addMessage("bot", "Hello! How can I help you today?"));
})();
