const { fancy, BOT_NAME_FANCY, DEV_NAME } = require("./lib/font");
const db = require("./lib/db");

const DEFAULT_PIC = "https://i.ibb.co/4pDNDk1/avatar-default.png";

async function getPfp(sock, id) {
  try {
    return await sock.profilePictureUrl(id, "image");
  } catch {
    return DEFAULT_PIC;
  }
}

/**
 * Écoute group-participants.update (ajout / départ) et envoie
 * le message stylé correspondant avec la photo appropriée.
 */
function registerGroupEvents(sock) {
  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id: groupId, participants, action } = update;
      const settings = db.getGroup(groupId);
      const meta = await sock.groupMetadata(groupId);

      if (action === "add" && settings.welcome) {
        for (const user of participants) {
          const pfp = await getPfp(sock, user);
          const caption = [
            `╭─❖ ${fancy("bienvenue")} ❖─╮`,
            `│`,
            `│ 👋 @${user.split("@")[0]}`,
            `│ ${fancy("bienvenue dans")} ${meta.subject}`,
            `│ ${fancy("membre n°")} ${meta.participants.length}`,
            `│`,
            `╰────────────────╯`,
            `${fancy("dev")} : ${DEV_NAME}`,
            `${BOT_NAME_FANCY}`,
          ].join("\n");

          await sock.sendMessage(groupId, {
            image: { url: pfp },
            caption,
            mentions: [user],
          });
        }
      }

      if (action === "remove" && settings.goodbye) {
        let groupPic = DEFAULT_PIC;
        try {
          groupPic = await sock.profilePictureUrl(groupId, "image");
        } catch {}
        const remaining = meta.participants.length;

        for (const user of participants) {
          const caption = [
            `╭─❖ ${fancy("au revoir")} ❖─╮`,
            `│`,
            `│ 🥀 @${user.split("@")[0]}`,
            `│ ${fancy("a quitté le groupe")}`,
            `│ ${fancy("il reste")} ${remaining} ${fancy("membres")}`,
            `│`,
            `╰────────────────╯`,
            `${fancy("dev")} : ${DEV_NAME}`,
            `${BOT_NAME_FANCY}`,
          ].join("\n");

          await sock.sendMessage(groupId, {
            image: { url: groupPic },
            caption,
            mentions: [user],
          });
        }
      }
    } catch (err) {
      console.error("group-participants.update error:", err);
    }
  });
}

module.exports = { registerGroupEvents };
