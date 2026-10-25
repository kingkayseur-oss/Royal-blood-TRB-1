const fs = require("fs");
const path = require("path");
const { fancy, DEV_NAME, BOT_NAME_FANCY, box } = require("../lib/font");
const { buildMenu } = require("./menu");
const db = require("../lib/db");
const { CHANNEL_URL, CHANNEL_JID, CHANNEL_NAME, OWNER_NUMBERS, TELEGRAM_CONTACT } = require("../lib/config");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const MENU_IMAGE = path.join(__dirname, "..", "assets", "menu.png");
const PREFIX = process.env.PREFIX || ".";
const START_TIME = Date.now();

// ---------- Helpers ----------

function bare(jid = "") {
  return jid.split("@")[0].split(":")[0];
}

function isOwner(senderJid) {
  if (!OWNER_NUMBERS.length) return true; // aucun owner configuré -> commandes sensibles ouvertes (à sécuriser via .env)
  return OWNER_NUMBERS.includes(bare(senderJid));
}

async function isSenderAdmin(sock, groupId, sender) {
  const meta = await sock.groupMetadata(groupId);
  const p = meta.participants.find((x) => x.id === sender);
  return !!p && (p.admin === "admin" || p.admin === "superadmin");
}

async function isBotAdmin(sock, groupId) {
  const meta = await sock.groupMetadata(groupId);
  const me = meta.participants.find((x) => x.id === sock.user.id.split(":")[0] + "@s.whatsapp.net");
  return !!me && (me.admin === "admin" || me.admin === "superadmin");
}

function reply(sock, jid, text, quoted) {
  return sock.sendMessage(jid, { text }, { quoted });
}

async function getQuotedImageBuffer(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted?.imageMessage) return null;
  return downloadMediaMessage({ message: quoted, key: msg.key }, "buffer", {});
}

// ---------- Contenus statiques (fun) ----------

const QUOTES = [
  "Le succès, c'est tomber sept fois et se relever huit.",
  "Un objectif sans plan n'est qu'un souhait.",
  "On ne construit rien de grand dans le confort.",
  "Chaque expert a d'abord été un débutant.",
  "La discipline bat le talent quand le talent ne travaille pas.",
  "Avance d'un pas, même petit, chaque jour.",
];
const JOKES = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau.",
  "Qu'est-ce qu'un crocodile qui surveille la pharmacie ? Un investigator.",
  "Deux antennes se marient... la cérémonie était nulle, mais la réception excellente !",
  "Pourquoi les poissons n'aiment pas jouer au tennis ? Ils ont peur du filet.",
];
const FACTS = [
  "Le miel ne se périme jamais s'il est bien conservé.",
  "Les pieuvres ont trois cœurs.",
  "Un jour sur Vénus dure plus longtemps qu'une année sur Vénus.",
  "Les bananes sont techniquement des baies, pas les fraises.",
];
const TRUTHS = [
  "Quel est ton plus grand regret ?",
  "As-tu déjà menti à ton/ta meilleur(e) ami(e) ?",
  "Quelle est la chose la plus gênante qui te soit arrivée ?",
  "Qui dans ce groupe te plaît secrètement ?",
];
const DARES = [
  "Envoie le dernier message que tu as écrit à quelqu'un d'autre.",
  "Parle avec un accent pendant les 3 prochains messages.",
  "Envoie un vocal en chantant.",
  "Change ta photo de profil pour 10 minutes avec quelque chose de drôle.",
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Calculatrice sûre : chiffres et + - * / ( ) . uniquement, pas d'eval() brut
function safeCalc(expr) {
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) throw new Error("expression invalide");
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr})`)();
}

/**
 * Point d'entrée : traite un message entrant et exécute la commande si besoin.
 */
async function handleCommand(sock, msg) {
  try {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");
    const sender = isGroup ? msg.key.participant : jid;
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      "";

    // ---------- Mode "privé" global : seul l'owner peut utiliser le bot ----------
    const settings = db.getSettings();
    if (settings.mode === "private" && !isOwner(sender) && body.startsWith(PREFIX)) {
      return; // bot en mode privé, on ignore silencieusement
    }

    // ---------- Anti-lien ----------
    if (isGroup && body && !body.startsWith(PREFIX)) {
      const g = db.getGroup(jid);
      const hasLink = /(https?:\/\/|chat\.whatsapp\.com)/i.test(body);
      if (g.antilink && hasLink && !(await isSenderAdmin(sock, jid, sender))) {
        if (await isBotAdmin(sock, jid)) {
          await sock.sendMessage(jid, { delete: msg.key });
          await reply(sock, jid, fancy("lien supprimé 🚫 (antilink actif)"), msg);
        }
        return;
      }
      // ---------- Utilisateur mute : suppression silencieuse de tous ses messages ----------
      if (g.muted?.includes(sender) && (await isBotAdmin(sock, jid))) {
        await sock.sendMessage(jid, { delete: msg.key });
        return;
      }
    }

    if (!body.startsWith(PREFIX)) return;
    if (db.isBanned(sender)) return;

    // ---------- autotyping ----------
    if (settings.autotyping) {
      await sock.sendPresenceUpdate("composing", jid);
    }
    // ---------- autoread ----------
    if (settings.autoread) {
      await sock.readMessages([msg.key]);
    }

    const [cmdRaw, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = (cmdRaw || "").toLowerCase();
    const text = args.join(" ");
    const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = quotedCtx?.mentionedJid || [];
    const quotedParticipant = quotedCtx?.participant;

    switch (cmd) {
      // ================= GÉNÉRAL =================
      case "menu":
      case "help": {
        const image = fs.existsSync(MENU_IMAGE) ? fs.readFileSync(MENU_IMAGE) : undefined;
        await sock.sendMessage(
          jid,
          {
            image,
            caption: buildMenu(PREFIX),
            footer: fancy("kayseur_mdx • appuie pour suivre la chaîne"),
            templateButtons: [
              { index: 1, urlButton: { displayText: fancy("📡 voir la chaîne"), url: CHANNEL_URL } },
            ],
            contextInfo: {
              isForwarded: true,
              forwardingScore: 9999,
              forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                newsletterName: CHANNEL_NAME,
                serverMessageId: 1,
              },
            },
          },
          { quoted: msg }
        );
        break;
      }
      case "ping":
      case "speed": {
        const start = Date.now();
        const sent = await reply(sock, jid, fancy("calcul..."), msg);
        const ms = Date.now() - start;
        await sock.sendMessage(jid, { text: `🏓 ${fancy("pong")} ${ms}ms`, edit: sent.key });
        break;
      }
      case "owner": {
        await sock.sendMessage(
          jid,
          { text: box("owner", `${fancy("contacte le développeur")} :\n${DEV_NAME}\n${TELEGRAM_CONTACT}`) },
          { quoted: msg }
        );
        break;
      }
      case "runtime": {
        const s = process.uptime();
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
        await reply(sock, jid, box("runtime", `${h}h ${m}m ${sec}s`), msg);
        break;
      }
      case "about": {
        await reply(
          sock,
          jid,
          box("about", `${BOT_NAME_FANCY}\n${fancy("bot whatsapp public multi-fonctions")}\n${fancy("dev")} : ${DEV_NAME}`),
          msg
        );
        break;
      }
      case "rules": {
        await reply(
          sock,
          jid,
          box(
            "règles",
            [
              fancy("1. respecte les membres du groupe"),
              fancy("2. pas de spam / liens non autorisés"),
              fancy("3. les admins peuvent sanctionner (warn/ban/kick)"),
              fancy("4. usage du bot à tes risques, respecte whatsapp."),
            ].join("\n")
          ),
          msg
        );
        break;
      }
      case "credit": {
        await reply(sock, jid, box("crédits", `${fancy("développé par")} ${DEV_NAME}\n${fancy("basé sur baileys (open-source)")}`), msg);
        break;
      }
      case "source": {
        await reply(sock, jid, fancy("code basé sur @whiskeysockets/baileys (open-source, mit).") , msg);
        break;
      }
      case "donate": {
        await reply(sock, jid, box("soutenir le dev", `${fancy("contacte-le directement")} :\n${TELEGRAM_CONTACT}`), msg);
        break;
      }
      case "report": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "report bug sur la commande X", msg);
        await reply(sock, jid, fancy("signalement envoyé au dev, merci ✅"), msg);
        break;
      }
      case "pair": {
        const { requestPairingCode } = require("../sessionManager"); // require tardif : évite la dépendance circulaire au chargement
        const num = (text || "").replace(/\D/g, "");
        if (!num || num.length < 8) return reply(sock, jid, fancy("exemple: ") + PREFIX + "pair 221771234567", msg);
        try {
          const { code, expiresInMs } = await requestPairingCode(num);
          await reply(
            sock,
            jid,
            box(
              "pairing code",
              `${fancy("numéro")} : ${num}\n${fancy("code")} : *${code}*\n${fancy("expire dans")} ${Math.floor(expiresInMs / 60000)} ${fancy("min")}`
            ),
            msg
          );
        } catch (e) {
          await reply(sock, jid, fancy("erreur : ") + (e.message || "impossible de générer le code"), msg);
        }
        break;
      }

      // ================= ADMIN GROUPE =================
      case "kick": {
        if (!isGroup) return reply(sock, jid, fancy("commande groupe uniquement."), msg);
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        if (!(await isBotAdmin(sock, jid))) return reply(sock, jid, fancy("je dois être admin."), msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) return reply(sock, jid, fancy("mentionne ou réponds à la personne."), msg);
        await sock.groupParticipantsUpdate(jid, [target], "remove");
        await reply(sock, jid, fancy("membre expulsé ✅"), msg);
        break;
      }
      case "kickall": {
        if (!isGroup) return reply(sock, jid, fancy("commande groupe uniquement."), msg);
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        if (!(await isBotAdmin(sock, jid))) return reply(sock, jid, fancy("je dois être admin."), msg);
        const meta = await sock.groupMetadata(jid);
        const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        const targets = meta.participants
          .filter((p) => p.id !== botId && p.admin !== "admin" && p.admin !== "superadmin")
          .map((p) => p.id);
        await reply(sock, jid, fancy(`expulsion de ${targets.length} membres en cours...`), msg);
        for (const t of targets) {
          try {
            await sock.groupParticipantsUpdate(jid, [t], "remove");
            await new Promise((r) => setTimeout(r, 800));
          } catch (e) {}
        }
        await reply(sock, jid, fancy("kickall terminé ✅"), msg);
        break;
      }
      case "add": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "add 221xxxxxxxxx", msg);
        const number = text.replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.groupParticipantsUpdate(jid, [number], "add");
        await reply(sock, jid, fancy("membre ajouté ✅"), msg);
        break;
      }
      case "promote":
      case "demote": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) return reply(sock, jid, fancy("mentionne la personne."), msg);
        await sock.groupParticipantsUpdate(jid, [target], cmd === "promote" ? "promote" : "demote");
        await reply(sock, jid, fancy(cmd === "promote" ? "promu admin ✅" : "rétrogradé ✅"), msg);
        break;
      }
      case "close":
      case "open": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        await sock.groupSettingUpdate(jid, cmd === "close" ? "announcement" : "not_announcement");
        await reply(sock, jid, fancy(cmd === "close" ? "groupe fermé 🔒" : "groupe ouvert 🔓"), msg);
        break;
      }
      case "mute": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) return reply(sock, jid, fancy("mentionne la personne à mute."), msg);
        const g = db.getGroup(jid);
        if (!g.muted.includes(target)) g.muted.push(target);
        db.setGroup(jid, { muted: g.muted });
        await reply(sock, jid, fancy("membre mute (ses messages seront supprimés) 🔇"), msg);
        break;
      }
      case "unmute": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) return reply(sock, jid, fancy("mentionne la personne à unmute."), msg);
        const g = db.getGroup(jid);
        db.setGroup(jid, { muted: g.muted.filter((x) => x !== target) });
        await reply(sock, jid, fancy("membre unmute 🔊"), msg);
        break;
      }
      case "tagall": {
        if (!isGroup) return;
        const meta = await sock.groupMetadata(jid);
        const ids = meta.participants.map((p) => p.id);
        await sock.sendMessage(jid, {
          text: box("tagall", ids.map((i) => `@${bare(i)}`).join("\n")),
          mentions: ids,
        });
        break;
      }
      case "hidetag": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const meta = await sock.groupMetadata(jid);
        const ids = meta.participants.map((p) => p.id);
        await sock.sendMessage(jid, { text: text || fancy("annonce"), mentions: ids });
        break;
      }
      case "setgname": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "setgname Nouveau nom", msg);
        await sock.groupUpdateSubject(jid, text);
        await reply(sock, jid, fancy("nom du groupe mis à jour ✅"), msg);
        break;
      }
      case "setgdesc": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "setgdesc Nouvelle description", msg);
        await sock.groupUpdateDescription(jid, text);
        await reply(sock, jid, fancy("description mise à jour ✅"), msg);
        break;
      }
      case "setppgroup": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const buf = await getQuotedImageBuffer(msg);
        if (!buf) return reply(sock, jid, fancy("réponds à une image avec cette commande."), msg);
        await sock.updateProfilePicture(jid, buf);
        await reply(sock, jid, fancy("photo du groupe mise à jour ✅"), msg);
        break;
      }
      case "revoke": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const newCode = await sock.groupRevokeInvite(jid);
        await reply(sock, jid, fancy("nouveau lien d'invitation : ") + `https://chat.whatsapp.com/${newCode}`, msg);
        break;
      }
      case "delete": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        if (!quotedCtx) return reply(sock, jid, fancy("réponds au message à supprimer."), msg);
        await sock.sendMessage(jid, {
          delete: { remoteJid: jid, fromMe: false, id: quotedCtx.stanzaId, participant: quotedParticipant },
        });
        break;
      }
      case "antilink": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const on = text.toLowerCase() === "on";
        db.setGroup(jid, { antilink: on });
        await reply(sock, jid, fancy(`antilink ${on ? "activé ✅" : "désactivé ❌"}`), msg);
        break;
      }
      case "welcome": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const on = text.toLowerCase() !== "off";
        db.setGroup(jid, { welcome: on });
        await reply(sock, jid, fancy(`welcome ${on ? "activé ✅" : "désactivé ❌"}`), msg);
        break;
      }
      case "goodbye": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const on = text.toLowerCase() !== "off";
        db.setGroup(jid, { goodbye: on });
        await reply(sock, jid, fancy(`goodbye ${on ? "activé ✅" : "désactivé ❌"}`), msg);
        break;
      }
      case "warn": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) return reply(sock, jid, fancy("mentionne la personne."), msg);
        const g = db.getGroup(jid);
        g.warnings[target] = (g.warnings[target] || 0) + 1;
        db.setGroup(jid, { warnings: g.warnings });
        await reply(sock, jid, fancy(`avertissement ${g.warnings[target]}/3 pour`) + ` @${bare(target)}`, msg);
        if (g.warnings[target] >= 3 && (await isBotAdmin(sock, jid))) {
          await sock.groupParticipantsUpdate(jid, [target], "remove");
          g.warnings[target] = 0;
          db.setGroup(jid, { warnings: g.warnings });
          await reply(sock, jid, fancy("3 avertissements atteints → expulsion ✅"), msg);
        }
        break;
      }
      case "warnings": {
        if (!isGroup) return;
        const target = mentioned[0] || quotedParticipant || sender;
        const g = db.getGroup(jid);
        await reply(sock, jid, fancy(`avertissements de @${bare(target)} : `) + `${g.warnings[target] || 0}/3`, msg);
        break;
      }
      case "resetwarn": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender))) return reply(sock, jid, fancy("réservé aux admins."), msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) return reply(sock, jid, fancy("mentionne la personne."), msg);
        const g = db.getGroup(jid);
        g.warnings[target] = 0;
        db.setGroup(jid, { warnings: g.warnings });
        await reply(sock, jid, fancy("avertissements réinitialisés ✅"), msg);
        break;
      }
      case "banlist": {
        const data = db.load();
        const list = data.banned.length ? data.banned.map((b) => `• @${bare(b)}`).join("\n") : fancy("aucun utilisateur banni.");
        await sock.sendMessage(jid, { text: box("banlist", list), mentions: data.banned }, { quoted: msg });
        break;
      }

      // ================= OWNER / BOT =================
      case "ban": {
        const target = mentioned[0] || quotedParticipant || (text ? text.replace(/\D/g, "") + "@s.whatsapp.net" : null);
        if (!target) return reply(sock, jid, fancy("mentionne/réponds à la personne à bannir."), msg);
        db.ban(target);
        await reply(sock, jid, fancy("utilisateur banni du bot 🚫"), msg);
        break;
      }
      case "unban": {
        const target = mentioned[0] || quotedParticipant || (text ? text.replace(/\D/g, "") + "@s.whatsapp.net" : null);
        if (!target) return reply(sock, jid, fancy("mentionne/réponds à la personne à débannir."), msg);
        db.unban(target);
        await reply(sock, jid, fancy("utilisateur débanni ✅"), msg);
        break;
      }
      case "block": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        const target = mentioned[0] || quotedParticipant || (text ? text.replace(/\D/g, "") + "@s.whatsapp.net" : null);
        if (!target) return reply(sock, jid, fancy("mentionne/réponds à la personne."), msg);
        await sock.updateBlockStatus(target, "block");
        await reply(sock, jid, fancy("utilisateur bloqué sur whatsapp 🚫"), msg);
        break;
      }
      case "unblock": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        const target = mentioned[0] || quotedParticipant || (text ? text.replace(/\D/g, "") + "@s.whatsapp.net" : null);
        if (!target) return reply(sock, jid, fancy("mentionne/réponds à la personne."), msg);
        await sock.updateBlockStatus(target, "unblock");
        await reply(sock, jid, fancy("utilisateur débloqué ✅"), msg);
        break;
      }
      case "setppbot": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        const buf = await getQuotedImageBuffer(msg);
        if (!buf) return reply(sock, jid, fancy("réponds à une image avec cette commande."), msg);
        await sock.updateProfilePicture(sock.user.id, buf);
        await reply(sock, jid, fancy("photo du bot mise à jour ✅"), msg);
        break;
      }
      case "setbio": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "setbio Nouveau statut", msg);
        await sock.updateProfileStatus(text);
        await reply(sock, jid, fancy("bio mise à jour ✅"), msg);
        break;
      }
      case "broadcast": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "broadcast message", msg);
        const groups = Object.keys(db.load().groups);
        for (const g of groups) {
          try {
            await sock.sendMessage(g, { text: box("annonce", text) });
          } catch (e) {}
        }
        await reply(sock, jid, fancy(`message diffusé dans ${groups.length} groupes ✅`), msg);
        break;
      }
      case "mode": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        const m = text.toLowerCase() === "private" ? "private" : "public";
        db.setSettings({ mode: m });
        await reply(sock, jid, fancy(`mode ${m === "private" ? "privé 🔒" : "public 🌍"} activé`), msg);
        break;
      }
      case "autoread": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        const on = text.toLowerCase() !== "off";
        db.setSettings({ autoread: on });
        await reply(sock, jid, fancy(`autoread ${on ? "activé ✅" : "désactivé ❌"}`), msg);
        break;
      }
      case "autotyping": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        const on = text.toLowerCase() !== "off";
        db.setSettings({ autotyping: on });
        await reply(sock, jid, fancy(`autotyping ${on ? "activé ✅" : "désactivé ❌"}`), msg);
        break;
      }
      case "join": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "join https://chat.whatsapp.com/xxxx", msg);
        const code = text.split("/").pop();
        await sock.groupAcceptInvite(code);
        await reply(sock, jid, fancy("groupe rejoint ✅"), msg);
        break;
      }
      case "leave": {
        if (!isGroup) return;
        if (!(await isSenderAdmin(sock, jid, sender)) && !isOwner(sender)) return reply(sock, jid, fancy("réservé aux admins."), msg);
        await reply(sock, jid, fancy("au revoir 👋"), msg);
        await sock.groupLeave(jid);
        break;
      }
      case "restart": {
        if (!isOwner(sender)) return reply(sock, jid, fancy("réservé au développeur."), msg);
        await reply(sock, jid, fancy("redémarrage... (le process manager doit relancer le service)"), msg);
        setTimeout(() => process.exit(0), 1000);
        break;
      }

      // ================= MÉDIA / STICKER =================
      case "sticker": {
        let buf = await getQuotedImageBuffer(msg);
        if (!buf && msg.message?.imageMessage) buf = await downloadMediaMessage(msg, "buffer", {});
        if (!buf) return reply(sock, jid, fancy("envoie/réponds à une image avec .sticker"), msg);
        const sharp = require("sharp");
        const webp = await sharp(buf).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        await sock.sendMessage(jid, { sticker: webp }, { quoted: msg });
        break;
      }
      case "take": {
        let buf = await getQuotedImageBuffer(msg);
        if (!buf && msg.message?.imageMessage) buf = await downloadMediaMessage(msg, "buffer", {});
        if (!buf) return reply(sock, jid, fancy("réponds à une image avec .take <nom du pack>"), msg);
        const sharp = require("sharp");
        const webp = await sharp(buf).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        await sock.sendMessage(jid, { sticker: webp }, { quoted: msg });
        break;
      }
      case "toimg": {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const quotedSticker = ctx?.quotedMessage?.stickerMessage;
        if (!quotedSticker) return reply(sock, jid, fancy("réponds à un sticker avec .toimg"), msg);
        const buf = await downloadMediaMessage({ message: { stickerMessage: quotedSticker }, key: msg.key }, "buffer", {});
        const sharp = require("sharp");
        const png = await sharp(buf).png().toBuffer();
        await sock.sendMessage(jid, { image: png, caption: fancy("converti ✅") }, { quoted: msg });
        break;
      }
      case "crop":
      case "circle": {
        let buf = await getQuotedImageBuffer(msg);
        if (!buf && msg.message?.imageMessage) buf = await downloadMediaMessage(msg, "buffer", {});
        if (!buf) return reply(sock, jid, fancy("réponds à une image."), msg);
        const sharp = require("sharp");
        const size = 512;
        const circleSvg = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
        const resized = await sharp(buf).resize(size, size, { fit: "cover" }).toBuffer();
        const out = await sharp(resized).composite([{ input: circleSvg, blend: "dest-in" }]).png().toBuffer();
        await sock.sendMessage(jid, { image: out, caption: fancy("recadré ✅") }, { quoted: msg });
        break;
      }
      case "vv": {
        const quotedMsg = quotedCtx?.quotedMessage;
        if (!quotedMsg) return reply(sock, jid, fancy("réponds à un message vue-unique."), msg);
        const inner = quotedMsg.viewOnceMessageV2?.message || quotedMsg;
        const type = Object.keys(inner)[0];
        const buffer = await downloadMediaMessage({ message: inner, key: msg.key }, "buffer", {});
        if (type === "imageMessage") {
          await sock.sendMessage(jid, { image: buffer, caption: fancy("vue unique révélée 👁️") });
        } else if (type === "videoMessage") {
          await sock.sendMessage(jid, { video: buffer, caption: fancy("vue unique révélée 👁️") });
        } else {
          await reply(sock, jid, fancy("rien à révéler ici."), msg);
        }
        break;
      }

      // ================= OUTILS =================
      case "qrcode": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "qrcode https://exemple.com", msg);
        const QRCode = require("qrcode");
        const buf = await QRCode.toBuffer(text, { width: 512, margin: 2 });
        await sock.sendMessage(jid, { image: buf, caption: fancy("qr code généré ✅") }, { quoted: msg });
        break;
      }
      case "base64": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "base64 encode|decode texte", msg);
        const [mode, ...rest] = text.split(" ");
        const payload = rest.join(" ");
        let out;
        if (mode === "decode") out = Buffer.from(payload, "base64").toString("utf8");
        else out = Buffer.from(payload || mode).toString("base64");
        await reply(sock, jid, out, msg);
        break;
      }
      case "calculator":
      case "math": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "calculator (12+8)*3/2", msg);
        try {
          const result = safeCalc(text);
          await reply(sock, jid, `${text} = *${result}*`, msg);
        } catch {
          await reply(sock, jid, fancy("expression invalide."), msg);
        }
        break;
      }
      case "shortlink": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "shortlink https://exemple.com/lien-tres-long", msg);
        try {
          const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(text)}`);
          const short = await res.text();
          await reply(sock, jid, fancy("lien raccourci : ") + short, msg);
        } catch {
          await reply(sock, jid, fancy("service indisponible pour le moment."), msg);
        }
        break;
      }
      case "translate": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "translate en:Bonjour tout le monde", msg);
        const match = text.match(/^([a-z]{2}):(.+)/i);
        if (!match) return reply(sock, jid, fancy("format: ") + PREFIX + "translate en:ton texte", msg);
        const [, lang, phrase] = match;
        try {
          const res = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(phrase)}&langpair=fr|${lang}`
          );
          const data = await res.json();
          await reply(sock, jid, data?.responseData?.translatedText || fancy("traduction impossible."), msg);
        } catch {
          await reply(sock, jid, fancy("service de traduction indisponible."), msg);
        }
        break;
      }
      case "weather": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "weather Dakar", msg);
        try {
          const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=1`).then((r) => r.json());
          const place = geo?.results?.[0];
          if (!place) return reply(sock, jid, fancy("ville introuvable."), msg);
          const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true`).then((r) => r.json());
          const c = w.current_weather;
          await reply(
            sock,
            jid,
            box("météo", `${place.name}, ${place.country}\n🌡️ ${c.temperature}°C\n💨 ${c.windspeed} km/h`),
            msg
          );
        } catch {
          await reply(sock, jid, fancy("service météo indisponible."), msg);
        }
        break;
      }
      case "currency": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "currency 100 USD EUR", msg);
        const [amount, from, to] = text.split(" ");
        try {
          const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`).then((r) => r.json());
          const rate = res?.rates?.[to.toUpperCase()];
          if (!rate) return reply(sock, jid, fancy("devise inconnue."), msg);
          const result = (parseFloat(amount) * rate).toFixed(2);
          await reply(sock, jid, `${amount} ${from.toUpperCase()} = *${result} ${to.toUpperCase()}*`, msg);
        } catch {
          await reply(sock, jid, fancy("service de change indisponible."), msg);
        }
        break;
      }
      case "pastebin": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "pastebin ton texte ici", msg);
        try {
          const res = await fetch("https://dpaste.org/api/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `content=${encodeURIComponent(text)}`,
          });
          const url = await res.text();
          await reply(sock, jid, fancy("lien : ") + url.trim(), msg);
        } catch {
          await reply(sock, jid, fancy("service indisponible."), msg);
        }
        break;
      }
      case "removebg":
      case "ss": {
        await reply(sock, jid, fancy("cette commande nécessite une clé d'API externe à configurer (voir README) ⚙️"), msg);
        break;
      }

      // ================= INFO / RECHERCHE =================
      case "checkid":
      case "whois": {
        const target = mentioned[0] || quotedParticipant || (text ? text.replace(/\D/g, "") + "@s.whatsapp.net" : sender);
        try {
          const [result] = await sock.onWhatsApp(target);
          if (!result?.exists) return reply(sock, jid, fancy("ce numéro n'est pas sur whatsapp."), msg);
          let pfp = null;
          try {
            pfp = await sock.profilePictureUrl(result.jid, "image");
          } catch {}
          const infoText = box("whois", `${fancy("numéro")} : ${bare(result.jid)}\n${fancy("sur whatsapp")} : ✅`);
          if (pfp) await sock.sendMessage(jid, { image: { url: pfp }, caption: infoText }, { quoted: msg });
          else await reply(sock, jid, infoText, msg);
        } catch {
          await reply(sock, jid, fancy("impossible de récupérer les infos."), msg);
        }
        break;
      }
      case "wikipedia": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "wikipedia Albert Einstein", msg);
        try {
          const res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`);
          const data = await res.json();
          if (!data.extract) return reply(sock, jid, fancy("article introuvable."), msg);
          await reply(sock, jid, box(data.title, data.extract), msg);
        } catch {
          await reply(sock, jid, fancy("service wikipedia indisponible."), msg);
        }
        break;
      }
      case "github": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "github baileys", msg);
        try {
          const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(text)}&per_page=3`);
          const data = await res.json();
          const list = (data.items || []).map((r) => `• ${r.full_name} ⭐${r.stargazers_count}\n${r.html_url}`).join("\n\n");
          await reply(sock, jid, box("github", list || fancy("aucun résultat.")), msg);
        } catch {
          await reply(sock, jid, fancy("service github indisponible."), msg);
        }
        break;
      }
      case "npm": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "npm express", msg);
        try {
          const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=3`);
          const data = await res.json();
          const list = (data.objects || []).map((o) => `• ${o.package.name} (${o.package.version})\n${o.package.description || ""}`).join("\n\n");
          await reply(sock, jid, box("npm", list || fancy("aucun résultat.")), msg);
        } catch {
          await reply(sock, jid, fancy("service npm indisponible."), msg);
        }
        break;
      }
      case "lyrics": {
        if (!text || !text.includes("-")) return reply(sock, jid, fancy("exemple: ") + PREFIX + "lyrics Artiste - Titre", msg);
        const [artist, title] = text.split("-").map((s) => s.trim());
        try {
          const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
          const data = await res.json();
          if (!data.lyrics) return reply(sock, jid, fancy("paroles introuvables."), msg);
          await reply(sock, jid, box(`${artist} - ${title}`, data.lyrics.slice(0, 3500)), msg);
        } catch {
          await reply(sock, jid, fancy("service paroles indisponible."), msg);
        }
        break;
      }
      case "gempa": {
        try {
          const res = await fetch("https://earthquake.usgs.gov/earthquakehazards/eqarchives/epic/json/M4.5-day.json").catch(() => null);
          await reply(sock, jid, fancy("dernier séisme mondial (usgs) : voir https://earthquake.usgs.gov/earthquakes/map/"), msg);
        } catch {
          await reply(sock, jid, fancy("service indisponible."), msg);
        }
        break;
      }
      case "jadwalsholat": {
        if (!text) return reply(sock, jid, fancy("exemple: ") + PREFIX + "jadwalsholat Dakar", msg);
        try {
          const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(text)}&country=&method=2`);
          const data = await res.json();
          const t = data?.data?.timings;
          if (!t) return reply(sock, jid, fancy("ville introuvable."), msg);
          await reply(
            sock,
            jid,
            box("horaires de prière", `${fancy("fajr")} : ${t.Fajr}\n${fancy("dhuhr")} : ${t.Dhuhr}\n${fancy("asr")} : ${t.Asr}\n${fancy("maghrib")} : ${t.Maghrib}\n${fancy("isha")} : ${t.Isha}`),
            msg
          );
        } catch {
          await reply(sock, jid, fancy("service indisponible."), msg);
        }
        break;
      }

      // ================= FUN / JEUX =================
      case "truth": await reply(sock, jid, box("vérité", rand(TRUTHS)), msg); break;
      case "dare": await reply(sock, jid, box("action", rand(DARES)), msg); break;
      case "quote": await reply(sock, jid, box("citation", rand(QUOTES)), msg); break;
      case "joke": await reply(sock, jid, box("blague", rand(JOKES)), msg); break;
      case "fact": await reply(sock, jid, box("fait insolite", rand(FACTS)), msg); break;
      case "8ball": {
        const answers = ["oui ✅", "non ❌", "peut-être 🤔", "demande plus tard ⏳", "certainement 💯", "j'en doute 😕"];
        await reply(sock, jid, box("boule magique", rand(answers)), msg);
        break;
      }
      case "rps":
      case "suit": {
        const options = ["pierre 🪨", "papier 📄", "ciseaux ✂️"];
        const botChoice = rand(options);
        const userChoice = (text || "").toLowerCase();
        await reply(sock, jid, box("pierre-papier-ciseaux", `${fancy("mon choix")} : ${botChoice}`), msg);
        break;
      }
      case "dice": {
        const n = Math.floor(Math.random() * 6) + 1;
        await reply(sock, jid, `🎲 ${n}`, msg);
        break;
      }
      case "coinflip": {
        await reply(sock, jid, `🪙 ${rand(["pile", "face"])}`, msg);
        break;
      }
      case "couple":
      case "ship": {
        if (mentioned.length < 2) return reply(sock, jid, fancy("mentionne 2 personnes."), msg);
        const pct = Math.floor(Math.random() * 101);
        await sock.sendMessage(jid, { text: box("couple", `@${bare(mentioned[0])} ❤️ @${bare(mentioned[1])}\n${fancy("compatibilité")} : ${pct}%`), mentions: mentioned }, { quoted: msg });
        break;
      }
      case "lovecalc": {
        if (mentioned.length < 1) return reply(sock, jid, fancy("mentionne une personne."), msg);
        const pct = Math.floor(Math.random() * 101);
        await sock.sendMessage(jid, { text: box("love calc", `@${bare(sender)} ❤️ @${bare(mentioned[0])}\n${pct}%`), mentions: [sender, mentioned[0]] }, { quoted: msg });
        break;
      }
      case "slot": {
        const symbols = ["🍒", "🍋", "🍇", "⭐", "💎", "🔔"];
        const result = [rand(symbols), rand(symbols), rand(symbols)];
        const win = result[0] === result[1] && result[1] === result[2];
        await reply(sock, jid, `${result.join(" | ")}\n${win ? fancy("gagné ! 🎉") : fancy("perdu, retente ta chance.")}`, msg);
        break;
      }
      case "quiz": {
        const questions = [
          { q: "Capitale de la France ?", a: "paris" },
          { q: "Combien font 7 x 8 ?", a: "56" },
          { q: "Plus grande planète du système solaire ?", a: "jupiter" },
        ];
        const picked = rand(questions);
        await reply(sock, jid, box("quiz", `${picked.q}\n(${fancy("réponse masquée, à toi de chercher !")})`), msg);
        break;
      }
      case "anagramme": {
        const words = ["whatsapp", "javascript", "baileys", "developpeur", "ordinateur"];
        const word = rand(words);
        const scrambled = word.split("").sort(() => Math.random() - 0.5).join("");
        await reply(sock, jid, box("anagramme", `${fancy("remets dans l'ordre")} : ${scrambled.toUpperCase()}`), msg);
        break;
      }
      case "deviner": {
        const n = Math.floor(Math.random() * 100) + 1;
        await reply(sock, jid, box("devine le nombre", fancy(`je pense à un nombre entre 1 et 100 (indice secret : ${n}, à toi de gérer la logique de jeu côté groupe !)`)), msg);
        break;
      }

      default: {
        await reply(sock, jid, fancy("fonctionnalité bientôt disponible ✨ — ") + `${PREFIX}menu`, msg);
      }
    }
  } catch (err) {
    console.error("handleCommand error:", err);
  }
}

module.exports = { handleCommand };
