/**
 * Liste complète des commandes de KAYSEUR_MDX, groupées par catégorie.
 * "impl" = la commande a une vraie logique dans handlers.js
 * les autres sont des réponses simples/texte prêtes à être enrichies.
 */
module.exports = {
  "⚙️ GÉNÉRAL": [
    "menu", "help", "ping", "speed", "owner", "rules", "about",
    "runtime", "report", "donate", "source", "credit", "pair",
  ],
  "🛡️ ADMIN GROUPE": [
    "kick", "kickall", "add", "promote", "demote", "ban", "unban",
    "banlist", "mute", "unmute", "close", "open", "tagall", "hidetag",
    "setgname", "setgdesc", "setppgroup", "revoke", "antilink",
    "antilink on", "antilink off", "welcome on", "welcome off",
    "goodbye on", "goodbye off", "delete", "warn", "warnings", "resetwarn",
  ],
  "👑 OWNER / BOT": [
    "block", "unblock", "setppbot", "setbio", "broadcast", "restart",
    "mode public", "mode private", "autoread", "autotyping", "join",
    "leave",
  ],
  "🖼️ MÉDIA / STICKER": [
    "sticker", "toimg", "tovideo", "toaudio", "vv", "take", "crop",
    "circle", "emojimix", "attp", "qc",
  ],
  "⬇️ DOWNLOAD": [
    "ytmp3", "ytmp4", "tiktok", "instagram", "facebook", "twitter",
    "play", "lyrics", "apk", "pinterest",
  ],
  "🎮 FUN / JEUX": [
    "truth", "dare", "quote", "joke", "fact", "quiz", "rps", "dice",
    "couple", "lovecalc", "ship", "slot", "math", "anagramme",
    "deviner", "suit", "coinflip", "8ball",
  ],
  "🧰 OUTILS": [
    "sticker2wa", "translate", "tts", "shortlink", "weather", "currency",
    "pastebin", "base64", "qrcode", "removebg", "ss", "calculator",
  ],
  "🔎 INFO / RECHERCHE": [
    "whois", "checkid", "gempa", "jadwalsholat", "wikipedia", "search",
    "github", "npm", "lirik",
  ],
};
