import re

def fix_menu_logic():
    with open(r"c:\ChatX\backend\vnr_script.js", "r", encoding="utf-8") as f:
        content = f.read()

    old_render = """    function renderMenuOptions(menuOptions) {
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

    new_render = """    function renderSubQuestions(subQuestions) {
      let qr = document.createElement("div");
      qr.className = "quick-replies";
      subQuestions.forEach(q => {
        if (!q || !q.trim()) return;
        let qb = document.createElement("button");
        qb.type = "button";
        qb.className = "quick-reply-btn";
        qb.textContent = q;
        qb.onclick = () => sendMessage(q);
        qr.appendChild(qb);
      });
      return qr;
    }

    function renderSubmenuChips(submenus) {
      let wrap = addMessage("bot", "Choose a topic:");
      let chips = document.createElement("div");
      chips.className = "quick-replies";
      submenus.forEach(sm => {
        if (!sm.label) return;
        let chip = document.createElement("button");
        chip.type = "button";
        chip.className = "quick-reply-btn submenu-chip";
        chip.textContent = sm.label;
        chip.onclick = () => {
          chips.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });
          chip.style.opacity = "1";
          chip.style.fontWeight = "700";
          if (sm.sub_questions && sm.sub_questions.length > 0) {
            let qWrap = addMessage("bot", "Questions about \\"" + sm.label + "\\":");
            qWrap.insertBefore(renderSubQuestions(sm.sub_questions), qWrap.lastChild);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        chips.appendChild(chip);
      });
      wrap.insertBefore(chips, wrap.lastChild);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderMenuOptions(menuOptions) {
      if (!menuOptions || menuOptions.length === 0) return;
      let wrap = addMessage("bot", "How can I help you? Choose a topic:");
      let chips = document.createElement("div");
      chips.className = "quick-replies";
      chips.style.marginTop = "10px";
      menuOptions.forEach(menu => {
        if (!menu.label) return;
        let btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-option-btn quick-reply-btn";
        btn.textContent = menu.label;
        btn.onclick = () => {
          chips.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });
          btn.style.opacity = "1";
          let submenus = menu.submenus || [];
          if (submenus.length > 0) {
            renderSubmenuChips(submenus);
          } else if (menu.sub_questions && menu.sub_questions.length > 0) {
            let qWrap = addMessage("bot", "Questions about \\"" + menu.label + "\\":");
            qWrap.insertBefore(renderSubQuestions(menu.sub_questions), qWrap.lastChild);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        chips.appendChild(btn);
      });
      wrap.insertBefore(chips, wrap.lastChild);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }"""

    if old_render in content:
        content = content.replace(old_render, new_render)
        with open(r"c:\ChatX\backend\vnr_script.js", "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated menu logic.")
    else:
        print("Could not find old_render snippet.")

if __name__ == "__main__":
    fix_menu_logic()
