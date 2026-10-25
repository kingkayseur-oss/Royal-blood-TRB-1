const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DIR, "db.json");

const DEFAULT_DB = {
  groups: {},
  banned: [],
  settings: { mode: "public", autoread: false, autotyping: false },
};

function load() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(DEFAULT_DB, null, 2));
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!data.settings) data.settings = { ...DEFAULT_DB.settings };
    return data;
  } catch {
    return { ...DEFAULT_DB };
  }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getGroup(jid) {
  const db = load();
  if (!db.groups[jid]) {
    db.groups[jid] = {
      welcome: true,
      goodbye: true,
      antilink: false,
      warnings: {},
      muted: [],
    };
    save(db);
  }
  if (!db.groups[jid].muted) db.groups[jid].muted = [];
  return db.groups[jid];
}

function getSettings() {
  return load().settings;
}

function setSettings(patch) {
  const db = load();
  db.settings = { ...db.settings, ...patch };
  save(db);
  return db.settings;
}

function setGroup(jid, patch) {
  const db = load();
  db.groups[jid] = { ...getGroup(jid), ...patch };
  save(db);
  return db.groups[jid];
}

function isBanned(id) {
  const db = load();
  return db.banned.includes(id);
}

function ban(id) {
  const db = load();
  if (!db.banned.includes(id)) db.banned.push(id);
  save(db);
}

function unban(id) {
  const db = load();
  db.banned = db.banned.filter((x) => x !== id);
  save(db);
}

module.exports = { load, save, getGroup, setGroup, isBanned, ban, unban, getSettings, setSettings };
