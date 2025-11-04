#!/bin/bash
cd /workspace/Pairleroy
git add .
git commit -m "Improve stats modal with better data access and additional metrics

- Enhanced refreshStatsModal() with better error handling
- Added completion percentage and total combos display
- Improved data access safety for overlayByJunction and castleByJunction
- Added more detailed combo type descriptions (Mono/Bi/Tri)
- Better section titles and organization"
git push origin main