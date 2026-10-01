# Docker

Docker lance la base PostgreSQL, le backend et le frontend avec une seule commande. Toutes les commandes se lancent depuis la racine du projet.

## Avant de lancer

Le fichier `.env` doit exister. S'il manque, le créer à partir du modèle :

```bash
cp .env.example .env
```

Les variables importantes :

| Variable | Rôle |
|---|---|
| `POSTGRES_PASSWORD` | Mot de passe de la base |
| `JWT_SECRET` | Secret qui signe les tokens de connexion |
| `ADMIN_EMAIL` et `ADMIN_PASSWORD` | Compte admin créé au démarrage |

## Lancer le projet

```bash
docker compose up -d --build
```

| Service | Adresse | Port |
|---|---|---|
| Frontend | http://localhost:5173 | 5173 |
| Backend | http://localhost:3000 | 3000 |
| Documentation de l'API | http://localhost:3000/docs | 3000 |
| PostgreSQL | `localhost` | 5432 |

Au démarrage, le backend applique les migrations, puis remplit la base avec les quartiers, leurs adjacences et les ressources. Si `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont définis, il crée aussi le compte admin.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `docker compose up -d --build` | Lance tout en reconstruisant les images |
| `docker compose up -d` | Relance sans reconstruire |
| `docker compose down` | Arrête tout en gardant les données |
| `docker compose down -v` | Arrête tout et vide la base |
| `docker compose ps` | Affiche les conteneurs qui tournent |
| `docker logs kaiju-backend` | Affiche les logs du backend |
| `docker logs kaiju-frontend` | Affiche les logs du frontend |

## Repartir d'une base vide

```bash
docker compose down -v
docker compose up -d --build
```

Cette commande efface tous les comptes, réservations et transferts. Le seed recrée ensuite les quartiers, les ressources et l'admin.

## Problèmes fréquents

- **Port déjà pris** : si 3000 ou 5173 sont occupés, arrêter `npm run start:dev` ou `npm run dev` avant de lancer Docker.
- **Impossible de se connecter en admin** : vérifier `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans `.env`, puis relancer avec `docker compose up -d --build`. Le seed remet le mot de passe à jour.
- **Docker ne répond pas** : vérifier que Docker Desktop est bien démarré.
