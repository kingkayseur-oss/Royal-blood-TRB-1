const { fancy, BOT_NAME_FANCY, DEV_NAME } = require("../lib/font");
const list = require("./list");

function buildMenu(prefix = ".") {
  let total = 0;
  const lines = [];
  lines.push(`╭━━〔 ${BOT_NAME_FANCY} 〕━━╮`);
  lines.push(`┃ ${fancy("dev")} : ${DEV_NAME}`);
  lines.push(`┃ ${fancy("prefix")} : ${prefix}`);
  lines.push(`╰━━━━━━━━━━━━━━━╯`);

  for (const [cat, cmds] of Object.entries(list)) {
    lines.push("");
    lines.push(`╭──「 ${fancy(cat.replace(/[^\w\s]/g, "").trim())} 」`);
    for (const c of cmds) {
      lines.push(`│ ${fancy("•")} ${prefix}${c}`);
      total++;
    }
    lines.push(`╰─────────────`);
  }

  lines.push("");
  lines.push(fancy(`total commandes : ${total}`));
  lines.push(fancy("powered by") + " " + BOT_NAME_FANCY);
  return lines.join("\n");
}

module.exports = { buildMenu };
