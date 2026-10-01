---
name: rag-ingestion-livres
description: Charger, recharger ou dépanner l'ingestion d'un livre PDF dans le RAG chatbot bibliothèque (workflow n8n « AI In Finance - Book Chatbot », Supabase + Gemini). À utiliser quand l'utilisateur veut ajouter un livre, reprendre un chargement interrompu, comprendre pourquoi l'ingestion est lente ou échoue (« vector must have at least 1 dimension », quota Gemini), changer la taille des passages ou le rythme d'envoi.
---

# Ingestion des livres du RAG

Spec de référence : `rag-chatbot-bibliotheque/specs/01-ingestion-des-livres.md`.
Code du workflow : `rag-chatbot-bibliotheque/workflow/rag-chatbot-bibliotheque.workflow.ts`.

## Chaîne de nœuds

`Upload Book` (formulaire : PDF, titre, auteur — tous facultatifs) → `PDF Provided?` →
`Extract Text from PDF` → `Identify Book` → `Register Book` → `Remove Old Chunks` →
`Get Stored Chunks` → `Chunk Book` → `Already Loaded?` → `Loop Over Chunks` (50) →
`Store in Supabase` (+ `Embeddings (Ingestion)`, `Document Loader`, `Text Splitter`) →
`Pace for Free Tier` (55 s) → … → `Mark Book Complete` → `Get a row` →
`Execute a SQL query` → `Open Chatbot` (page de fin).

## Ajouter ou reprendre un livre

1. Ouvrir l'URL de **production** du formulaire `Upload Book` (le workflow doit être publié).
2. Joindre le PDF, renseigner titre et auteur (sinon le titre vient du nom de fichier).
3. Laisser la page ouverte : ~1 minute par paquet de 50 passages.
4. Si le chargement s'arrête : redéposer **le même fichier** (même nom, même taille) le
   lendemain ou une minute plus tard. Les passages déjà présents sont sautés.

Renommer le fichier change l'identifiant du livre (`<nom normalisé>-<taille>`) et crée un doublon.

## Diagnostiquer un échec

| Symptôme | Cause probable | Action |
|---|---|---|
| `vector must have at least 1 dimension 400` sur `Store in Supabase` | Google a refusé les embeddings (quota minute ou jour) ; le nœud renvoie des vecteurs vides au lieu d'une erreur | Compter les passages stockés, attendre (1 min ou le lendemain ~9 h Paris), redéposer le même fichier |
| Échec dès le 1ᵉʳ paquet | Quota journalier épuisé (~1 000/jour, par modèle) | Attendre le lendemain |
| `No text extracted from the PDF` | PDF scanné (images) | Hors périmètre : pas d'OCR |
| `Could not find the table 'public.…'` | Scripts SQL non exécutés | Lancer `rag-chatbot-bibliotheque/supabase/*.sql` |
| Exécution « en attente » sans fin dans l'éditeur | Page de fin non affichée (fenêtre de test fermée) | Arrêter l'exécution, rien n'est perdu |

Compter ce qui est stocké pour un livre :

```sql
select count(*), max((metadata->>'total_chunks')::int) as attendus
from documents where metadata->>'book_id' = '<book_id>';
```

## Modifier le comportement

- Taille / chevauchement des passages : constantes `SIZE` et `OVERLAP` du code `Chunk Book`
  **et** paramètres du nœud `Text Splitter` (mêmes valeurs, sinon il redécoupe). Changer ces
  valeurs impose d'incrémenter `VERSION` (`v3` → `v4`) : les anciens passages du livre seront
  supprimés et rechargés.
- Rythme : `batchSize` de `Loop Over Chunks`, `embeddingBatchSize` de `Store in Supabase` et
  `amount` de `Pace for Free Tier`. Rester sous ~100 embeddings par minute avec une clé gratuite.
- Modèle d'embedding : il doit être identique dans `Embeddings (Ingestion)` et dans `Embed Query`
  (URL de l'API), et produire 3 072 dimensions (`vector(3072)`). Changer de modèle impose de
  tout réingérer.

Pour appliquer une modification sur l'instance, suivre la skill `n8n-deploiement-mcp`.
