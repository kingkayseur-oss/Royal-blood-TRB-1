const path = require("path");
const fs = require("fs");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");

const { handleCommand } = require("./commands/handlers");
const { registerGroupEvents } = require("./group");
const { BOT_NAME } = require("./lib/font");

const SESSIONS_DIR = path.join(__dirname, "..", "sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const CODE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes, demandé par le cahier des charges
const pending = new Map(); // number -> { sock, timer, code }
const active = new Map(); // number -> sock (sessions liées avec succès)

function clean(number) {
  const dir = path.join(SESSIONS_DIR, number);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

/**
 * Démarre une session de pairing pour un numéro donné.
 * Retourne le code à afficher côté frontend.
 * Si rien ne se connecte en 2 minutes, la session est détruite
 * (il faut redemander un code -> "régénération").
 */
async function requestPairingCode(number) {
  number = String(number).replace(/\D/g, "");
  if (!number || number.length < 8) throw new Error("Numéro invalide");

  // on repart toujours d'une session propre = un nouveau code à chaque demande
  if (pending.has(number)) {
    clearTimeout(pending.get(number).timer);
    try {
      pending.get(number).sock?.end?.();
    } catch {}
    pending.delete(number);
  }
  clean(number);

  const dir = path.join(SESSIONS_DIR, number);
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: [BOT_NAME, "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  let code;
  if (!sock.authState.creds.registered) {
    await new Promise((r) => setTimeout(r, 1500)); // laisse le socket s'initialiser
    code = await sock.requestPairingCode(number);
  }

  const timer = setTimeout(() => {
    if (pending.has(number)) {
      try {
        sock.end?.();
      } catch {}
      pending.delete(number);
      clean(number); // code expiré -> il faudra en régénérer un
    }
  }, CODE_EXPIRY_MS);

  pending.set(number, { sock, timer, code, createdAt: Date.now() });

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === "open") {
      clearTimeout(timer);
      pending.delete(number);
      active.set(number, sock);
      registerGroupEvents(sock);
      console.log(`✅ [${BOT_NAME}] session liée pour ${number}`);
    }
    if (connection === "close") {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (active.has(number) && shouldReconnect) {
        requestPairingCode.reconnect?.(number); // reconnection simple si déjà lié
      }
      if (active.has(number) && !shouldReconnect) {
        active.delete(number);
        clean(number);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;
    await handleCommand(sock, msg);
  });

  return { code, expiresInMs: CODE_EXPIRY_MS };
}

function getStatus(number) {
  number = String(number).replace(/\D/g, "");
  if (active.has(number)) return { status: "connected" };
  if (pending.has(number)) {
    const p = pending.get(number);
    const remaining = CODE_EXPIRY_MS - (Date.now() - p.createdAt);
    return { status: "pending", remainingMs: Math.max(0, remaining) };
  }
  return { status: "none" };
}

module.exports = { requestPairingCode, getStatus };
