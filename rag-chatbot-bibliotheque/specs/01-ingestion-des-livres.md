# Ingestion des livres

## Objectif
Transformer un livre PDF en passages vectorisés stockés dans Supabase, pour que le chatbot
puisse y répondre, avec une clé Gemini gratuite et sans intervention technique de l'utilisateur.

## Contexte
L'utilisateur dépose un PDF dans un formulaire n8n. Les quotas gratuits de Gemini
(~100 embeddings/min, ~1 000/jour) ont fait échouer les premières versions : le nœud
d'embedding renvoie des vecteurs vides quand Google refuse, et Supabase répond
`vector must have at least 1 dimension`.

## Périmètre
- Inclus : PDF contenant du texte, extraction, nettoyage, découpage récursif avec chevauchement,
  métadonnées, embeddings, stockage, reprise après arrêt, page de fin.
- Exclu : PDF scannés (pas d'OCR), fichiers Word, augmentation par IA (contexte, questions
  hypothétiques, mots-clés, entités), chunking sémantique.

## Affirmations
- A1. Le formulaire (`Upload Book`) accepte un PDF facultatif, un titre et un auteur facultatifs.
  — Vérification : ouvrir l'URL de production du formulaire.
- A2. Le texte est nettoyé avant découpage : octets nuls, césures en fin de ligne, numéros de
  page isolés, espaces multiples. — Vérification : lire `Chunk Book`, sortie d'une exécution.
- A3. Les passages font au plus 2 000 caractères, avec 200 caractères de chevauchement, découpés
  par paragraphe → ligne → phrase → mot. — Vérification : test local du code `Chunk Book`
  (taille max 1 978 sur texte synthétique).
- A4. Un passage contenant moins de 40 lettres ou chiffres est écarté. — Vérification : test
  local, aucun passage composé uniquement de puces ou de numéros.
- A5. Chaque passage stocké porte `book_id`, `title`, `author`, `file_name`, `chunk_index`,
  `chunk_version = v3`, `total_chunks`. — Vérification : `select metadata from documents limit 1`.
- A6. Les embeddings sont envoyés par paquets de 50 avec une pause de 55 s
  (`Loop Over Chunks`, `Pace for Free Tier`). — Vérification : exécution n°47, 9 paquets.
- A7. Redéposer le même fichier ne charge que les passages manquants de ce livre.
  — Vérification : exécution n°48 (49 passages restants chargés), puis n°49 (`alreadyDone: true`,
  449/449), vérifiés le 30/09/2026.
- A8. *AI In Finance* est entièrement chargé : 449 passages, 449 uniques. — Vérification :
  `Execute a SQL query` renvoie `stored_chunks = unique_chunks = expected_chunks = 449`.
- A9. Sans PDF, le workflow affiche la page de fin en quelques secondes, sans appel Gemini.
  — Vérification : envoi du formulaire vide, réponse « Le chatbot est prêt » (01/10/2026).

## Décisions prises
- Découpage dans un nœud Code plutôt que seulement le Text Splitter — permet le nettoyage avant
  découpage, le filtrage des morceaux vides et la reprise ; le Text Splitter reste branché car le
  Document Loader v1 l'exige (morceaux déjà ≤ 2 000, il ne redécoupe pas).
- Morceaux de 2 000 caractères au lieu de 1 000 — divise par ~2 le nombre d'embeddings
  (quota journalier) ; alternative écartée : 1 000 caractères (795 passages pour ce livre).
- Modèle `gemini-embedding-001` — `text-embedding-004` n'est plus disponible ; quotas séparés
  de `gemini-embedding-2` déjà épuisé pendant les essais.
- Formulaire comme déclencheur au lieu du disque local — n8n Cloud ne lit pas les fichiers du Mac.

## Hypothèses et risques
- Le quota gratuit reste ~100/min et ~1 000/jour — s'il baisse, les paquets échouent ; ajuster
  la taille de paquet ou la pause.
- L'erreur `vector must have at least 1 dimension` est interprétée comme un refus de quota ;
  une clé invalide produit le même symptôme.
- Les PDF scannés donnent un texte vide : le workflow s'arrête avec « No text extracted ».

## Questions ouvertes
- Ajouter l'augmentation par IA (contexte, questions hypothétiques, mots-clés) malgré le coût
  en quota ? — à décider par l'utilisateur.
