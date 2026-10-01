# Recherche hybride (vecteurs + mots-clés)

## Objectif
Retrouver les bons passages aussi bien pour une question formulée librement (sens) que pour un
terme exact (nom propre, sigle), sans appel Gemini supplémentaire.

## Contexte
La recherche purement vectorielle rate souvent les termes précis (« JPMorgan », « LSTM »).
Le nœud *Supabase Vector Store* de n8n ne sait appeler que `match_documents` (vecteurs seuls),
d'où un sous-workflow dédié.

## Périmètre
- Inclus : colonne plein texte, index GIN, fonction SQL `hybrid_search` avec fusion RRF, outil de
  l'agent qui l'appelle.
- Exclu : reranking par un modèle, recherche plein texte multilingue.

## Affirmations
- A1. `documents.fts` est une colonne générée `to_tsvector('english', content)` indexée en GIN.
  — Vérification : `keyword_matches = 61` pour `credit | scoring` après le script `02-…sql`.
- A2. `hybrid_search(query_text, query_embedding, match_count)` combine les classements plein
  texte et vectoriel par Reciprocal Rank Fusion (k = 50) et renvoie au plus `match_count`
  passages avec un score. — Vérification : lecture de la fonction ; exécution n°71.
- A3. Un mot de la question suffit pour une correspondance plein texte (requête en OU, pas en ET).
  — Vérification : construction de la `tsquery` avec `' | '`.
- A4. L'agent appelle `Search Library`, qui exécute le même workflow via `Search Request` →
  `Embed Query` (Gemini `embedContent`) → `Hybrid Search` → `Format Passages`.
  — Vérification : exécution n°71, l'outil renvoie 4 passages numérotés avec titre et auteur.
- A5. La requête de l'utilisateur ne peut pas casser le SQL : les `$` sont retirés et le texte
  est entouré de `$q$…$q$`. — Vérification : lecture du nœud `Hybrid Search`.

## Décisions prises
- Sous-workflow dans le même workflow (déclencheur *Execute Workflow Trigger* appelé par l'outil
  *Call n8n Workflow*) — garde un seul workflow à livrer.
- Requête SQL via le nœud Postgres plutôt que l'API REST Supabase — pas de conversion du vecteur
  par l'API, et même identifiant que les autres requêtes.
- Pas d'index vectoriel — pgvector limite les index HNSW/IVFFlat à 2 000 dimensions pour le type
  `vector` ; un parcours complet reste rapide à quelques milliers de passages.

## Hypothèses et risques
- Configuration `english` : peu efficace sur les livres en français (*Les 48 lois du pouvoir*) ;
  passer à `simple` ou détecter la langue du livre.
- Au-delà de ~20 000 passages, la recherche vectorielle sans index ralentira : prévoir un index
  sur `embedding::halfvec(3072)`.

## Questions ouvertes
- Rendre le plein texte multilingue et chercher dans la langue de chaque livre ? — à décider.
