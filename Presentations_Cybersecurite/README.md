# Presentations Cybersecurite

Deux decks PowerPoint 16:9, generes a partir de plans JSON (skill `pptx-create`) :

- `cybersec-sensibilisation.pptx` — 15 diapos, grand public : phishing, mots de passe, 2FA, sauvegardes 3-2-1, conduite en cas d'incident, cout des violations (graphique 2021-2024).
- `cybersec-menaces-defense.pptx` — 14 diapos, profil technique (RSSI/IT) : vecteurs d'attaque, ransomware et double extorsion, chaine logistique, Zero Trust, detection/reponse, feuille de route priorisee P1-P3.

## Obtenir les fichiers .pptx

Les .pptx sont binaires : ils sont stockes ici encodes en base64, decoupe en parties de 30 Ko (limite de transport texte). Pour reconstruire un deck :

```bash
cat cybersec-sensibilisation.pptx.b64.part-* | base64 -d > cybersec-sensibilisation.pptx
cat cybersec-menaces-defense.pptx.b64.part-* | base64 -d > cybersec-menaces-defense.pptx
```

## Sources editables

- `plan-sensibilisation.json` / `plan-menaces.json` : pour modifier le contenu puis regenerer :
  ```bash
  pip install python-pptx
  python build_deck.py plan-sensibilisation.json -o cybersec-sensibilisation.pptx
  ```

## Sources des chiffres

Verizon DBIR 2024-2025 (68 % de facteur humain, ~31 % d'identifiants voles, 44 % de ransomware) et IBM Cost of a Data Breach 2024 (4,88 M$, 194 j + 64 j).

Champs `[A COMPLETER]` a renseigner avant diffusion : organisation/date (diapo de titre) et contact interne (service securite / RSSI).
