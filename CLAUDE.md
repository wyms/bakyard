# Bakyard - Claude Code Instructions

## First Step: Sync with Remote

Before making any changes, always sync with the GitHub repo:

1. Run `git status` to check for local uncommitted changes
2. If there are local changes, stash them: `git stash`
3. Pull latest: `git pull origin main`
4. If changes were stashed, restore them: `git stash pop`
5. If there are merge conflicts after stash pop, resolve them carefully — never discard local work

## Always Test and Push

After making code changes:

1. Run the full test suite: `npx jest`
2. All tests must pass before committing
3. Commit with a descriptive message
4. Push to GitHub: `git push origin main`

Do not leave changes uncommitted or unpushed at the end of a session.
