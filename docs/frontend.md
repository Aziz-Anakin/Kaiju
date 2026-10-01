# Frontend

Application React avec Vite, Tailwind CSS et shadcn/ui. Toutes les commandes se lancent depuis `apps/frontend`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm install` | Installe les dépendances |
| `npm run dev` | Lance le site en développement sur http://localhost:5173 |
| `npm run lint` | Vérifie le code |
| `npm run build` | Compile le site |

Le site lit l'adresse de l'API dans `VITE_API_URL` et `VITE_WS_URL`, définies dans le `.env` à la racine.

## Pages

| Page | Contenu | Accès |
|---|---|---|
| Tableau de bord | Carte de la ville et mini-calendrier | Tous |
| Ressources | Stock par quartier | Tous |
| Réservations | Créer, valider et annuler | Tous |
| Transferts | Demander et répondre aux transferts | Tous |
| Calendrier | Réservations du mois | Tous |
| Niveaux de crise | Changer le niveau de chaque quartier | CD et admin |
| Comptes | Créer, modifier et supprimer des comptes | Admin |

## Organisation

| Dossier | Contenu |
|---|---|
| `src/pages` | Une page par écran |
| `src/components` | Carte, calendrier, formulaires et panneaux |
| `src/components/ui` | Composants de base (shadcn, liste déroulante Radix) |
| `src/services` | Appels à l'API et au temps réel |
| `src/lib` | Utilitaires, comme les couleurs des niveaux de crise |

## Codes couleur

Les niveaux de crise utilisent toujours les mêmes couleurs, définies dans `src/lib/levels.ts`.

| Niveau | Nom | Couleur |
|---|---|---|
| 1 | Veille | Vert |
| 2 | Alerte | Jaune |
| 3 | Urgence | Orange |
| 4 | Critique | Rouge |
| 5 | Catastrophe | Rouge sombre |

## Ajouter un composant shadcn

```bash
npx shadcn@latest add card
```
