---
name: rag-base-supabase
description: Administrer la base Supabase du RAG chatbot bibliothèque (tables documents et books, fonction hybrid_search, connexion Postgres depuis n8n Cloud). À utiliser pour installer la base, lister/renommer/supprimer un livre, vérifier le nombre de passages, réparer une connexion Postgres « Host not found », ou faire évoluer la recherche (multilingue, index vectoriel).
---

# Base Supabase du RAG

Scripts : `rag-chatbot-bibliotheque/supabase/01-…sql` puis `02-…sql` (ré-exécutables).
Spec : `rag-chatbot-bibliotheque/specs/03-bibliotheque-multi-livres.md`.

## Schéma

- `documents(id, content, metadata jsonb, embedding vector(3072), fts tsvector généré)` — un
  passage par ligne ; `metadata` contient `book_id`, `title`, `author`, `file_name`,
  `chunk_index`, `chunk_version`, `total_chunks`.
- `books(id, title, author, file_name, total_chunks, status, created_at, updated_at)` — un livre
  par ligne ; `status` = `loading` ou `complete`. RLS activé.
- `hybrid_search(query_text, query_embedding, match_count, filter, …)` — fusion RRF plein texte +
  vecteurs. `match_documents` reste pour compatibilité mais n'est plus utilisée par le workflow.

## Opérations courantes (SQL Editor de Supabase)

```sql
-- État de la bibliothèque
select b.title, b.status, b.total_chunks, count(d.id) as stockes
from books b left join documents d on d.metadata->>'book_id' = b.id
group by b.id order by b.created_at;

-- Renommer un livre (registre ET passages, sinon le chatbot cite l'ancien titre)
update documents set metadata = metadata || jsonb_build_object('title', '<titre>', 'source', '<titre>', 'author', '<auteur>')
where metadata->>'book_id' = '<book_id>';
update books set title = '<titre>', author = '<auteur>', updated_at = now() where id = '<book_id>';

-- Supprimer un livre
delete from documents where metadata->>'book_id' = '<book_id>';
delete from books where id = '<book_id>';
```

Toujours montrer la requête à l'utilisateur et la lui faire exécuter : pas de workflow qui
exécute du SQL arbitraire reçu de l'extérieur.

## Connexion Postgres depuis n8n Cloud

L'adresse directe `db.<ref>.supabase.co` n'a qu'une adresse IPv6 : n8n Cloud répond
« Host not found ». Utiliser le pooler de session :

| Champ | Valeur |
|---|---|
| Host | `aws-0-<région>.pooler.supabase.com` (ou `aws-1-…` si « Tenant or user not found ») |
| User | `postgres.<ref>` |
| Database / Port | `postgres` / `5432` |

La région est dans Project Settings → General (ici `eu-west-1`).

## Évolutions

- Plein texte multilingue : remplacer `'english'` par `'simple'` dans la colonne `fts` et dans
  `hybrid_search` (colonne à recréer : `alter table documents drop column fts;` puis le script 02).
- Au-delà de ~20 000 passages : index HNSW sur `(embedding::halfvec(3072))` et requête adaptée.
- Capacité de l'offre gratuite (500 Mo) : ~15 Ko par passage, soit ~30 000 passages.
