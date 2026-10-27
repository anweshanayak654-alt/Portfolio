(function () {
  const panel = document.getElementById("chat-panel");
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const fab = document.getElementById("chat-toggle");
  const closeBtn = document.getElementById("chat-close");
  const heroOpen = document.getElementById("open-chatbot-hero");
  const widget = document.querySelector(".chatbot");

  if (!panel || !log || !form || !input || !fab || !closeBtn || !widget) return;

  const history = [];
  let lastFocus = null;
  let sending = false;

  addBubble(
    "assistant",
    "Hi — I can answer questions about Anwesha’s skills, education, and projects. How can I help?"
  );

  fab.addEventListener("click", function () {
    if (panel.hidden) openChat();
    else closeChat();
  });
  closeBtn.addEventListener("click", closeChat);
  if (heroOpen) heroOpen.addEventListener("click", openChat);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      closeChat();
    }
  });

  panel.addEventListener("keydown", function (event) {
    if (event.key !== "Tab" || panel.hidden) return;
    trapFocus(event);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;
    input.value = "";
    sendMessage(text);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  function openChat() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    widget.classList.add("open");
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "Close AI assistant");
    input.focus();
  }

  function closeChat() {
    panel.hidden = true;
    widget.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Open AI assistant");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    else fab.focus();
  }

  function trapFocus(event) {
    const focusable = panel.querySelectorAll(
      'button, [href], textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + role;
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function setSending(isSending) {
    sending = isSending;
    form.querySelector("button[type='submit']").disabled = isSending;
  }

  async function sendMessage(text) {
    addBubble("user", text);
    history.push({ role: "user", content: text });

    const pending = addBubble("assistant", "Thinking…");
    setSending(true);

    try {
      const reply = await fetchReply(history);
      pending.textContent = reply;
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      pending.textContent =
        (err && err.message) ||
        "The assistant is unavailable right now. Check that CHATBOT_API_KEY is set on the server.";
    } finally {
      setSending(false);
      log.scrollTop = log.scrollHeight;
    }
  }

  async function fetchReply(messages) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    if (typeof data.reply !== "string" || !data.reply) {
      throw new Error("Empty reply");
    }

    return data.reply;
  }
})();
