# FilterHeaderTool Update Repository

This folder is a PixInsight update repository root.

## Repository Files

- update.xri
- FilterHeaderTool20260807v0100.tar.gz
- src/scripts/FilterHeaderTool/FilterHeaderTool.js
- src/scripts/FilterHeaderTool/PIFilter_Feature.svg
- src/scripts/FilterHeaderTool/filter.txt

## PixInsight Installation URL

Preferred (CDN):
- https://cdn.jsdelivr.net/gh/Trickx/pi-scripts@main/FilterHeaderTool/update.xri

Alternative (raw content):
- https://raw.githubusercontent.com/Trickx/pi-scripts/main/FilterHeaderTool/update.xri

Requested path form:
- https://github.com/Trickx/pi-scripts/FilterHeaderTool/

Note:
- `raw.githubusercontent.com` does not serve directory listings, so
	`.../FilterHeaderTool/` returns HTTP 404.
- PixInsight must receive the direct XRI file URL shown above.

## Publish Steps

1. Push this repository to origin/main.
2. In PixInsight, open Resources > Updates > Manage Repositories.
3. Add the repository URL.
4. Check for updates and install the script package.
