# Empty-project application recovery

The Coffee House Frontend execution completed successfully with four exact proposed files. Application was denied because the broker requested creation of the missing `src` and `tests` directories, while role prefixes were stored as `src/` and `tests/`. Those parent names did not match the role check.

## Permission correction

A directory operation can match an ancestor of a role prefix only when the current task includes a descendant file inside that same role prefix. Exact task scope, canonical workspace checks, protected control-plane paths, role exclusions, expiring approvals and per-file before hashes remain enforced. Creating a parent does not authorize writes to its siblings or other files.

Denied or expired pending approvals can now be explicitly renewed from the UI. Renewal preserves the original task/result/execution ID, compares the unchanged patches and original source bytes, retains the previous approval in history, and requests fresh permission records. It never approves or applies files and never re-executes the employee. A valid pending approval cannot be repeatedly renewed. Existing confirmations are not widened.

## Preserved live work and project setup

The selected project is `19afa022-a796-464a-aba8-9f532e360094` (Sample), whose registered canonical workspace is **C:\Projects**, not C:\Projects\Sample. The workspace association was not changed. Existing MASIX/Sample directories were not modified.

Before setup, the idle workflow was explicitly paused and its `workflows.json`, `recovery.json`, `permissions.json` and full Frontend proposal were copied under the existing ignored project state directory:

`.ai-office/projects/19afa022-a796-464a-aba8-9f532e360094/.ai-office/before-project-setup-1794950292775/`

The same backup contains `project-setup/` with copies of all eight setup files, including the dependency lockfile. Setup in C:\Projects adds package scripts, pinned React/Vite/TypeScript/Vitest/jsdom/Testing Library dependencies, `index.html`, `src/main.tsx`, TypeScript/Vite configuration, test cleanup/matchers and `.gitignore`. Registry packages were installed with lifecycle scripts disabled. `npm run dev` uses port 5174; AI Office keeps 5173. `npm run build` checks types then builds; `npm test` runs Vitest. No unrelated source files were overwritten.

The four original proposed files remain unapplied until their exact diff is approved:

| File | SHA-256 of proposed bytes |
| --- | --- |
| src/App.tsx | 0f025006d155af7752177d56ea63df59caa15ffbe866c5cca17f70acf62a140a |
| tests/App.test.tsx | 30f47fdb4dacb45ccb0cf9caa8fdc96190687c43c1d4ddd24fe76f4e70ab3e4e |
| src/styles/coffee-house.css | 5ee4864fab6b2794b71d6a76825177789004205016bf734050eb0a8645423cc8 |
| tests/coffee-house-styles.test.ts | b5e2ced919c33d6ea97c024f1b40b782ed254a142a0165ffa43f4fc64bf944e2 |

A separate copy of those exact proposal bytes and setup files lives in C:\Projects\.ai-office\setup-preview. Type checking and production compilation of that copy succeeded without applying the proposal. Browser acceptance uses that built preview and a fresh isolated Mock office; it does not run real Codex tasks or approve any live effects.

## Checks and next action

Permission and broker regression tests cover initially absent directories, exact-byte application after approval, role/sibling denials and protected paths. Workflow tests cover renewal with unchanged completed results and fresh pending confirmation. Full suite: 224 Node tests and 6 Python tests passed. AI Office production build passed.

After the bridge reloads the fix, renew the denied request, inspect its four-file diff and explicitly confirm it. Connect required employees and resume only when ready for real work. Neither restarting the paused workflow nor renewing a request launches a new model task.

QA remains restricted: the local Docker engine was unavailable during setup, and the registered executor currently supports exact isolated Node tests rather than this proposal's Vitest/TSX suite. These are not passing test receipts. Host execution is not substituted for isolation, and Node tests cannot establish browser acceptance. Completing automated QA for this UI will require a verified runner supporting its test framework and attributable browser evidence; the setup does not waive that gate.
