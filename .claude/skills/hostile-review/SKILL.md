---
name: hostile-review
description: Revue hostile d'un code, d'un workflow (n8n ou autre), d'une configuration ou d'une spec, centrée sur la sécurité et la performance, en se plaçant du point de vue de quelqu'un qui veut le casser. À utiliser dès que l'utilisateur dit « hostile review », « revue hostile », « attaque mon code », « cherche les failles », « audit sécurité », « est-ce que ça tient la charge », ou demande une revue avant une mise en production ou le partage d'un dépôt.
---

# Hostile review

Une revue classique part du principe que l'auteur a probablement raison. Celle-ci part du
principe inverse : tout ce qui n'est pas prouvé sûr est considéré comme cassable, et c'est à
la revue de trouver comment. L'objectif n'est pas d'être désagréable, c'est de trouver les
problèmes avant qu'un attaquant, une panne ou un pic de charge ne les trouve.

La revue est en lecture seule : ne rien corriger sans que l'utilisateur le demande. Ne jamais
recopier la valeur d'un secret trouvé dans le rapport ; indiquer seulement où il se trouve.

## 1. Délimiter la cible

Identifier ce qui est revu (diff en cours, fichier, workflow, dépôt entier) et lire
réellement le contenu, y compris la configuration, les fichiers ignorés par git et
l'historique si des secrets ont pu y passer. Repérer d'abord les frontières : d'où viennent
les données, où partent-elles, qui peut déclencher quoi, avec quels droits.

## 2. Attaquer sous l'angle sécurité

Pour chaque frontière, chercher un scénario d'attaque concret :

- **Secrets** : clés, jetons, mots de passe dans le code, les logs, l'historique git, les
  URL, les captures d'écran, les messages d'erreur. Portée trop large, absence de rotation.
- **Entrées non fiables** : injection (SQL, commande, expression, formule de tableur),
  données d'un fichier ou d'une API externe utilisées sans validation, chemins et URL
  construits à partir d'une entrée.
- **Accès** : webhooks ou endpoints sans authentification, droits trop larges, données
  d'un utilisateur visibles par un autre, dépôt ou document public par erreur.
- **Données sensibles** : données personnelles ou financières envoyées à un tiers, stockées
  en clair, conservées sans raison.
- **Dépendances et tiers** : API non officielles, paquets non épinglés, service externe qui
  peut changer sa réponse ou disparaître.
- **Défaillances** : que se passe-t-il si un appel échoue à moitié ? Écriture partielle,
  doublons à la relance, erreur avalée en silence, valeur par défaut fausse (un `|| 0` qui
  transforme une donnée manquante en zéro crédible).

## 3. Attaquer sous l'angle performance

Se demander ce qui se passe avec 10 fois, puis 1000 fois plus de données :

- Appels réseau un par un dans une boucle, absence de traitement par lots ou de cache.
- Quotas et limites de débit des API : à partir de quel volume sont-ils atteints ?
- Complexité quadratique, chargement complet en mémoire, fichiers ou réponses non bornés.
- Absence de délai maximal, de relance avec attente, de limite de concurrence.
- Travail refait à chaque exécution alors qu'il pourrait être incrémental.
- Coût : exécutions facturées, appels payants, stockage qui grossit sans fin.

Chiffrer quand c'est possible (« 15 lignes = 15 appels ; à 60 appels/min, le quota est
atteint à partir de 60 lignes USD ») plutôt que d'affirmer que « ça ne passera pas ».

## 4. Vérifier avant d'accuser

Un constat faux détruit la crédibilité de tous les autres. Pour chaque problème, relire le
code concerné et s'assurer que le scénario est réellement atteignable. Distinguer :

- **Confirmé** : reproduit, ou démontré par la lecture du code.
- **Plausible** : le scénario tient, mais dépend d'un élément non vérifié — dire lequel.

Écarter ce qui relève du goût ou du style : ce n'est pas l'objet de cette revue.

## 5. Rapport

Classer du plus grave au moins grave. Utiliser ce format :

```markdown
# Hostile review — <cible>

## Verdict
Une phrase : peut partir en production / à corriger avant / à ne pas déployer.

## Constats
### [Critique|Élevé|Moyen|Faible] <titre court> — Sécurité|Performance
- Où : `fichier:ligne` ou nom du nœud
- Scénario : entrée ou situation précise → conséquence
- Statut : Confirmé | Plausible (dépend de …)
- Correction proposée : …

## Ce qui a été vérifié et tient
Liste courte, pour que l'absence de constat ne soit pas confondue avec une absence d'examen.

## Non examiné
Ce qui n'a pas pu être revu, et pourquoi.
```

La gravité reflète l'impact réel dans le contexte de l'utilisateur : un secret dans un
dépôt public est critique, le même dans un dépôt privé à un seul utilisateur est moyen.
Si rien de sérieux n'est trouvé, le dire simplement plutôt que de gonfler des détails.
