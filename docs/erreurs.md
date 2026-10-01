# Codes d'erreur

Chaque refus de l'API renvoie un code et un message distincts, qui disent quelle règle a été violée. Chacune des trois règles métier a donc son propre code, qu'aucune autre n'utilise, et le corps de la réponse la nomme dans le champ `rule`.

## Les trois règles métier

| Code | Règle | `rule` | Exemples |
|---|---|---|---|
| **403** | Permission | `permission` | un QC demande pour un autre quartier, une action interdite à ce niveau de crise, un LC qui tente de valider |
| **422** | Adjacence | `adjacency` | quartier de transit qui ne touche pas les deux autres, un voisin du demandeur a déjà le surplus, un transit par Xeno pendant qu'elle attend la même ressource |
| **423** | Rétention | `retention` | un transfert ou un retrait ferait passer le quartier sous son plancher |

Exemple de réponse :

```json
{
  "statusCode": 423,
  "error": "Locked",
  "rule": "retention",
  "message": "Rétention : le quartier A doit conserver 4 unité(s) de Medical personnel sur une dotation de 12, il ne peut en céder que 8"
}
```

Le code 423 veut dire *Locked* : les unités protégées par la rétention sont verrouillées dans leur quartier.

## Les autres refus

| Code | Signification | Exemples |
|---|---|---|
| 400 | Données invalides | champ manquant, date de fin avant la date de début, même quartier au départ et à l'arrivée |
| 401 | Non connecté | token absent ou expiré, identifiants invalides |
| 404 | Introuvable | quartier, ressource, transfert ou officier inconnu |
| 409 | Conflit avec l'état actuel | stock réellement insuffisant, demande déjà traitée, email déjà utilisé, quartier déjà à ce niveau |

Le stock insuffisant (409) et la rétention (423) ne se confondent pas : le premier dit que les unités n'existent pas, la seconde qu'elles existent mais que le quartier n'a pas le droit de les céder.

## Dans le code

Les trois exceptions sont dans `apps/backend/src/common/rule.exceptions.ts` : `PermissionException`, `AdjacencyException` et `RetentionException`. Pour ajouter une nouvelle vérification, on lance celle qui correspond à la règle appliquée.
