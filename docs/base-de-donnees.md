# Base de données

PostgreSQL avec Prisma. Le schéma est dans `prisma/schema.prisma` et les migrations dans `prisma/migrations`. Le diagramme des tables est dans [diagramme-er.md](diagramme-er.md).

Toutes les commandes se lancent depuis `apps/backend`, avec la base démarrée.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run prisma:generate` | Génère le client Prisma après un changement du schéma |
| `npm run prisma:migrate` | Crée et applique une nouvelle migration |
| `npm run prisma:deploy` | Applique les migrations existantes |
| `npm run prisma:seed` | Remplit la base (voir plus bas) |
| `npm run prisma:studio` | Ouvre une interface pour voir la base |

## Le seed

Le seed est relancé à chaque démarrage de Docker. Il peut être exécuté plusieurs fois sans créer de doublons.

| Il crée | Détail |
|---|---|
| Les quartiers | Apex, Echo, Warden, Xeno et Zion |
| Les adjacences | Quels quartiers se touchent |
| Les ressources | 10 types, avec leur stock initial dans chaque quartier |
| Le compte admin | Seulement si `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont définis dans `.env` |

Aucun autre compte n'est créé.

## Modifier le schéma

1. Changer `prisma/schema.prisma`.
2. Lancer `npm run prisma:migrate` et donner un nom à la migration.
3. Commiter le schéma et le nouveau dossier de migration.

## Voir la base avec une interface

```bash
npm run prisma:studio
```

Puis ouvrir http://localhost:5555.

Pour un autre outil comme DBeaver ou pgAdmin, utiliser les valeurs du fichier `.env` :

| Champ | Valeur |
|---|---|
| Hôte | `localhost` |
| Port | `5432` |
| Base | `kaiju` |
| Utilisateur | `kaiju` |
| Mot de passe | valeur de `POSTGRES_PASSWORD` |
