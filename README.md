# FTI GROUP — Tableau de bord

Tableau de bord de suivi financier pour **FTI GROUP** (Géomètre-Topographe).  
Suivi de la trésorerie, des projets (notamment ASC Lot 2 — 347,5 km), des produits, des dépenses et des prêts bancaires.

## Démarrage rapide

1. Ouvrez le fichier `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).
2. Ou déployez le dossier sur GitHub Pages / Netlify / Vercel (dossier `docs/` ou racine selon configuration).

Aucune installation, aucun serveur backend requis.

## Fonctionnalités

- **Vue d'ensemble** : KPIs (trésorerie, entrées, dépenses, reste budget ASC), graphiques, alertes métier
- **Projets** : contrat, encaissé, dépensé, reste et marge par chantier + détail budget ASC
- **Produits** : ranking des prestations (location GPS, levés, forêt…)
- **Entrées / Dépenses** : liste filtrable + recherche globale
- **Prêts bancaires** : création d’échéancier automatique, suivi des paiements
- **Ajouts locaux** : nouvelles écritures, projets et prêts stockés dans le navigateur (`localStorage`)
- **Export CSV** : export des entrées et dépenses (données de base + ajouts)
- **Filtre par année** et recherche en temps réel

## Données

- Les données initiales viennent de `data.json` (extrait de vos fichiers Excel).
- Tout ce que vous ajoutez via l’interface est sauvegardé **uniquement dans le navigateur** de l’ordinateur utilisé.
- **Important** : si vous changez d’ordinateur ou videz le cache, les ajouts manuels disparaissent. Utilisez l’export CSV régulièrement.

## Utilisation

| Action | Comment |
|--------|--------|
| Ajouter une entrée | Bouton **+ Entrée** (en haut à droite) |
| Ajouter une dépense | Bouton **Dépense** |
| Ajouter un projet | Onglet Projets → **+ Nouveau projet** |
| Ajouter un prêt | Onglet Prêts → **+ Nouveau prêt** (génère l’échéancier) |
| Supprimer un ajout | Icône poubelle sur les lignes ajoutées manuellement |
| Exporter | Boutons **Export CSV** dans les onglets Entrées et Dépenses |
| Filtrer par année | Boutons d’année en haut à droite |
| Rechercher | Champ de recherche en haut |

## Structure du projet

```
fti-group-dashboard/
├── README.md
├── .gitignore
├── app/                 # Source de travail
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── data.json
└── docs/                # Copie pour déploiement (GitHub Pages)
    ├── index.html
    ├── app.js
    ├── styles.css
    └── data.json
```

## Limitations connues

- Pas de backend : pas de synchronisation multi-appareils
- Les données de base (`data.json`) ne sont pas éditables depuis l’interface (seuls les ajouts le sont)
- Devise forcée en FCFA
- Dépendance CDN : Chart.js (jsDelivr)

## Support

Développé pour FTI GROUP.  
Pour toute modification ou évolution, contactez votre prestataire.
