# Comptes et rôles

Quatre rôles, du plus limité au plus puissant :

| Rôle | Pouvoirs |
|---|---|
| Quarter Coordinator (QC) | Gère les ressources et les demandes de son quartier |
| Logistics Coordinator (LC) | Organise des transferts entre quartiers selon le niveau de crise |
| City Director (CD) | Change les niveaux de crise, réquisitionne et abaisse la rétention |
| Admin | A tous les droits du CD, et gère les comptes (page « Comptes ») |

## Devenir admin

L'admin n'existe pas à l'inscription : il est créé au démarrage par le seed.

1. Renseigner `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans `.env`
2. Lancer `docker compose up -d --build`
3. Se connecter avec ce compte sur le site

Si le compte existe déjà, le seed remet son mot de passe et son rôle admin. Sans ces deux variables, aucun admin n'est créé.

## Gérer les comptes

Depuis la page **Comptes** (visible seulement pour l'admin) :

- créer un compte avec n'importe quel rôle, y compris un autre admin
- changer le rôle d'un compte, avec un quartier pour un QC
- supprimer un compte, sauf s'il a déjà des réservations ou des transferts

Un admin ne peut ni modifier ni supprimer son propre compte. L'inscription publique crée toujours un QC, et il n'y a qu'un QC par quartier.

Les mêmes actions existent dans l'API : `GET /users`, `POST /users`, `PATCH /users/:id` et `DELETE /users/:id`, toutes réservées à l'admin.
