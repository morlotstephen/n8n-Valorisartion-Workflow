# n8n — rendu final

Workflows n8n réalisés sur l'instance n8n Cloud `smorlot.app.n8n.cloud`, gérés comme du code avec
[`n8ncli`](.agents/skills/n8n/SKILL.md).

## Projets

| Dossier | Description |
|---|---|
| [`rag-chatbot-bibliotheque/`](rag-chatbot-bibliotheque/) | **RAG chatbot bibliothèque** : ingestion de livres PDF dans Supabase (Gemini embeddings, recherche hybride vecteurs + mots-clés) et chatbot qui répond uniquement à partir des livres. README, workflow `.ts`, scripts SQL et specs. |
| [`n8n/workflows/POC Valorisation.workflow.ts`](n8n/workflows/) | **POC Valorisation** : valorisation d'un portefeuille (Google Sheets → Finnhub / Yahoo Finance → Excel). |

## Organisation du dépôt

```
.
├── README.md                       ← ce fichier
├── rag-chatbot-bibliotheque/       ← projet RAG (README, workflow, supabase, specs)
├── n8n/                            ← espace de travail n8ncli (config + workflows synchronisés)
├── .claude/skills/                 ← skills Claude Code
│   ├── interview/                  ← cadrer un besoin et écrire une spec
│   ├── doubt-driven-dev/           ← vérifier chaque résultat par une preuve
│   ├── hostile-review/             ← revue sécurité / performance
│   ├── rag-ingestion-livres/       ← charger et dépanner l'ingestion des livres
│   ├── rag-chatbot-answering/      ← faire évoluer et tester le chatbot
│   ├── rag-base-supabase/          ← administrer la base Supabase du RAG
│   └── n8n-deploiement-mcp/        ← modifier et publier un workflow sans clé API
└── .agents/skills/n8n/             ← skill officielle n8ncli
```

## Méthode

Chaque projet suit la même démarche : une spec par fonctionnalité (`specs/`, format de la skill
`interview` : objectif, périmètre, affirmations vérifiables, décisions, risques), puis le
workflow, puis la vérification des affirmations sur l'instance.
