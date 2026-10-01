---
name: rag-chatbot-answering
description: Faire évoluer, tester ou dépanner la partie « answering » du RAG chatbot bibliothèque (chat public n8n, agent Gemini, outil de recherche hybride, citations, page de fin). À utiliser quand l'utilisateur parle du chatbot qui répond mal, qui invente, qui ne trouve pas un passage, qui ne s'ouvre pas, ou veut ajouter routing, reranking, filtre par livre ou historique de conversation.
---

# Answering du RAG

Spec de référence : `rag-chatbot-bibliotheque/specs/02-answering-chatbot.md` et
`rag-chatbot-bibliotheque/specs/04-recherche-hybride.md`.

## Chaîne actuelle

```
Chat With the Book ─► AI Agent (Gemini 3 Flash, température 0, Chat Memory = 10 messages)
                          └─ outil Search Library (appelle CE workflow)
                               Search Request ─► Embed Query ─► Hybrid Search ─► Format Passages
```

Correspondance avec le schéma du cours *Input → Context → Routing → Search → Reranking →
Generation* : Input ✅, Context ⚠️ (mémoire n8n, pas de config ni d'historique Postgres),
Routing ⚠️ (implicite dans l'agent), Search ✅ (hybride + RRF), Reranking ❌, Generation ✅.

## Tester sans ouvrir le navigateur

Avec le serveur MCP de l'instance (voir `n8n-deploiement-mcp`) :

1. `execute_workflow` avec `executionMode: "manual"`, `triggerNodeName: "Chat With the Book"`,
   `inputs: { chatInput: "<question>" }`.
2. `get_workflow_execution` avec `includeData: true` jusqu'à `status` ≠ `running`.
3. Vérifier : `Search Library` exécuté, passages renvoyés avec titre, `AI Agent.output` qui cite
   le livre. Toujours tester aussi une question **hors sujet** : la réponse doit dire « je ne sais
   pas ».

## Règles à préserver

- Le prompt système (`AI Agent` → `systemMessage`) impose : réponses uniquement à partir des
  passages, aveu d'ignorance sinon, citation du titre, appel de l'outil à chaque question,
  réponse dans la langue de la question.
- La page de fin (`Open Chatbot`, `respondWith: showText`) contient un lien `target="_blank"`
  vers l'URL du chat. Ne pas revenir à une redirection : l'éditeur n8n ne la suit pas.
- Le webhook du chat est régénéré quand le workflow est **recréé** : mettre alors à jour l'URL
  dans `Open Chatbot`.
- Modèle de chat : `gemini-2.5-flash` n'est plus ouvert aux nouveaux comptes (404).

## Évolutions prévues (non faites)

1. **Context** : nœud de configuration + historique stocké dans Postgres, cas « conversation vide ».
2. **Routing** : appel Gemini qui renvoie en JSON 2-3 requêtes (dont une dans la langue du livre),
   des mots-clés et un filtre `{"book_id": …}` passé à `hybrid_search(…, filter)`.
3. **Search** : élargir à ~15 passages par requête.
4. **Reranking** : Gemini Flash Lite note chaque passage par rapport à la question, garder 4.

Chaque évolution ajoute ~1 appel Gemini par question : acceptable avec la clé gratuite.
