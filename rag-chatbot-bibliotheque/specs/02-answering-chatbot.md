# Answering : le chatbot

## Objectif
Permettre de poser des questions en langage naturel sur les livres chargés et obtenir une
réponse fondée uniquement sur leur contenu, avec la source citée, dans une page web séparée
de l'éditeur n8n.

## Contexte
Le chatbot doit s'ouvrir à la fin du workflow. Un workflow n8n Cloud ne peut pas ouvrir un
onglet sur l'ordinateur de l'utilisateur : c'est la page du formulaire qui lance le workflow
qui affiche, à la fin, un bouton vers le chat. La redirection automatique a été abandonnée car
l'éditeur n8n ne la suit pas en mode test.

## Périmètre
- Inclus : chat public hébergé par n8n, agent IA, mémoire courte, outil de recherche, citations,
  page de fin avec bouton « Ouvrir le chatbot ».
- Exclu : authentification des utilisateurs du chat, historique stocké dans Postgres, routing et
  reranking (voir « Questions ouvertes »).

## Affirmations
- A1. Le chat est public (`Chat With the Book`, mode hosted chat) et accessible à l'URL
  `…/webhook/<webhookId>/chat` quand le workflow est publié. — Vérification : `curl` → HTTP 200.
- A2. L'agent (`AI Agent` + `gemini-3-flash-preview`, température 0) appelle l'outil
  `Search Library` pour chaque question. — Vérification : exécution n°71, `Search Library` x1.
- A3. Les réponses citent le titre (et l'auteur) du livre. — Vérification : question « Que dit le
  livre sur JPMorgan ? » → réponse citant *AI In Finance* de Krishan Arora (01/10/2026).
- A4. Hors du contenu des livres, l'agent répond qu'il ne sait pas au lieu d'inventer.
  — Vérification : poser une question hors sujet (à refaire après chaque changement de prompt).
- A5. L'agent répond dans la langue de la question. — Vérification : exécution n°71, réponse en
  français à une question en français.
- A6. La mémoire conserve les 10 derniers messages d'une même session de chat.
  — Vérification : poser une question de relance (« et sur Goldman Sachs ? »).
- A7. La page de fin affiche le nombre de livres, de passages, les titres et un bouton qui ouvre
  le chat dans un nouvel onglet. — Vérification : formulaire envoyé sans PDF → « 1 livre(s) ·
  449 passages · AI In Finance » (01/10/2026).

## Décisions prises
- `gemini-3-flash-preview` — `gemini-2.5-flash` renvoie 404 « no longer available to new users ».
- Page de fin avec bouton plutôt que redirection — fonctionne aussi depuis l'éditeur ; le clic
  ouvre un nouvel onglet (la page de formulaire est sandboxée mais autorise les popups).
- Pas d'iframe du chat dans la page de fin — le chat envoie `X-Frame-Options: SAMEORIGIN` et la
  page de formulaire est sandboxée (origine opaque).

## Hypothèses et risques
- `gemini-3-flash-preview` est un modèle *preview* : il peut être retiré ; prévoir de le changer
  dans `Gemini Chat Model`.
- Le chat est public : n'importe qui ayant l'URL consomme le quota Gemini.

## Questions ouvertes
- Ajouter *Routing* (réécriture de requête, mots-clés, filtre par livre) et *Reranking* par
  Gemini Flash Lite, conformément au schéma « Answering » du cours ? — à décider.
- Stocker l'historique de conversation dans Postgres plutôt qu'en mémoire n8n ? — à décider.
