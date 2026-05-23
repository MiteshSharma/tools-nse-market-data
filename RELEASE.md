# Releasing @ethosagent/tools-nse-market-data

## Version source of truth

`version` in `package.json` is the single source of truth. The git tag and npm registry must match it.

Never edit `package.json` version directly. Use `make version-bump-*`.

## What gets published

One package: `@ethosagent/tools-nse-market-data` — published to npm with `--access public`.

The `files` field in `package.json` controls what ships:
```
dist/          ← compiled JS + .d.ts + sourcemaps
README.md
CHANGELOG.md
LICENSE
```

`src/` is never published.

## Prerequisites — first time only

### For CI releases (primary path)

1. Create an npm Automation token: [npmjs.com](https://www.npmjs.com) → Account → Access Tokens → **Generate New Token → Automation** → copy.
2. Add it as a GitHub repo secret: **Settings → Secrets and variables → Actions → New repository secret** → name `NPM_TOKEN`.

### For local releases (escape hatch)

```bash
node --version    # must be v24.x
npm login
npm whoami        # should show your npm username
```

## End-to-end release flow

### Step 1 — Decide the bump

| Change type | Bump |
|---|---|
| Bug fixes, docs, internal refactors | patch (`0.1.0 → 0.1.1`) |
| New features, new tools, new CLI commands | minor (`0.1.0 → 0.2.0`) |
| Breaking API changes | major (`0.1.0 → 1.0.0`) |

### Step 2 — Bump version and push

```bash
git checkout main && git pull origin main

make version-bump-patch    # or -minor or -major

# Update CHANGELOG.md — add entry for the new version
# Then commit:
git add package.json CHANGELOG.md
git commit -m "chore: release v$(make version)"
git push origin main
```

Wait for CI (typecheck + lint + test + build) to go green on `main` before triggering release.

### Step 3 — Trigger release

#### Primary path: button click

1. GitHub → **Actions** tab → **Release** in the left sidebar.
2. **Run workflow** (top right) → branch `main` → enter the version (e.g. `0.1.1`) → **Run workflow**.

The workflow runs `npm ci`, `npm run build`, then `npm publish --access public` with the `NPM_TOKEN` secret.

#### Escape hatch: local publish

If CI is unavailable:

```bash
make release
# or, to publish without tagging (idempotent):
make release-npm
```

### Step 4 — Verify

```bash
make smoke
# or manually:
npm view @ethosagent/tools-nse-market-data version
```

## Pre-flight gates (`make verify`)

Run automatically by `make release` and `make release-dry`. Also run manually before any release:

| Gate | What it checks |
|---|---|
| G1 version | `package.json` version is not `0.0.0` |
| G2 clean tree | No uncommitted changes |
| G3 on main | Current branch is `main` |
| G4 no tag yet | `v<version>` tag doesn't already exist |

## Quick reference

```bash
# Routine patch release (primary — via CI button)
make version-bump-patch
# edit CHANGELOG.md
git add package.json CHANGELOG.md
git commit -m "chore: release v$(make version)"
git push origin main
# then: GitHub → Actions → Release → Run workflow

# Escape hatch (local publish)
make version-bump-patch
# edit CHANGELOG.md, commit, push
make release

# Dry run (no side effects)
make release-dry

# Pre-flight only
make verify

# Post-publish smoke test
make smoke

# Idempotent publish (no tag — recovery)
make release-npm
```

## Recovery

| Failure | Recovery |
|---|---|
| CI red before release | Fix on `main`, re-push, wait for green, then re-trigger |
| Publish failed, no tag | Run `make release-npm` to retry publish, then tag manually |
| Tag exists but not published | `git tag -d v<version> && git push origin :refs/tags/v<version>` → fix → re-release |
| Published version is broken | `make version-bump-patch` → fix → release; or `npm deprecate @ethosagent/tools-nse-market-data@<bad-version> "broken; use <next>"` |
