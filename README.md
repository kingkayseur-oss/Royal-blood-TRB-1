# ᴋᴀʏsᴇᴜʀ_ᴍᴅx — Bot WhatsApp + site de pairing code

Dev : 🍁ᬼ⃟M͢r͢ k͢i͢n͢g͢ k͢a͢y͢s͢e͢u͢r͢🍓

## Contenu du projet

```
kayseur-bot/
├── server.js               # Serveur Express (site + API pairing)
├── bot/
│   ├── sessionManager.js   # Connexion Baileys, génération/expiration du code (2 min)
│   ├── group.js            # Welcome / Goodbye stylés (photo profil / photo groupe)
│   ├── lib/
│   │   ├── font.js          # Style "petites capitales" + nom du dev
│   │   └── db.js             # Petite base JSON (settings groupe, bans)
│   └── commands/
│       ├── handlers.js      # Logique des commandes (kick, kickall, vv, ban...)
│       ├── menu.js          # Génère le menu stylé
│       └── list.js          # Liste des ~100 commandes par catégorie
├── public/
│   ├── index.html           # Page stylée avec vidéo en fond
│   ├── style.css            # Thème animé (néon, particules, glass)
│   ├── script.js             # Appel API + compte à rebours 2 min
│   └── assets/bg.mp4         # Vidéo de fond (convertie en H.264)
└── package.json
```

## Déploiement sur Render

1. Pousse ce dossier sur un repo GitHub.
2. Sur [render.com](https://render.com) → **New +** → **Web Service** → connecte le repo.
3. Configuration :
   - **Build command** : `npm install`
   - **Start command** : `npm start`
   - **Instance type** : Free ou Starter (le Free dort après inactivité, ce qui coupe les sessions WhatsApp — un plan payant est recommandé pour un bot stable 24/7).
4. Render attribue une URL publique type `https://kayseur-mdx.onrender.com` → c'est le site où **n'importe qui peut demander son code**.
5. Dans `public/index.html`, remplace `https://t.me/VOTRE_USERNAME` par ton vrai lien Telegram.

⚠️ Render **Free** a un disque éphémère : à chaque redéploiement, les sessions WhatsApp déjà liées (`sessions/`) sont perdues. Pour une persistance réelle, ajoute un **Render Disk** (payant) monté sur `/opt/render/project/src/sessions`, ou migre le stockage de session vers une base externe (Mongo/Postgres).

## Fonctionnement du pairing code

- Chaque visiteur entre son numéro WhatsApp sur le site.
- Le serveur démarre une session Baileys et appelle `requestPairingCode(numero)`.
- Le code s'affiche avec un compte à rebours de **2 minutes**.
- Si le code n'est pas utilisé dans ce délai, la session est détruite automatiquement → il faut cliquer sur **Régénérer** pour obtenir un nouveau code (bouton déjà câblé : chaque appel à `/api/pair` invalide l'ancienne tentative et en crée une neuve).
- Une fois le code entré dans *Appareils connectés* sur WhatsApp, le bot KAYSEUR_MDX se connecte au compte et les commandes deviennent actives dans les discussions de cette personne.

## Commandes incluses

- **114 commandes** listées dans `bot/commands/list.js`, regroupées par catégorie (général, admin, owner, média, download, fun, outils, info).
- La grande majorité a une **vraie logique fonctionnelle** dans `bot/commands/handlers.js` (plus de 55 implémentées en détail), notamment :
  - **Général** : `menu` (image + bouton chaîne), `ping`, `owner`, `runtime`, `about`, `rules`, `credit`, `donate`, `report`, **`pair`** (génère un pairing code pour n'importe quel numéro, directement depuis WhatsApp).
  - **Admin groupe** : `kick`, `kickall`, `add`, `promote`, `demote`, `close`/`open`, `mute`/`unmute` (suppression auto des messages d'un membre mute), `tagall`, `hidetag`, `setgname`, `setgdesc`, `setppgroup`, `revoke`, `delete`, `antilink` (suppression auto des liens), `welcome`/`goodbye` on-off, `warn`/`warnings`/`resetwarn`, `banlist`.
  - **Owner/bot** (protégées par `OWNER_NUMBERS`) : `ban`/`unban`, `block`/`unblock`, `setppbot`, `setbio`, `broadcast`, `mode public/private`, `autoread`, `autotyping`, `join`, `leave`, `restart`.
  - **Média** : `sticker`, `take`, `toimg`, `crop`/`circle`, `vv` (révélation vue-unique).
  - **Outils** : `qrcode`, `base64`, `calculator`/`math`, `shortlink`, `translate`, `weather`, `currency`, `pastebin`.
  - **Info/recherche** : `whois`/`checkid`, `wikipedia`, `github`, `npm`, `lyrics`, `jadwalsholat`.
  - **Fun/jeux** : `truth`, `dare`, `quote`, `joke`, `fact`, `8ball`, `rps`/`suit`, `dice`, `coinflip`, `couple`/`ship`, `lovecalc`, `slot`, `quiz`, `anagramme`, `deviner`.
- Les commandes nécessitant une **clé d'API payante** (`removebg`, `ss`) ou une API instable/non testable depuis cet environnement (`apk`, `tiktok`, `instagram`, `facebook`, `twitter`, `ytmp3`, `ytmp4`, `play`, `pinterest`, `attp`, `emojimix`, `qc`, `tovideo`, `toaudio`, `tts`, `sticker2wa`) répondent pour l'instant « fonctionnalité bientôt disponible » — la structure `switch(cmd)` dans `handlers.js` est prête pour les compléter une par une.
- Tout le texte généré par le bot passe par `fancy()` (style `ʏsᴇ`) et affiche `🍁ᬼ⃟𝗠꯭𝗥꯭ 𝗖꯭𝗛꯭𝗔꯭𝗡꯭𝗣꯭𝗛꯭𝗜⃝🍓` comme signature du dev.

### Commande `.pair` (nouveau)

En plus du site web, n'importe qui peut taper `.pair 221771234567` directement dans une discussion avec le bot pour recevoir un pairing code (même logique d'expiration à 2 minutes, régénérable en retapant la commande).

### Sécurité : numéros autorisés (owner)

Les commandes sensibles (`ban`, `block`, `setppbot`, `broadcast`, `mode`, `restart`, `join`...) sont réservées aux numéros listés dans `OWNER_NUMBERS` (variable d'environnement, format `221xxxxxxxxx,33xxxxxxxxx`). **Tant que cette variable n'est pas définie, ces commandes restent ouvertes à tout le monde** — pense à la configurer sur Render avant de rendre le bot public.

## Menu avec image + bouton chaîne

- `.menu` envoie désormais l'image `bot/assets/menu.png` en légende du menu complet.
- Un bouton **📡 Voir la chaîne** sous les commandes ouvre directement ta chaîne WhatsApp.
- Le menu s'affiche comme **"transféré depuis"** ta chaîne (bandeau WhatsApp natif).
- À configurer dans `bot/lib/config.js` (ou via variables d'environnement) :
  - `CHANNEL_URL` : lien public de ta chaîne (`https://whatsapp.com/channel/...`)
  - `CHANNEL_JID` : JID `@newsletter` de ta chaîne (nécessaire pour le bandeau "transféré")
  - `CHANNEL_NAME` : nom affiché dans ce bandeau

Pour remplacer l'image du menu, dépose simplement une autre image dans `bot/assets/menu.png` (même nom de fichier).

## Welcome / Goodbye

- **Bienvenue** : envoie la **photo de profil** du nouveau membre avec un message encadré stylé.
- **Au revoir** : envoie la **photo du groupe** avec le nombre de membres restants et un message stylé.
- Activable/désactivable par groupe via `.welcome on/off` et `.goodbye on/off` (admins uniquement).

## ⚠️ Non inclus volontairement

Aucune commande de type « bug » / crash / spam destinée à faire planter WhatsApp ou le téléphone d'un tiers n'a été ajoutée — ce genre d'outil sert uniquement à nuire et n'a pas sa place dans ce projet, quel que soit le nom qu'on lui donne.

## Variables d'environnement (optionnel)

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port du serveur web | `3000` |
| `PREFIX` | Préfixe des commandes | `.` |
| `OWNER_NUMBERS` | Numéros autorisés aux commandes sensibles (séparés par virgule) | *(vide = non restreint)* |
| `CHANNEL_URL` | Lien de la chaîne WhatsApp | déjà rempli |
| `CHANNEL_JID` | JID `@newsletter` de la chaîne (bandeau "transféré depuis") | placeholder, à remplacer |
| `CHANNEL_NAME` | Nom affiché dans le bandeau "transféré depuis" | `ᴋᴀʏsᴇᴜʀ_ᴍᴅx ᴏꜰꜰɪᴄɪᴀʟ` |
| `TELEGRAM_CONTACT` | Lien Telegram du dev | `https://t.me/Mr_king_kayseur` |

## Installation locale

```bash
npm install
npm start
# puis ouvre http://localhost:3000
```
