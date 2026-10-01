# Backend

API NestJS du projet. Le serveur applique les règles métier : rôles, niveaux de crise, adjacence entre quartiers et seuils de rétention.

Toutes les commandes se lancent depuis `apps/backend`.

## Organisation

Chaque fonctionnalité a son propre module dans `src/`.

| Module | Rôle |
|---|---|
| `auth` | Inscription, connexion et guards de rôle |
| `users` | Gestion des comptes, réservée à l'admin |
| `quarters` | Les 5 quartiers, leurs voisins et la rétention |
| `resources` | Les types de ressources |
| `inventory` | Stock de chaque ressource par quartier |
| `disasters` | Niveaux de crise et matrice de permissions |
| `reservations` | Réservations dans son propre quartier |
| `transfers` | Transferts de ressources entre quartiers |
| `websocket` | Notifications en temps réel |
| `prisma` | Accès à la base de données |

## Commandes

| Commande | Rôle |
|---|---|
| `npm install` | Installe les dépendances |
| `npm run start:dev` | Lance l'API en mode développement |
| `npm run lint` | Vérifie le code |
| `npm run build` | Compile le projet |
| `npm test` | Lance les tests unitaires |
| `npm run test:e2e` | Lance les tests end-to-end |

## Tests end-to-end

Les tests e2e appellent la vraie API sur la vraie base. Il faut donc que PostgreSQL tourne et que la base soit migrée et remplie (le plus simple : `docker compose up -d` à la racine).

| Fichier | Ce qu'il vérifie |
|---|---|
| `kaiju.e2e-spec.ts` | Connexion, inscription et routes protégées |
| `disasters.e2e-spec.ts` | Niveaux de crise, quartiers et rétention |
| `reservations.e2e-spec.ts` | Création, validation et annulation des réservations |
| `transfers.e2e-spec.ts` | Transferts directs, refus et plancher de rétention |
| `users.e2e-spec.ts` | Rôle admin et gestion des comptes |

Les tests créent leurs propres comptes, les suppriment à la fin et remettent les stocks et les niveaux de crise à leur valeur d'origine.

## Adresses utiles

| Adresse | Rôle |
|---|---|
| http://localhost:3000/health | Vérifie que l'API répond |
| http://localhost:3000/docs | Documentation Swagger de l'API |

Pour tester une route protégée dans Swagger, se connecter avec `POST /auth/login`, copier le `access_token`, cliquer sur **Authorize** et le coller.
