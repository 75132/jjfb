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

剧情系统相关改动（requirement / effect / 导出 / StoryManager）还须通过仓库根目录门禁：

```bash
cd ..   # jjfb 根目录
npm run test:story-gate
```

## 剧情能力扩展（五步法）

新增 `requirement` 或 `effect` 时，按顺序完成（详见 `../docs/story-system-plan.md` §7）：

1. 更新 `data/client-runtime-manifest.json`（`capabilities` 对应档位）
2. 实现 `server/services/story_service.py`
3. 实现 `assets/Script/Game/story-requirements.ts` 或 `StoryManager` 表现
4. Juben Inspector 可配 + `map-export-pipeline` 校验
5. 测试：Juben + server + `tests/runtime` 至少各 1 例

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
