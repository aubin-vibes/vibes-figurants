# VIBES — Gestion figurants & autorisations de droit à l'image

Application web réutilisable pour gérer les figurants de tes tournages :
formulaire d'inscription **verrouillé par projet** (lien partageable), **signature manuscrite** au doigt sur téléphone,
détection automatique des **mineurs** (2ᵉ signature du représentant légal), **tableau de bord** privé (toi + Ange)
avec pointage de présence et **export PDF** des cessions (une par personne ou tout le projet d'un coup).

Stack : **Next.js** (front) · **Supabase** (base Postgres privée + connexion admin) · **Vercel** (hébergement).
Coût : **0 €** aux volumes d'un tournage (offres gratuites).

> Je ne te demande jamais tes identifiants : tu crées tes comptes Supabase/Vercel toi-même, tu colles tes clés dans un fichier local, et c'est tout.

---

## Étape 1 — Supabase (la base de données)

1. Crée un compte sur https://supabase.com → **New project**. Note le mot de passe de la base.
2. Dans le menu **SQL Editor** → **New query**, colle tout le contenu de `supabase/schema.sql` puis **Run**.
   (Ça crée les tables `projects` et `figurants` et active la sécurité RLS.)
3. Menu **Authentication → Users → Add user** : crée **deux comptes** (email + mot de passe), un pour toi, un pour Ange.
4. Menu **Authentication → Sign In / Providers** (ou *Settings*) : **désactive les inscriptions publiques**
   (« Allow new users to sign up » → OFF) pour que personne d'autre ne puisse créer de compte admin.
5. Menu **Project Settings → API** : copie **Project URL** et la clé **anon public**. Tu en as besoin à l'étape 2.

---

## Étape 2 — Lancer en local (test)

Prérequis : **Node.js 18+** installé.

```bash
# dans le dossier du projet
cp .env.local.example .env.local
# ouvre .env.local et colle ton URL + ta clé anon de l'étape 1
npm install
npm run dev
```

Ouvre http://localhost:3000/admin → connecte-toi avec un des comptes créés.
Crée un projet, ouvre son lien `…/signer/<slug>`, inscris une personne (avec signature), reviens au dashboard.

---

## Étape 3 — Mettre en ligne (Vercel)

1. Crée un dépôt GitHub et pousse ce dossier (ou utilise « Deploy » depuis Claude Code).
2. Sur https://vercel.com → **Add New Project** → importe le dépôt.
3. Dans **Environment Variables**, ajoute les deux mêmes clés :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Vercel te donne une URL, ex. `https://vibes-figurants.vercel.app`.

Tes liens deviennent alors : formulaire `…/signer/wanted`, dashboard `…/admin`.

---

## Utilisation au quotidien

- **Créer un projet** : onglet *Projets* → renseigne nom, lien, date et lieu de tournage (la date/lieu apparaissent sur le PDF).
- **Partager** : copie le lien du projet, envoie-le par tes canaux habituels (WhatsApp, mail…).
- **Suivi** : onglet *Suivi* → filtre par projet, vois qui s'est inscrit, **marque les présents** le jour J,
  télécharge une cession (**PDF**) ou **toutes les autorisations** du projet en un clic.

## Sécurité & données

- Les données personnelles des figurants ne sont **lisibles qu'après connexion** (toi & Ange). La règle est appliquée
  côté base (Row Level Security), pas seulement dans l'interface : même en bricolant l'URL, personne ne peut lire la liste.
- Le formulaire public peut **uniquement créer** une inscription, jamais lire les autres.

## Personnalisation

- **Texte de la cession** : `lib/cessionPdf.js` (PDF) et `app/signer/[slug]/page.js` (à l'écran). Garde les deux cohérents.
- **Charte graphique** : `app/globals.css` (couleurs, polices).
- **Champs** : ajoute une colonne dans `supabase/schema.sql`, puis le champ dans le formulaire et le PDF.

> Le modèle de cession est fourni à titre indicatif. Pour une exploitation commerciale large, fais-le valider par un conseil juridique (durée, territoire, supports).
