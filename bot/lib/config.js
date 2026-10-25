/**
 * Infos de la chaîne WhatsApp affichée/suivie depuis le menu.
 * À REMPLIR avec ta vraie chaîne :
 *
 * - CHANNEL_URL  : lien public de ta chaîne (bouton "Voir la chaîne")
 *                  ex: https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXXXX
 * - CHANNEL_JID  : le JID "@newsletter" de ta chaîne, utilisé pour que le
 *                  menu apparaisse comme "transféré depuis" ta chaîne.
 *                  Récupère-le en ouvrant ta chaîne dans WhatsApp Web et en
 *                  inspectant les requêtes réseau, ou via
 *                  sock.newsletterMetadata("invite", "TON_CODE_INVITATION")
 *                  dans un petit script de test.
 * - CHANNEL_NAME : nom affiché dans le bandeau "transféré depuis".
 */
module.exports = {
  CHANNEL_URL: process.env.CHANNEL_URL || "https://whatsapp.com/channel/0029Vb8cfQn8V0te5K0atc1s",
  // CHANNEL_JID reste un placeholder : WhatsApp ne donne pas le JID "@newsletter"
  // depuis un simple lien public. Récupère-le une fois le bot connecté avec :
  //   await sock.newsletterMetadata("invite", "0029Vb8cfQn8V0te5K0atc1s")
  // et colle le "id" retourné ici (ou en variable d'environnement CHANNEL_JID).
  CHANNEL_JID: process.env.CHANNEL_JID || "120363000000000000@newsletter",
  CHANNEL_NAME: process.env.CHANNEL_NAME || "ᴋᴀʏsᴇᴜʀ_ᴍᴅx ᴏꜰꜰɪᴄɪᴀʟ",

  // Numéros autorisés à utiliser les commandes sensibles (block, broadcast,
  // restart, mode, setppbot...). Format: "221xxxxxxxxx,33xxxxxxxxx"
  OWNER_NUMBERS: (process.env.OWNER_NUMBERS || "").split(",").map((n) => n.trim()).filter(Boolean),

  TELEGRAM_CONTACT: process.env.TELEGRAM_CONTACT || "https://t.me/Mr_king_kayseur",
};
