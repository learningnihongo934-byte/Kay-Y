# Kay - Y

A kawaii macOS launcher for Windows games using Wine, Game Porting Toolkit, and D3DMetal.

Made by Virat K.

## Download

End users download the macOS release from GitHub Releases. The release includes a DMG and ZIP package. No Node.js, Electron, or Terminal commands are required for normal use.

## Features

- Windows EXE picker
- Wine and Game Porting Toolkit backends
- Direct3D detection
- Per-game Wine prefixes
- Game launcher app creation
- macOS Electron app packaging

## GitHub Actions

`release.yml` is the macOS packaging workflow. GitHub requires Actions workflow files to live at `.github/workflows/release.yml`. If uploading through the GitHub web interface, create that path and place `release.yml` there.

The workflow builds the macOS DMG and ZIP automatically when a version tag is pushed or the workflow is started manually.
