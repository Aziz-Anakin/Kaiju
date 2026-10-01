# KAIJU

Plateforme de gestion de crise pour la ville fictive de **Tokyork**. Pendant une attaque de Kaiju, les équipes de chaque quartier réservent, partagent et transfèrent des ressources critiques (personnel médical, véhicules, abris, générateurs...) en temps réel.

## Ce que fait l'application

- **Carte de la ville** : les 5 quartiers sont colorés selon leur niveau de crise, du vert au rouge.
- **Ressources** : le stock de chaque ressource dans chaque quartier, avec un code couleur selon son état.
- **Réservations** : un coordinateur réserve des ressources de son quartier, avec un calendrier.
- **Transferts** : un quartier demande des ressources à un autre, directement s'ils sont voisins, ou en passant par un quartier de transit.
- **Niveaux de crise** : le City Director fait évoluer le niveau de chaque quartier, ce qui ouvre ou ferme des actions.
- **Temps réel** : tous les écrans se mettent à jour quand quelqu'un agit.
- **Gestion des comptes** : un compte admin crée les comptes et choisit leurs rôles.

## Les rôles

| Rôle | Ce qu'il fait |
|---|---|
| Quarter Coordinator (QC) | Gère les ressources et les demandes de son quartier |
| Logistics Coordinator (LC) | Organise des transferts entre quartiers quand la crise est assez haute |
| City Director (CD) | Change les niveaux de crise, réquisitionne, abaisse la rétention |
| Admin | A tous les droits du CD et gère les comptes |

Détails dans [Comptes et rôles](docs/comptes.md).

## Lancement rapide

Il faut Docker avec Docker Compose.

1. Créer le fichier `.env` à partir du modèle.

```bash
cp .env.example .env
```

2. Dans `.env`, remplacer les valeurs `change_me` (mot de passe de la base, secret JWT) et choisir `ADMIN_EMAIL` et `ADMIN_PASSWORD` pour le compte admin.

3. Lancer la base de données, le backend et le frontend.

```bash
docker compose up -d --build
```

| Service | Adresse |
|---|---|
| Site | http://localhost:5173 |
| API | http://localhost:3000 |
| Documentation de l'API | http://localhost:3000/docs |

Ensuite, se connecter avec le compte admin, ou créer un compte QC depuis la page d'inscription.

## Technologies

| Partie | Outils |
|---|---|
| Frontend | React, Vite, Tailwind CSS, shadcn/ui, Radix |
| Backend | NestJS, Socket.IO, JWT |
| Base de données | PostgreSQL avec Prisma |
| Outils | Docker Compose, Jest, Supertest |

## Documentation

| Fichier | Contenu |
|---|---|
| [Docker](docs/docker.md) | Lancer, arrêter et réinitialiser le projet |
| [Comptes et rôles](docs/comptes.md) | Les 4 rôles, créer l'admin et gérer les comptes |
| [Backend](docs/backend.md) | Modules, commandes et tests de l'API |
| [Frontend](docs/frontend.md) | Commandes et organisation du site |
| [Base de données](docs/base-de-donnees.md) | Prisma, migrations et seed |
| [Diagramme de la base](docs/diagramme-er.md) | Tables et relations |
| [Codes d'erreur](docs/erreurs.md) | Le code HTTP de chaque refus de l'API |

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `apps/backend` | API NestJS |
| `apps/frontend` | Application React |
| `prisma` | Schéma et migrations de la base de données |
| `docs` | Documentation du projet |

Projet réalisé dans le cadre de mes études, durant mon année à Epitech Paris.
