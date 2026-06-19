#!/bin/bash
set -e

echo "Building library bundle..."
npm run build:lib

echo "Checking dist-lib/remi-widget.js exists..."
if [ ! -f "dist-lib/remi-widget.js" ]; then
  echo "ERROR: dist-lib/remi-widget.js not found"
  exit 1
fi

echo "Checking bundle size..."
SIZE=$(du -h dist-lib/remi-widget.js | cut -f1)
echo "Bundle size: $SIZE"

echo "Dry-run packing tarball contents..."
npm pack --dry-run

echo "Verification complete. Review the file list above."
echo "If correct, run: npm publish"
