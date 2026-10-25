const express = require("express");
const path = require("path");
const { requestPairingCode, getStatus } = require("./bot/sessionManager");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Demande (ou régénère) un code de pairing pour un numéro.
// Tout le monde peut appeler cette route à tout moment -> chaque appel
// invalide l'ancienne session en attente et en crée une nouvelle (régénération).
app.post("/api/pair", async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: "Numéro manquant" });
    const { code, expiresInMs } = await requestPairingCode(number);
    res.json({ code, expiresInMs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

app.get("/api/status/:number", (req, res) => {
  res.json(getStatus(req.params.number));
});

app.get("/health", (_req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 KAYSEUR_MDX web up on :${PORT}`));
