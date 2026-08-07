# FilterZWOFit Update Repository

This folder is a PixInsight update repository root.

## Repository Files

- updates.xri
- update.xri
- FilterZWOFit20260807v0100.tar.gz
- src/scripts/FilterZWOFit/FilterZWOFit.js
- src/scripts/FilterZWOFit/FilterZWOFit.svg
- src/scripts/FilterZWOFit/filter.txt

## PixInsight Installation URL

Preferred for PixInsight (self-hosted):
- https://www.tricx.de/pi-scripts/FilterZWOFit/update.xri

Alternative (moving main branch):
- https://raw.githubusercontent.com/Trickx/pi-scripts/main/FilterZWOFit/update.xri

Alternative (CDN):
- https://cdn.jsdelivr.net/gh/Trickx/pi-scripts/FilterZWOFit/update.xri

Requested path form:
- https://github.com/Trickx/pi-scripts/FilterZWOFit/

Note:
- `raw.githubusercontent.com` does not serve directory listings, so
	`.../FilterZWOFit/` returns HTTP 404.
- `update.xri` and `updates.xri` are both included for compatibility.
- `www.tricx.de/pi-scripts/FilterZWOFit/update.xri` currently returns 404 until files are uploaded to your webspace.

## Publish Steps

1. Push this repository to origin/main.
2. In PixInsight, open Resources > Updates > Manage Repositories.
3. Add the repository URL.
4. Check for updates and install the script package.
