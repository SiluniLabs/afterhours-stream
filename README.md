# Afterhours Stream Screen

Écran de démarrage animé pour OBS. La scène Phaser tourne automatiquement dans un canvas HTML5 en référence 1920 × 1080 et conserve son ratio lorsque la fenêtre change de taille.

## Fonctionnalités

- Apparition progressive et aléatoire de personnages, avec une limite réglable dans `config.js` (50 actuellement).
- Deux camps opposés avec scores de survivants et d'éliminations ; les apparitions sont équilibrées, puis les unités peuvent parcourir toute l'arène.
- Cinq archétypes avec des icônes distinctes : Soldat résistant de courte portée, Assassin de mêlée, Archer, Mage à attaque de zone et Soigneur.
- Décor renouvelé aléatoirement à chaque lancement : arbres, herbes, rochers et rivière sinueuse.
- Anneau de PV autour de chaque unité, placé entre son corps et son marqueur de camp.
- Déplacements indépendants, détection des autres personnages et attaques à projectiles.
- Interface HTML/CSS superposée au canvas, avec compteur et délai avant la prochaine apparition.
- Décor et personnages dessinés en Phaser ; aucun fichier graphique supplémentaire n'est nécessaire.

## Lancer avec Docker

Prérequis : Docker Engine et Docker Compose v2.

Depuis le dossier du projet :

```sh
docker compose up --build -d
```

Ouvrir ensuite <http://127.0.0.1:8080>. Pour choisir un autre port local :

```sh
PORT=9000 docker compose up --build -d
```

La commande suivante arrête et supprime le conteneur :

```sh
docker compose down
```

Pour consulter les journaux :

```sh
docker compose logs -f
```

## Configuration OBS

1. Ajouter une source **Navigateur** à la scène OBS.
2. Saisir `http://127.0.0.1:8080` comme URL.
3. Régler la largeur à `1920` et la hauteur à `1080`.
4. Désactiver **Arrêter la source lorsque celle-ci n'est pas visible** si le monde doit continuer à évoluer lorsque la scène est masquée.

Le port Docker est publié uniquement sur la boucle locale. Pour utiliser OBS depuis une autre machine, modifier l'adresse de publication dans `docker-compose.yml` et autoriser ce port sur le réseau concerné.

## Lancer sans Docker

Ouvrir `index.html` dans un navigateur. Aucun gestionnaire de paquets ni compilation n'est nécessaire.

## Dépendances réseau

Phaser 3 et les polices web sont chargés depuis des CDN par le navigateur. Une connexion Internet est donc nécessaire pour le rendu complet, que l'application soit lancée directement ou via Docker. Le conteneur sert les fichiers du projet avec Nginx ; il ne contient pas de copie locale de ces ressources externes.

## Fichiers principaux

- `index.html` : interface de démarrage et chargement des scripts.
- `styles.css` : mise en page responsive de l'interface.
- `config.js` : paramètres de simulation et caractéristiques des archétypes.
- `game.js` : monde Phaser, états des personnages, apparitions et projectiles.
- `Dockerfile` et `docker-compose.yml` : construction et lancement du serveur web.

## Modifier les paramètres

Les réglages de jeu se trouvent dans `config.js`. Modifier les nombres sans changer la structure des objets :

- `maxActors` : nombre maximal de personnages simultanés ; le compteur HTML se met à jour automatiquement.
- `spawnDelays` : plages de délais en millisecondes pour la première apparition, les suivantes et le remplacement d'un personnage éliminé. Chaque plage est un tableau `[minimum, maximum]`.
- `spawnArea` : marges de placement des personnages à l'intérieur de leur zone de spawn.
- `detectionRange`, `projectileSpeed` et `projectileHitRadius` : détection et comportement des projectiles.
- `movement` : durée des déplacements et pauses, fréquence de recherche, variation de trajectoire et probabilité de rester dans sa zone.
- `combat` : probabilité d'attaque, temps de recharge, délais entre les actions et durée de l'animation d'impact.
- `appearance` : durée des effets visuels.
- `archetypes` : une entrée par type de personnage. `speed` est en pixels par seconde ; `health`, `damage` et `attackRange` règlent ses caractéristiques ; `attackCooldown` est en millisecondes. `areaRadius` règle la zone d'impact du mage et `projectileSpeed` la vitesse de son projectile ou de la flèche de l'archer. Les couleurs sont des nombres hexadécimaux, par exemple `0xffb878`.
- `teams` : nom, côté et couleur des deux camps. Les apparitions sont équilibrées entre les équipes.
- `environment` : densité du décor par million de pixels et dimensions de la rivière. Il n'y a ni plafond fixe d'objets ni distance minimale entre placements ; le décor est tiré sur toute l'arène et les éléments peuvent se chevaucher.

Le Soldat utilise `role: "soldier"`, une grande réserve de PV et une portée courte. L'Assassin utilise `role: "assassin"` et attaque au corps à corps. Le soigneur utilise `role: "healer"`, `healAmount`, `healRange` et `healCooldown`. Le mage utilise `role: "mage"` avec une attaque AoE ; l'archer utilise `role: "archer"` avec une flèche rapide. Chaque rôle possède une icône dédiée.

La santé est prise en compte : par défaut, tous les archétypes ont `health: 1` et disparaissent donc au premier impact. Après une modification de `config.js`, actualiser la page OBS ; si le service Docker est déjà lancé, reconstruire avec `docker compose up --build -d`.