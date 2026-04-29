# Instructions pour Codex - Application Quiz Musical

## Projet
Application de quiz musical avec :
- Frontend : React / Next.js / TypeScript / Tailwind CSS
- Backend : Node.js / Express / Socket.io
- Base de données : MySQL
- Communication temps réel via Socket.io

## Fonctionnement attendu
- Un gamemaster se connecte avec un compte.
- Le gamemaster crée une partie avec un thème.
- Un code de partie à 6 chiffres est généré.
- Les joueurs rejoignent avec un pseudo + code de partie, sans compte.
- Une partie contient 10 musiques.
- Les joueurs peuvent buzzer.
- Quand un joueur buzz :
  - la musique se met en pause ;
  - le joueur est ajouté en file d’attente ;
  - les autres joueurs peuvent aussi buzzer et être ajoutés à la file ;
  - si mauvaise réponse, la musique reprend là où elle s’est arrêtée ;
  - le timer reprend aussi là où il s’est arrêté ;
  - si bonne réponse, +5 points et passage à la musique suivante ;
  - si pas de réponse après 5 secondes, -2 points et reprise de la musique.
- Les joueurs et le gamemaster doivent être reconnectés automatiquement après refresh ou déconnexion réseau.

## Règles importantes
- Ne pas tout réécrire si ce n’est pas nécessaire.
- Modifier uniquement les fichiers concernés.
- Toujours expliquer les changements avant de proposer un patch.
- Garder le code TypeScript propre.
- Ne pas casser les événements Socket.io existants.
- Si une fonction existe déjà, la réutiliser plutôt que la recréer.
- Pour les modifications frontend, conserver Tailwind CSS.
- Pour les modifications backend, garder Express + Socket.io.
- Pour MySQL, vérifier les requêtes et ne pas supprimer de données sans demande explicite.

## Avant chaque modification
Codex doit :
1. Identifier les fichiers concernés.
2. Expliquer le problème.
3. Proposer la correction.
4. Appliquer seulement après validation si la modification est importante.