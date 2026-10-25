/**
 * KAYSEUR_MDX - Fancy font helper
 * Convertit un texte normal en style petites-capitales "ʏsᴇ"
 * utilisé partout dans le bot (menu, welcome, goodbye, réponses...).
 */

const MAP = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ",
  i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴩ",
  q: "ǫ", r: "ʀ", s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x",
  y: "ʏ", z: "ᴢ",
};

/** Style un texte en petites capitales (garde chiffres/symboles/emoji intacts) */
function fancy(text = "") {
  return String(text)
    .split("")
    .map((ch) => {
      const lower = ch.toLowerCase();
      if (MAP[lower]) return ch === lower ? MAP[lower] : MAP[lower].toUpperCase();
      return ch;
    })
    .join("");
}

// Identité fixe du bot / du dev (ne pas transformer, déjà stylées)
const BOT_NAME = "𝐊𝐀𝐘𝐒Σ𝐔𝐑×͜×𝐌𝐃𝐗";
const BOT_NAME_FANCY = "ᴋᴀʏsᴇᴜʀ_ᴍᴅx";
const DEV_NAME = "*🍁ᬼ⃟M͢R͢ K͢I͢N͢G͢ K͢A͢Y͢S͢E͢U͢R͢🍓*";

/** Cadre stylé utilisé pour le welcome / goodbye / menu */
function box(title, body) {
  return [
    "╭─❖ " + fancy(title) + " ❖─╮",
    "│",
    body
      .split("\n")
      .map((l) => "│ " + l)
      .join("\n"),
    "│",
    "╰────────────────╯",
    `${fancy("dev")} : ${DEV_NAME}`,
  ].join("\n");
}

module.exports = { fancy, BOT_NAME, BOT_NAME_FANCY, DEV_NAME, box };
