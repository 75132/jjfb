# Contributing

Thanks for contributing to Juben Story Editor.

## Development Setup

```bash
npm install
npm run dev:full
```

## Quality Gate

Before opening a PR, run:

```bash
npm run check
npm run build
```

## Commit / PR Guidelines

- Keep PRs focused and small.
- Explain the user-facing impact in PR summary.
- Add or update tests when behavior changes.
- If UI changes, include screenshots or short videos.

## Branching

- Create feature branches from `main` (or `master` depending on repository default).
- Rebase/merge frequently to keep conflicts small.

## Reporting Bugs

Use the bug report issue template and include:

- exact reproduction steps
- expected vs actual behavior
- environment (OS, browser, Node)
- sample JSON when relevant
