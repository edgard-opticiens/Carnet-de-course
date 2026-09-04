# Carnet de Course

Application web (Next.js) qui se connecte au compte Strava de chaque visiteur via OAuth et lui
affiche son propre dashboard de progression en course à pied : volume, allure, fréquence
cardiaque, courses marquantes, et des propositions de sorties générées à partir de ses propres
données.

Contrairement à un dashboard statique, chaque visiteur voit **ses** données : rien n'est
codé en dur, rien n'est partagé entre utilisateurs. Aucune base de données n'est utilisée — les
tokens Strava vivent dans un cookie chiffré côté navigateur, et les données sont recalculées à
chaque chargement de la page.

## 1. Créer une appli Strava (5 minutes)

1. Va sur https://www.strava.com/settings/api et crée une application.
2. Renseigne n'importe quel nom/site web (ex: `Carnet de Course`, `http://localhost:3000`).
3. Dans **Authorization Callback Domain**, mets :
   - `localhost` pour tester en local
   - le domaine de ton déploiement (ex. `carnet-de-course.vercel.app`, sans `https://`) une fois en ligne
4. Note le **Client ID** et le **Client Secret** affichés.

Limites Strava à connaître : 100 requêtes / 15 min et 1000 / jour par appli. Largement
suffisant pour un usage personnel ou entre amis.

## 2. Configurer les variables d'environnement

Copie `.env.example` vers `.env.local` et remplis :

```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
APP_URL=http://localhost:3000
SESSION_SECRET=... (génère avec `openssl rand -base64 32`)
```

## 3. Lancer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000, clique sur "Se connecter avec Strava", autorise l'accès : le
dashboard se construit à partir de tes 18 derniers mois d'activités de course à pied.

## 4. Déployer (Vercel, recommandé)

1. Pousse ce dossier sur un repo GitHub.
2. Sur https://vercel.com, "Add New Project" → importe le repo.
3. Dans les réglages du projet Vercel, ajoute les 4 variables d'environnement ci-dessus.
   `APP_URL` doit être l'URL Vercel finale (ex. `https://carnet-de-course.vercel.app`,
   **sans slash final**).
4. Déploie. Mets ensuite à jour le "Authorization Callback Domain" de ton appli Strava avec ce
   même domaine.

Toute autre plateforme supportant Next.js (Netlify, Railway, Render, un serveur Node avec
`npm run build && npm start`) fonctionne aussi de la même façon.

## 5. Partager avec des amis

Une fois déployée, l'URL fonctionne pour n'importe qui : chaque personne clique sur "Se
connecter avec Strava", autorise l'accès à son propre compte, et voit son propre dashboard.
Attention aux limites de l'appli Strava (1000 requêtes/jour) si beaucoup de monde s'en sert le
même jour — chaque chargement de dashboard consomme 1 à quelques requêtes selon le nombre
d'activités.

## Ce qui est calculé automatiquement

- Volume cumulé, mensuel, comparaison 8 dernières semaines vs 8 précédentes.
- Allure et fréquence cardiaque, colorées selon les zones FC configurées sur Strava (ou une
  estimation générique si elles ne le sont pas).
- Courses marquantes : activités marquées "course" sur Strava, ou à défaut les sorties les plus
  longues/rapides de la période.
- Un « constat » et quatre propositions de sortie (fondamentale, fartlek, longue, côtes) générés
  par des règles simples à partir du volume récent — pas d'IA, pas d'appel externe.
- Une trajectoire d'entraînement générique si l'utilisateur indique une date d'objectif (stockée
  uniquement dans son navigateur).

## Limites connues

- Pas de base de données : rien n'est mis en cache, chaque chargement de dashboard refait les
  appels à l'API Strava (quelques centaines de ms à quelques secondes selon le volume d'activités).
- Fenêtre d'analyse fixée à 18 mois (modifiable dans `app/api/dashboard-data/route.ts`,
  constante `MONTHS_BACK`).
- Les recommandations sont des règles simples, pas un plan d'entraînement individualisé — le
  texte le rappelle explicitement dans l'appli.
