---
name: interview
description: Interroge l'utilisateur avant de construire quoi que ce soit, challenge chaque hypothèse, explore les alternatives, puis produit une spec écrite (objectif + affirmations vérifiables). À utiliser dès que l'utilisateur dit « interview », « interroge-moi », « challenge mon idée », « fais-moi une spec », « cadrons le besoin », ou décrit une nouvelle fonctionnalité, un nouveau workflow ou un projet de façon vague ou incomplète — même s'il ne demande pas explicitement une spec.
---

# Interview

Le but est d'arriver à une spec que quelqu'un d'autre pourrait implémenter et vérifier sans
reposer de question. La plupart des projets ratés ne le sont pas à cause du code, mais parce
que la demande cachait des hypothèses que personne n'a dites à voix haute. L'interview sert
à les faire sortir avant qu'elles coûtent cher.

Ne rien implémenter pendant l'interview. Lire le code, les données ou les documents existants
est en revanche encouragé : une question dont la réponse se trouve dans le dépôt ne doit pas
être posée à l'utilisateur.

## 1. Explorer avant de demander

Avant la première question, regarder ce qui existe déjà : fichiers du projet, workflows,
données d'exemple, documentation. Arriver avec du contexte permet de poser des questions
précises (« la colonne `Quantite` n'existe pas dans la feuille, d'où viennent les quantités ? »)
plutôt que génériques (« quelles sont vos données ? »).

## 2. Interroger

Poser les questions par petits lots (2 à 4), en commençant par celles dont la réponse change
le plus la solution. Utiliser l'outil de questions à choix quand il existe, en proposant des
options concrètes avec une recommandation. Continuer tant que les réponses font apparaître de
nouvelles inconnues ; s'arrêter quand les réponses ne changent plus rien à la spec.

Axes à couvrir, sans en faire un questionnaire mécanique :

- **Le vrai objectif** : quel problème est résolu, pour qui, et comment saura-t-on que c'est
  réussi ? Demander « pourquoi » jusqu'à atteindre un résultat métier, pas une solution.
- **Le périmètre** : ce qui est explicitement exclu compte autant que ce qui est inclus.
- **Les entrées et sorties** : format exact, provenance, volume, exemple réel.
- **Les cas limites** : données manquantes, doublons, service externe en panne, quotas,
  valeurs inattendues (devise inconnue, ticker invalide, cellule vide).
- **Les contraintes** : sécurité, confidentialité, coût, délai, outils imposés, qui maintient.
- **L'exploitation** : qui lance, à quelle fréquence, que se passe-t-il en cas d'échec, qui
  est prévenu.

## 3. Challenger

Ne pas accepter une réponse parce qu'elle a été donnée avec assurance. Pour chaque choix
important :

- Reformuler l'hypothèse implicite et demander si elle est vraie (« vous supposez que Yahoo
  renvoie toujours la devise de cotation en unité principale — c'est faux pour Londres »).
- Proposer au moins une alternative plus simple et dire ce qu'on y perd.
- Signaler les contradictions entre deux réponses au lieu de trancher en silence.
- Dire clairement quand une demande semble être une mauvaise idée, et pourquoi. L'utilisateur
  décide, mais en connaissance de cause.

Rester factuel et bref : challenger n'est pas faire la leçon. Une objection, sa raison, une
proposition.

## 4. Écrire la spec

Écrire la spec dans un fichier `specs/<nom-court>.md` (ou à l'endroit indiqué par
l'utilisateur), avec cette structure :

```markdown
# <Titre>

## Objectif
Une à trois phrases : le résultat attendu et pour qui. Pas de solution technique ici.

## Contexte
Ce qui existe déjà et ce qui motive le besoin.

## Périmètre
- Inclus : …
- Exclu : …

## Affirmations
Chaque affirmation est vraie ou fausse une fois le travail terminé, et dit comment le vérifier.
- A1. <énoncé vérifiable> — Vérification : <commande, test, observation>
- A2. …

## Décisions prises
- <décision> — raison, alternative écartée.

## Hypothèses et risques
- <hypothèse non confirmée> — ce qui casse si elle est fausse.

## Questions ouvertes
- <question restée sans réponse>, qui doit y répondre.
```

Une bonne affirmation est observable et précise : « pour un ticker `.L`, la valeur écrite est
en livres (cours Yahoo en pence divisé par 100) » plutôt que « les devises sont bien gérées ».
Si une affirmation ne peut pas être vérifiée, la reformuler ou la déplacer dans les risques.

Terminer en présentant la spec à l'utilisateur et en demandant sa validation avant toute
implémentation. Les questions ouvertes restantes doivent être visibles, pas enterrées.
