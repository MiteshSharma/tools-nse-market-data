# Agent Configuration

## What this repo is

A standalone npm package providing NSE India market data tools. The primary reference document is `tools-nse-market-data.md` — read it before writing any code.

## Mandatory first reads

Before writing any code, read:
1. `tools-nse-market-data.md` — complete implementation spec
2. `CLAUDE.md` — conventions, commands, and gotchas
3. `src/` — current state of the implementation

## What agents are allowed to do

- Read any file in this repo
- Write and edit source files in `src/`
- Write and edit test files in `src/__tests__/`
- Run `npm run build`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run lint:fix`
- Run `git status`, `git diff`, `git log` (read-only git operations)
- Create feature branches

## What agents must NOT do without explicit user confirmation

- `git push` or `git push --tags`
- `npm publish`
- Delete files
- `git reset --hard`, `git checkout --`, force-push
- Modify `package.json` version field
- Modify `CHANGELOG.md` release entries

## Code review

After writing non-trivial code, do a self-review pass:
1. Check for unused imports, dead code, typos
2. Verify extensionless imports (`./store` not `./store.ts`)
3. Verify no `console.log` in library files (only `cli.ts`)
4. Run `npm run check` — do not declare done until it passes

## Skills available

- `.agents/skills/code-review/` — code review guidelines
- `.agents/skills/nse-market-data/` — domain knowledge for NSE data and Yahoo Finance
