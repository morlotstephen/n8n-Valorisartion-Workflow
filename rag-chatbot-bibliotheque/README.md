# RAG Chatbot Bibliothèque

Workflow n8n qui transforme des livres PDF en base de connaissances et ouvre un chatbot qui
répond **uniquement à partir de ces livres**, en citant ses sources.

Premier livre chargé : *AI In Finance* de Krishan Arora (449 passages). Le workflow accepte
n'importe quel autre PDF : tous les passages de tous les livres sont stockés dans une seule
base Supabase.

| | |
|---|---|
| Plateforme | n8n Cloud (`smorlot.app.n8n.cloud`), workflow **AI In Finance - Book Chatbot** (`TKY170HogPciq8hz`) |
| Embeddings | Google Gemini `gemini-embedding-001` (3072 dimensions), clé gratuite AI Studio |
| Génération | Google Gemini `gemini-3-flash-preview` |
| Base vectorielle | Supabase Postgres + pgvector (table `documents`, registre `books`) |
| Recherche | Hybride : vecteurs + mots-clés, fusion RRF (`hybrid_search`) |

## Contenu du dossier

```
rag-chatbot-bibliotheque/
├── README.md                     ← ce fichier
├── workflow/
│   └── rag-chatbot-bibliotheque.workflow.ts   ← le workflow n8n complet (SDK TypeScript n8ncli)
├── supabase/
│   ├── 01-table-documents-et-match-documents.sql            ← table des passages (à lancer en premier)
│   └── 02-bibliotheque-multi-livres-et-recherche-hybride.sql ← registre des livres + recherche hybride
└── specs/
    ├── 01-ingestion-des-livres.md
    ├── 02-answering-chatbot.md
    ├── 03-bibliotheque-multi-livres.md
    └── 04-recherche-hybride.md
```

Les skills qui expliquent comment exploiter et faire évoluer ce workflow sont dans
[`.claude/skills/`](../.claude/skills/) (préfixe `rag-` et `n8n-deploiement-mcp`).

## Architecture

```
INGESTION (une fois par livre)
Formulaire ─► PDF fourni ? ─oui─► Extraction du texte ─► Identification du livre ─► Inscription dans `books`
                  │                                                                        │
                  non                         Suppression des anciennes versions de CE livre ◄┘
                  │                                          │
                  │                     Passages déjà stockés (reprise) ─► Découpage + nettoyage
                  │                                          │
                  │                     Déjà tout chargé ? ─non─► Boucle par paquets de 50 :
                  │                                          │      embeddings Gemini ─► Supabase ─► pause 55 s
                  │                                         oui                 │
                  │                                          └──► Livre « complete » ◄┘
                  ▼                                                     │
            Exemple de passage ─► Statistiques SQL ─► Page « Le chatbot est prêt » + bouton « Ouvrir le chatbot »

ANSWERING (à chaque message)
Chat ─► Agent IA (Gemini 3 Flash + mémoire 10 messages) ─► outil « Search Library »
                                                              │
        sous-workflow : question ─► embedding Gemini ─► hybrid_search (vecteurs + mots-clés, RRF) ─► 4 passages
                                                              │
        ◄── réponse en citant le titre (et l'auteur) du livre ◄┘
```

| Étape (cours) | Nœuds n8n |
|---|---|
| Extraction | `Upload Book`, `PDF Provided?`, `Extract Text from PDF` |
| Chunking (récursif + overlap) | `Chunk Book` (2000 caractères, chevauchement 200), `Text Splitter` |
| Augmentation (nettoyage + métadonnées) | `Chunk Book`, `Identify Book`, `Document Loader` |
| Vectorisation | `Embeddings (Ingestion)`, `Store in Supabase`, `Loop Over Chunks`, `Pace for Free Tier` |
| Registre / contrôle | `Register Book`, `Remove Old Chunks`, `Get Stored Chunks`, `Mark Book Complete`, `Get a row`, `Execute a SQL query` |
| Answering : input + contexte | `Chat With the Book`, `Chat Memory` |
| Answering : search | `Search Library` → `Search Request`, `Embed Query`, `Hybrid Search`, `Format Passages` |
| Answering : génération | `AI Agent`, `Gemini Chat Model` |

## Installation

1. **Supabase** : exécuter dans le SQL Editor, dans l'ordre,
   `supabase/01-table-documents-et-match-documents.sql` puis
   `supabase/02-bibliotheque-multi-livres-et-recherche-hybride.sql`.
   Choisir « Run and enable RLS » si Supabase le propose.
2. **Identifiants n8n** (à créer dans l'interface n8n, jamais dans le code) :
   - *Supabase account* : Host `https://<ref>.supabase.co`, clé `service_role` ou `sb_secret_…`.
   - *Postgres Credential* : Host `aws-0-eu-west-1.pooler.supabase.com` (pooler en IPv4 ;
     l'adresse directe `db.<ref>.supabase.co` est IPv6 uniquement et n8n Cloud ne la joint pas),
     User `postgres.<ref>`, Database `postgres`, Port `5432`, mot de passe de la base.
   - *Google Gemini (PaLM) Api* : clé AI Studio.
3. **Workflow** : depuis la racine du dépôt (espace `n8ncli`), copier
   `workflow/rag-chatbot-bibliotheque.workflow.ts` dans `n8n/workflows/` puis `n8ncli push`
   pour le créer, et `n8ncli publish <id>`. Pour modifier un workflow **existant**, voir la
   skill `n8n-deploiement-mcp` (le `push` ne met pas à jour un workflow existant sans clé API).
4. Rebrancher les identifiants sur les nœuds si n8n ne les a pas reliés automatiquement, puis
   publier.

## Utilisation

- **Lancer le workflow** : ouvrir l'URL de production du formulaire (nœud `Upload Book`).
  - Sans fichier → la page « Le chatbot est prêt » s'affiche en quelques secondes.
  - Avec un PDF (+ titre et auteur facultatifs) → le livre est chargé puis la même page s'affiche.
  - Le bouton **Ouvrir le chatbot** ouvre le chat dans un nouvel onglet.
- **Chatbot** : URL publique du nœud `Chat With the Book` (`…/webhook/<id>/chat`), ou bouton
  *Open chat* dans l'éditeur n8n.
- Lancé depuis le bouton *Execute workflow* de l'éditeur, le formulaire s'affiche en mode test :
  la page de fin apparaît dans la fenêtre de test.

## Limites connues (clé Gemini gratuite)

- ~100 embeddings/minute → pause de 55 s tous les 50 passages : ~1 minute pour ~50 pages.
- ~1 000 embeddings/jour → un livre de plus de ~1 000 passages se charge sur deux jours.
  Redéposer le **même fichier** reprend là où le chargement s'est arrêté, sans doublon.
- Une erreur `vector must have at least 1 dimension` signifie presque toujours que Google a
  refusé la requête (quota) : le nœud d'embedding renvoie alors des vecteurs vides.
- La recherche par mots-clés utilise la configuration `english` de Postgres : elle aide peu sur
  les livres en français (la recherche vectorielle compense).
- Supabase gratuit (500 Mo) : ~15 Ko par passage → environ 30 000 passages.

## Sécurité

- Aucun secret dans ce dépôt : les identifiants sont référencés par leur nom et stockés dans n8n.
- Le formulaire et le chat sont publics une fois le workflow publié : quiconque connaît leur URL
  peut ajouter un livre ou consommer le quota Gemini. Le fichier `.ts` contient les
  identifiants de webhook ; si le dépôt est public, régénérer ces URL ou ajouter une
  authentification au formulaire (option du nœud `Upload Book`).
- Les valeurs saisies (titre, auteur, question) sont insérées dans le SQL entre `$q$…$q$`, après
  suppression des caractères `$`.

## État au 1er octobre 2026

| Livre | Passages | Statut |
|---|---|---|
| AI In Finance — Krishan Arora | 449 / 449 | complet |
| Les 48 lois du pouvoir — Robert Greene | ~750 / 1 075 | en cours (quota du jour atteint, reprise le lendemain) |

## Pistes d'évolution

Voir le schéma « Answering » du cours : *Routing* (réécriture de la requête, mots-clés, filtre
par livre), *Reranking* par un modèle léger (Gemini Flash Lite), historique de conversation
stocké dans Postgres, et augmentation par IA à l'ingestion (contexte, questions hypothétiques,
mots-clés, entités).
