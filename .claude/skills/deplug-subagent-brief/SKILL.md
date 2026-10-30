---
name: deplug-subagent-brief
description: The standing brief to give a sub-agent (or a new session) that works on Deplug in its own git worktree: project rules, disk and environment limits, verification, how to report. Use when delegating a Deplug task to an agent.
---

# Briefing an agent for Deplug

Give each agent its **own git worktree** from `origin/main` (`git worktree add -B w-<topic> /home/user/deplug-<topic> origin/main`,
then `ln -s <main checkout>/node_modules node_modules`) and one themed task. Remove worktrees once merged (disk is small).
Put this at the top of the prompt, then the task:

> Read `CLAUDE.md` and use the project skills in `.claude/skills/deplug-*` (checks, new-setting, new-format, ui-screenshots).
> You work only in your worktree and branch; push with `git push -u origin HEAD:claude/dazzling-ritchie-bvj4lw-<suffix>`; do not open a PR,
> do not merge, never push to another branch. English comments/commits; UI strings in both `en.ts` and `it.ts`; shadcn components;
> no signatures in commits; docs EN+IT; one line in `CHANGELOG.md` under Unreleased. Use `CARGO_TARGET_DIR=/home/user/shared-target`.
> Keep edits to shared files (portable-core `Settings`, `AppSettings.ts`, `en.ts`/`it.ts`, `App.tsx`, `UninstallDialog.tsx`, `Toolbar.tsx`)
> small and appended at the end of blocks so the owner can merge parallel branches. Run the checks and report what changed, what you
> verified and what is unverified (nothing can run on real Windows or macOS here).

Task prompts should state the goal, the exact behavior wanted, the files likely involved, safety constraints, and what
"done" looks like. UI tasks: ask for mocked-backend screenshots (EN/IT, light/dark, 640/900/1200 px) and for the agent
to open a few of them before reporting; mention the installed design skills (`ui-ux-pro-max`, `design-taste-frontend`,
`webapp-testing`) when they help.

After delivery the owner (lead) reviews the diff, merges `origin/main` into the branch (resolving the usual conflicts in
the shared files by keeping both sides), re-runs the checks, opens the PR and waits for CI on the latest commit.
