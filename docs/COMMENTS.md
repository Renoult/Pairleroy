## Guide rapide pour les commentaires

- **But** : expliquer les raisons, les hypothèses, les limites d’un bloc de code. Éviter de répéter ce que le code dit déjà.
- **Où commenter ?**
  - Entête de fichier : rôle global, dépendances importantes.
  - Entête de fonction non triviale : arguments attendus, valeur de retour, effets secondaires.
  - Constantes « magiques » : rappeler l’origine de la valeur (ex. `0.26` pour la courbure des coins).
- **Qualité** :
  - Phrase complète, courte, en français.
  - Tenir le commentaire à jour lors de chaque modification (sinon le supprimer).
  - Préférer un exemple ou une raison (« assure l’alignement des bicolores ») plutôt qu’une simple description.
- **Validation** :
  - Après un changement, relire comment / code pour vérifier la cohérence.
  - Si possible, déclencher le scénario mentionné pour s’assurer que la narration est juste.

Ce document peut évoluer : noter ici les conventions retenues.
