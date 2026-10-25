const form = document.getElementById("pairForm");
const numberInput = document.getElementById("number");
const getCodeBtn = document.getElementById("getCodeBtn");
const codeBox = document.getElementById("codeBox");
const codeValue = document.getElementById("codeValue");
const timerFill = document.getElementById("timerFill");
const timerText = document.getElementById("timerText");
const regenBtn = document.getElementById("regenBtn");
const errorMsg = document.getElementById("errorMsg");

const EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
let countdownInterval = null;
let lastNumber = "";

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
  setTimeout(() => errorMsg.classList.add("hidden"), 4000);
}

async function requestCode(number) {
  getCodeBtn.disabled = true;
  getCodeBtn.querySelector("span").textContent = "ᴄᴏɴɴᴇxɪᴏɴ...";
  try {
    const res = await fetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur serveur");

    lastNumber = number;
    codeValue.textContent = data.code || "------";
    codeBox.classList.remove("hidden");
    startCountdown(data.expiresInMs || EXPIRY_MS);
  } catch (err) {
    showError(err.message || "Impossible de générer le code.");
  } finally {
    getCodeBtn.disabled = false;
    getCodeBtn.querySelector("span").textContent = "ᴏʙᴛᴇɴɪʀ ᴍᴏɴ ᴄᴏᴅᴇ";
  }
}

function startCountdown(durationMs) {
  clearInterval(countdownInterval);
  const end = Date.now() + durationMs;

  const tick = () => {
    const remaining = end - Date.now();
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      timerFill.style.width = "0%";
      timerText.textContent = "00:00";
      showError("Code expiré — clique sur régénérer.");
      return;
    }
    const pct = (remaining / durationMs) * 100;
    timerFill.style.width = pct + "%";
    const s = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    timerText.textContent = `${mm}:${ss}`;
  };

  tick();
  countdownInterval = setInterval(tick, 1000);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const number = numberInput.value.replace(/\D/g, "");
  if (number.length < 8) return showError("Entre un numéro valide avec indicatif.");
  requestCode(number);
});

regenBtn.addEventListener("click", () => {
  if (!lastNumber) return;
  requestCode(lastNumber); // chaque appel régénère un nouveau code côté serveur
});

// --- petites particules flottantes en arrière-plan ---
(function spawnParticles() {
  const container = document.getElementById("particles");
  const count = 26;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const size = Math.random() * 4 + 2;
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = 6 + Math.random() * 8 + "s";
    p.style.animationDelay = Math.random() * 8 + "s";
    p.style.background = Math.random() > 0.5 ? "#00e5a8" : "#ff2e92";
    container.appendChild(p);
  }
})();
