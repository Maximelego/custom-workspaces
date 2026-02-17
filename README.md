# Custom Workspaces (GNOME Shell Extension)

Extension GNOME Shell (GJS) pour :

- forcer un nombre de workspaces
- lancer des commandes “par workspace”
- router (optionnel) des fenêtres vers un workspace à leur création via règles

## Installer / Mettre à jour

```bash
./install.sh
```

Puis activer l’extension :

- via l’app Extensions
- ou :

```bash
gnome-extensions enable custom-workspaces@maximelego.local
```

Sur Wayland, une déconnexion/reconnexion peut être nécessaire.

## Désinstaller

```bash
./uninstall.sh
```

Config

Éditer :
extension/config.json

Puis désactiver/réactiver l’extension (ou logout/login).
Notes Wayland

Sous Wayland, le contrôle des workspaces/fenêtres depuis bash est volontairement limité.
Les extensions GNOME sont la méthode “native” pour orchestrer ce comportement.

---
