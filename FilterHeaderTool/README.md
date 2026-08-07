# FilterHeaderTool Update Repository

This folder is a PixInsight update repository root.

## Repository Files

- updates.xri
- update.xri
- FilterHeaderTool20260807v0100.tar.gz
- src/scripts/FilterHeaderTool/FilterHeaderTool.js
- src/scripts/FilterHeaderTool/PIFilter_Feature.svg
- src/scripts/FilterHeaderTool/filter.txt

## PixInsight Installation URL

Preferred for PixInsight (repository base URL):
- https://cdn.jsdelivr.net/gh/Trickx/pi-scripts/FilterHeaderTool/

Metadata file served from this base:
- https://cdn.jsdelivr.net/gh/Trickx/pi-scripts/FilterHeaderTool/updates.xri

Alternative direct file URL:
- https://raw.githubusercontent.com/Trickx/pi-scripts/main/FilterHeaderTool/updates.xri

Requested path form:
- https://github.com/Trickx/pi-scripts/FilterHeaderTool/

Note:
- `raw.githubusercontent.com` does not serve directory listings, so
	`.../FilterHeaderTool/` returns HTTP 404.
- PixInsight third-party repositories typically use `updates.xri`.

## Publish Steps

1. Push this repository to origin/main.
2. In PixInsight, open Resources > Updates > Manage Repositories.
3. Add the repository URL.
4. Check for updates and install the script package.
