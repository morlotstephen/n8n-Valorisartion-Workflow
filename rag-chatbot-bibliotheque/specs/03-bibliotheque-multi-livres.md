# Bibliothèque multi-livres

## Objectif
Avoir une seule base de données contenant les passages de tous les livres déposés, où l'ajout
ou le rechargement d'un livre ne touche jamais les autres.

## Contexte
La première version était écrite pour un seul livre : son nettoyage supprimait toutes les lignes
d'une ancienne version, et la reprise reconnaissait les passages par leur seul numéro. Un
deuxième livre aurait effacé ou mélangé le premier.

## Périmètre
- Inclus : identifiant stable par livre, registre `books`, nettoyage et reprise limités au livre
  concerné, recherche sur tous les livres, statistiques sur la page de fin.
- Exclu : suppression d'un livre depuis n8n (à faire en SQL), choix du livre dans le chat.

## Affirmations
- A1. L'identifiant d'un livre est `<nom de fichier normalisé>-<taille en octets>` ; le même
  fichier donne toujours le même identifiant. — Vérification : `AI_In_Finance.pdf` (9 291 421
  octets) → `ai-in-finance-9291421`, identique au marquage SQL des 449 passages existants.
- A2. La table `books` contient un livre par identifiant, avec titre, auteur, fichier,
  `total_chunks`, `status` (`loading` puis `complete`). — Vérification :
  `select * from books`.
- A3. `Remove Old Chunks` et `Get Stored Chunks` ne lisent ou suppriment que les lignes du livre
  en cours (`metadata->>'book_id'`). — Vérification : chargement des *48 lois du pouvoir* le
  01/10/2026 ; *AI In Finance* toujours à 449 passages ensuite.
- A4. `Get Stored Chunks` passe par Postgres (pas de limite de 1 000 lignes de l'API REST).
  — Vérification : requête `array_agg` dans le nœud.
- A5. Les valeurs venues du formulaire (titre, auteur, fichier) ne peuvent pas casser les
  requêtes SQL : les `$` sont retirés et les valeurs sont entourées de `$q$…$q$`.
  — Vérification : test local d'`Identify Book` avec « Mon $Livre ».
- A6. Les 449 passages d'*AI In Finance* ont été rattachés au livre sans réingestion.
  — Vérification : `tagged_chunks = 449` après le script `02-…sql`.

## Décisions prises
- Identifiant par nom + taille plutôt que hash SHA-256 du fichier — calculable sans module
  `crypto` dans le nœud Code de n8n Cloud ; risque de collision négligeable.
- Une seule table `documents` pour tous les livres + registre `books` — plus simple qu'une table
  par livre et compatible avec la recherche sur l'ensemble.

## Hypothèses et risques
- Deux fichiers différents avec le même nom et la même taille seraient confondus.
- Renommer le fichier avant de le redéposer crée un nouveau livre (doublon de contenu).
- Le titre stocké dans les passages est celui saisi au premier chargement : un titre corrigé
  plus tard doit aussi être mis à jour en SQL dans `documents.metadata`.

## Questions ouvertes
- Permettre de filtrer le chat sur un livre précis ? — lié au *Routing*.
