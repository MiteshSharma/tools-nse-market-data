.DEFAULT_GOAL := help

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Setup"
	@echo "  prepare              - npm install"
	@echo ""
	@echo "Development"
	@echo "  build                - tsup → dist/"
	@echo "  dev                  - tsup --watch"
	@echo ""
	@echo "Quality"
	@echo "  test                 - vitest run"
	@echo "  typecheck            - tsc --noEmit"
	@echo "  lint                 - biome check ."
	@echo "  format               - biome check --write . (auto-fix)"
	@echo "  check                - typecheck + lint + test (run before declaring done)"
	@echo ""
	@echo "Versioning"
	@echo "  version              - Print current version from package.json"
	@echo "  version-bump-patch   - 0.1.0 → 0.1.1"
	@echo "  version-bump-minor   - 0.1.0 → 0.2.0"
	@echo "  version-bump-major   - 0.1.0 → 1.0.0"
	@echo ""
	@echo "Release"
	@echo "  release              - check + build + tag + push (CI publishes to npm)"
	@echo "  release-dry          - show what release would do, no side effects"
	@echo ""
	@echo "Housekeeping"
	@echo "  clean                - Remove node_modules and dist/"
	@echo "  help                 - Print this help"

# ---------- setup ----------

prepare:
	npm install

# ---------- development ----------

build:
	npm run build

dev:
	npm run dev

# ---------- quality ----------

test:
	npm run test

typecheck:
	npm run typecheck

lint:
	npm run lint

format:
	npm run lint:fix

# Typecheck + lint + test — mirrors CI. Run before every commit.
check:
	npm run check

# ---------- versioning ----------

version:
	@node -p "require('./package.json').version"

version-bump-patch:
	@node -e "\
	  const fs = require('node:fs');\
	  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\
	  const v = pkg.version.split('.');\
	  v[2] = String(Number(v[2]) + 1);\
	  pkg.version = v.join('.');\
	  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');\
	  console.log('Bumped to ' + pkg.version);\
	"

version-bump-minor:
	@node -e "\
	  const fs = require('node:fs');\
	  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\
	  const v = pkg.version.split('.');\
	  v[1] = String(Number(v[1]) + 1); v[2] = '0';\
	  pkg.version = v.join('.');\
	  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');\
	  console.log('Bumped to ' + pkg.version);\
	"

version-bump-major:
	@node -e "\
	  const fs = require('node:fs');\
	  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\
	  const v = pkg.version.split('.');\
	  v[0] = String(Number(v[0]) + 1); v[1] = '0'; v[2] = '0';\
	  pkg.version = v.join('.');\
	  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');\
	  console.log('Bumped to ' + pkg.version);\
	"

# ---------- release ----------

release-dry:
	@echo "=== Release dry run for v$$(node -p \"require('./package.json').version\") ==="
	@echo ""
	@echo "Steps that would run:"
	@echo "  1. npm run check    — typecheck + lint + test"
	@echo "  2. npm run build    — tsup → dist/"
	@echo "  3. git tag v<version>"
	@echo "  4. git push && git push --tags"
	@echo "  5. GitHub Actions publishes @ethosagent/tools-nse-market-data to npm"

release:
	@VERSION=$$(node -p "require('./package.json').version"); \
	echo "=== Releasing v$$VERSION ==="; \
	echo ""; \
	npm run check; \
	npm run build; \
	echo ""; \
	echo "Tagging and pushing..."; \
	git tag "v$$VERSION"; \
	git push && git push --tags; \
	echo ""; \
	echo "✓ Tagged v$$VERSION and pushed — GitHub Actions will publish to npm"

# ---------- housekeeping ----------

clean:
	rm -rf node_modules dist

.PHONY: help prepare build dev test typecheck lint format check \
        version version-bump-patch version-bump-minor version-bump-major \
        release release-dry clean
