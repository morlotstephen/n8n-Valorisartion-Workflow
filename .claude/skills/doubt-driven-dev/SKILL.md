---
name: doubt-driven-dev
description: Méthode de développement où chaque résultat est considéré comme faux tant qu'il n'a pas été vérifié par une preuve observée, et où le travail est critiqué et corrigé en boucle jusqu'à ce qu'il ne reste plus de doute sérieux. À utiliser dès que l'utilisateur dit « doubt-driven », « doute de ton travail », « critique ton travail », « es-tu sûr ? », « vérifie jusqu'au bout », ou pour toute tâche où une erreur coûte cher (déploiement, données financières, migration, modification d'un système en production) — même sans demande explicite.
---

# Doubt-driven development

« Ça devrait marcher » n'est pas un résultat. Le réflexe naturel après avoir écrit quelque
chose est de le croire correct, parce qu'on vient de l'écrire ; c'est précisément le moment
où les erreurs passent. Cette méthode remplace la confiance par des preuves : une affirmation
n'est considérée comme vraie que si elle a été observée, et le travail n'est terminé que
lorsque la critique ne trouve plus rien.

## 1. Avant de commencer : dire ce que « terminé » veut dire

Écrire la liste des affirmations qui devront être vraies à la fin, chacune avec sa méthode de
vérification (commande, test, lecture du résultat réel). S'il existe une spec, partir de ses
affirmations. Sans cette liste, on finit par vérifier ce qui est facile au lieu de ce qui
compte.

## 2. Pendant : travailler par petits pas vérifiés

Après chaque étape qui change quelque chose, vérifier l'effet réel, pas le message de l'outil.
Un « Push complete » ou un code de sortie 0 dit que la commande s'est terminée, pas que le
résultat attendu existe. Aller relire l'état réel : le fichier écrit, la donnée en base, la
version en ligne, la sortie de l'exécution.

Quand deux sources se contredisent (l'outil dit « à jour », la comparaison dit « différent »),
ne pas choisir celle qui arrange. Chercher pourquoi elles divergent, et tant que ce n'est pas
expliqué, le dire.

## 3. Après : la boucle de critique

Une fois le travail apparemment fini, changer de rôle et l'attaquer. Relire le résultat comme
si quelqu'un d'autre l'avait écrit et qu'il fallait trouver pourquoi il est faux :

- **Hypothèses** : qu'ai-je supposé sans le vérifier ? (nom de colonne, format de réponse
  d'une API, unité, fuseau horaire, droits d'accès)
- **Cas limites** : entrée vide, valeur manquante, doublon, très gros volume, service en
  panne, exécution relancée deux fois.
- **Valeurs silencieusement fausses** : un défaut, un arrondi ou une conversion qui produit
  un résultat plausible mais faux est pire qu'une erreur visible.
- **Demande d'origine** : relire le message initial de l'utilisateur. Le résultat répond-il à
  ce qui a été demandé, ou à ce que j'ai compris à un moment donné ?
- **Effets de bord** : qu'ai-je modifié, créé ou laissé derrière moi en dehors de la cible ?
- **Preuve** : pour chaque affirmation de l'étape 1, ai-je une observation, ou seulement un
  raisonnement ?

Pour chaque doute : le lever par une vérification, ou corriger, puis recommencer la boucle
sur ce qui a changé. S'arrêter quand un tour complet ne trouve plus rien de sérieux, ou quand
les doutes restants ne peuvent pas être levés avec les moyens disponibles. Un doute qu'on ne
peut pas lever n'est pas une raison de tourner en rond : il se note et se remonte.

## 4. Rendre compte sans embellir

Le compte rendu final sépare strictement trois catégories, parce que l'utilisateur va décider
en fonction de ce qu'il lit :

```markdown
## Vérifié
- <affirmation> — preuve : <ce qui a été observé>

## Non vérifié
- <affirmation> — pourquoi, et comment l'utilisateur peut le vérifier

## Problèmes trouvés en route
- <problème> — corrigé / restant, avec l'impact
```

Ne jamais écrire « c'est fait » pour quelque chose qui n'a été que tenté. Si un test échoue,
le dire avec la sortie. Si une étape a été sautée, le dire. À l'inverse, quand quelque chose
est vérifié, l'affirmer nettement, sans précautions oratoires inutiles : le doute sert à
produire de la certitude, pas à tout noyer dans le conditionnel.
