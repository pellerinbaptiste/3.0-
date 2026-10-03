# 🧦 Le Tiroir à Chaussettes

Jeu web de collection : récolte des fils, tire des chaussettes, forme des paires et complète ton tiroir.
HTML, CSS et JavaScript (modules ES), sans aucune dépendance.

## Lancer le jeu

```bash
npm start        # http://localhost:8080
npm test         # tests du moteur de jeu
```

(Les modules ES ne se chargent pas en `file://`, d'où le petit serveur `server.js`.)

## Ce qui est en place

- **Lavoir (clicker)** : clique sur le panier pour gagner des fils. Améliorations : clic, machine à laver,
  sèche-linge et usine (production automatique), trèfle (chance). Gains hors ligne : 50 %, plafonnés à 8 h.
- **Tirages** : 1 chaussette ou pack de 10 (−10 %, une Rare garantie). Cinq raretés, de Commune à Légendaire (0,5 %).
  Surprises possibles : la chaussette arrive avec sa jumelle (4 %), ou une pièce oubliée (3 %).
- **Tiroir** : toute la collection par série, avec des cases vides pour les pièces manquantes, les doublons (×2…)
  et le recyclage des doublons en fils.
- **Paires** : avoir la gauche et la droite triple les points de la chaussette et ajoute +2 % de production.
  Une paire légendaire complète vaut 400 points.
- **Séries** : compléter une série (ex. « Chaussettes de Présidents ») donne une récompense en fils et +25 % de production.
- **Collections limitées** : Halloween (octobre), Vacances d'hiver (décembre-janvier), Vacances d'été (juillet-août),
  Saint-Valentin (février). Elles ne se tirent qu'en saison ; celles qu'on possède restent dans le tiroir.
- **🤿 Plongée au fond du lavoir** : un mini-jeu d'adresse où l'on prend des risques pour gagner plus. On descend tout seul,
  on se dirige au doigt, à la souris ou aux flèches. On attrape des chaussettes, des perles (fils), des bulles d'oxygène
  et parfois un coffre (Épique garantie), en évitant oursins, méduses et anguilles.
  - Plus on descend, plus les chaussettes sont rares : 5 zones, de 0 à 700 m, à découvrir.
  - **Remonter** garde tout le butin, plus un bonus de profondeur. En **panne d'oxygène**, on perd la moitié du butin.
  - Les prises enchaînées font monter un combo. Le record est marqué dans l'eau pour qu'on ait envie de le battre.
  - 3 bouteilles qui se rechargent toutes les 15 min, ou s'achètent en fils.
  - Améliorations : Grande bouteille (oxygène) et Aimant à chaussettes (portée et vitesse de nage).
  - Le plongeur, c'est ta chaussette la plus rare dans une cloche de plongée.
- **Profil partageable** : score de collection, pièce la plus rare, % de complétion, paires, séries et record de plongée.
  Le lien (`#profil=…`) affiche ta carte chez la personne qui l'ouvre.

## Structure

| Fichier | Rôle |
| --- | --- |
| `js/data.js` | Catalogue : raretés, séries, chaussettes, améliorations |
| `js/engine.js` | Logique pure (économie, tirages, score, profil), testée |
| `js/dive.js` | Simulation de la plongée (logique pure, testée) |
| `js/dive-ui.js` | Rendu canvas et commandes de la plongée |
| `js/sock-svg.js` | Dessin SVG des chaussettes |
| `js/main.js` | Interface et sauvegarde (`localStorage`) |
| `tests/*.test.js` | Tests `node --test` |

Pour ajouter une série, il suffit d'ajouter une entrée dans `SERIES` (`months` la rend saisonnière).

## Prochaines étapes

- 🏆 Classement mondial (plus grandes collections, pièces les plus rares de la semaine) : il faut un backend,
  par exemple Supabase, avec une validation côté serveur des tirages pour éviter la triche.
- 🔁 Échange de doublons entre joueurs (même backend)
