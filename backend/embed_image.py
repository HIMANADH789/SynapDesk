import base64
import re

def get_base64_img():
    with open(r"C:\ChatX\frontend\public\VNRLogo.png", "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/png;base64,{b64}"

def fix_script():
    with open(r"c:\ChatX\backend\vnr_script.js", "r", encoding="utf-8") as f:
        content = f.read()

    # Replace local URL with base64
    content = content.replace("http://localhost:5173/VNRLogo.png", get_base64_img())

    # Replace renderMenuOptions logic so it renders INSIDE the chat
    old_render = """    function renderMenuOptions(menuOptions) {
      if (!menuOptions || menuOptions.length === 0) return;
      menuContainer = document.createElement("div");
      menuContainer.className = "menu-bubbles";
      menuOptions.forEach((menu, idx) => {
        let menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "menu-bubble";
        menuBtn.textContent = menu.label;
        menuBtn.style.animationDelay = (idx * 0.2) + "s";
        menuBtn.onclick = () => {
          if (!isOpen) btn.click();
          if (menu.sub_questions && menu.sub_questions.length > 0) {
            let wrap = addMessage("bot", "Common questions about " + menu.label + ":");
            let qr = document.createElement("div");
            qr.className = "quick-replies";
            menu.sub_questions.forEach(q => {
              if (!q.trim()) return;
              let qb = document.createElement("button");
              qb.type = "button";
              qb.className = "quick-reply-btn";
              qb.textContent = q;
              qb.onclick = () => sendMessage(q);
              qr.appendChild(qb);
            });
            wrap.insertBefore(qr, wrap.lastChild); // Append right after message bubble, before time
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        menuContainer.appendChild(menuBtn);
      });
      p.appendChild(menuContainer);
    }"""

    new_render = """    function renderMenuOptions(menuOptions) {
      if (!menuOptions || menuOptions.length === 0) return;
      
      let wrap = addMessage("bot", "How can I help you? Choose a topic:");
      let qr = document.createElement("div");
      qr.className = "quick-replies";
      
      menuOptions.forEach(menu => {
        if (!menu.label) return;
        let menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "quick-reply-btn";
        menuBtn.textContent = menu.label;
        
        menuBtn.onclick = () => {
          // Lock current options
          qr.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });
          menuBtn.style.opacity = "1";
          
          if (menu.sub_questions && menu.sub_questions.length > 0) {
            let subWrap = addMessage("bot", "Questions about " + menu.label + ":");
            let subQr = document.createElement("div");
            subQr.className = "quick-replies";
            menu.sub_questions.forEach(q => {
              if (!q.trim()) return;
              let qb = document.createElement("button");
              qb.type = "button";
              qb.className = "quick-reply-btn";
              qb.textContent = q;
              qb.onclick = () => sendMessage(q);
              subQr.appendChild(qb);
            });
            subWrap.insertBefore(subQr, subWrap.lastChild);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        qr.appendChild(menuBtn);
      });
      wrap.insertBefore(qr, wrap.lastChild);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }"""

    content = content.replace(old_render, new_render)
    
    # Also clean up menuContainer toggling from the rest of the script
    content = content.replace('if (menuContainer) menuContainer.classList.toggle("hidden", isOpen);', '')
    content = content.replace('if (menuContainer) menuContainer.classList.remove("hidden");', '')

    with open(r"c:\ChatX\backend\vnr_script.js", "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    fix_script()
