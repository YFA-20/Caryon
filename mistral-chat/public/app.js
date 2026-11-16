const messagesEl = document.getElementById("messages");
const modelEl = document.getElementById("model");
const form = document.getElementById("composer");
const input = document.getElementById("prompt");
const button = document.getElementById("send");

const history = [];
const MAX_HISTORY = 40;

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "message " + role;
  const label = document.createElement("span");
  label.className = "role";
  label.textContent = role === "user" ? "Vous" : "Mistral";
  const body = document.createElement("p");
  body.textContent = text;
  div.append(label, body);
  messagesEl.append(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return body;
}

async function loadModel() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.model === "string") {
      modelEl.textContent = data.model;
    }
  } catch {
    modelEl.textContent = "mistral-large-4";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || button.disabled) return;
  input.value = "";
  button.disabled = true;
  addMessage("user", text);
  const pending = addMessage("assistant", "…");
  history.push({ role: "user", content: text });
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Erreur inconnue");
    }
    pending.textContent = data.reply;
    history.push({ role: "assistant", content: data.reply });
  } catch (err) {
    pending.textContent = "Erreur : " + (err instanceof Error ? err.message : String(err));
    pending.closest(".message").classList.add("error");
  } finally {
    button.disabled = false;
    input.focus();
  }
});

loadModel();
