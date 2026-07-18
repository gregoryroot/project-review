# Stack detection

Detect the stack from markers on disk, then adapt commands. Two rules govern
everything below.

**Rule 1 — a script defined in the manifest beats the generic form.** If
`package.json` defines `"test": "vitest run --coverage --reporter=verbose"`, run
`npm test`, not `npx vitest`. The script encodes setup — env vars, config paths,
flags — that the generic command silently loses, and a review that runs a
different command than CI does is reviewing a different project.

**Rule 2 — probe before you run.** Check the tool answers `--version` first. A
tool that is configured but not installed is an `infra[]` finding
(`confidence: confirmed`, you have the error output), never a silent skip. The
difference between "lint is clean" and "lint did not run" is the whole report.

## Marker → stack

| Marker file | Stack | Package manager resolved by |
|---|---|---|
| `package.json` | Node | `pnpm-lock.yaml` → pnpm · `yarn.lock` → yarn · `bun.lockb` → bun · `package-lock.json` or none → npm |
| `pyproject.toml` | Python | `uv.lock` → uv · `poetry.lock` → poetry · else pip |
| `requirements.txt` (no `pyproject.toml`) | Python | pip |
| `go.mod` | Go | go |
| `Cargo.toml` | Rust | cargo |
| `Gemfile` | Ruby | bundler |

Multiple markers means a polyglot repo: detect all, run each stack's commands,
and say so in `summary`. A `package.json` next to a `go.mod` is usually a
frontend beside a service, and reviewing only one of them is a silent
half-review.

**No marker matches** — report no stack detected, skip all command-running,
return four empty finding sets, and still produce a valid ten-key `review.json`.
A docs repo is a legitimate input, not an error.

## Commands per stack

Read from the manifest first; these are the fallbacks.

### Node
| Purpose | Command | Notes |
|---|---|---|
| lint | `<pm> run lint` | if no script, probe `npx eslint --version` then `npx eslint .` |
| typecheck | `<pm> run typecheck` | if no script and `tsconfig.json` exists: `npx tsc --noEmit`. Very commonly there is no script — check for the config, not the script |
| test | `<pm> test` | prefer a `test:coverage` script if one exists; coverage thresholds are worth reporting |
| audit | `npm audit --json --omit=dev` | pnpm: `pnpm audit --json --prod`. yarn: `yarn npm audit --json`. **`--json` always** — the human format is unparseable and the advisory ids are the point |
| build (`--deep` only) | `<pm> run build` | |
| e2e (`--deep` only) | `<pm> run e2e` / `test:e2e` | check whether CI actually gates it — see below |

### Python
| Purpose | Command |
|---|---|
| lint | `ruff check .` · fallback `flake8` |
| typecheck | `mypy .` · `pyright` if `pyrightconfig.json` |
| test | `pytest -q` (via `uv run` / `poetry run` if the lockfile says so) |
| audit | `pip-audit --format=json` · `uv pip audit` |

### Go
| Purpose | Command |
|---|---|
| lint | `golangci-lint run` · fallback `go vet ./...` |
| test | `go test ./...` |
| audit | `govulncheck ./...` |
| build (`--deep`) | `go build ./...` |

### Rust
| Purpose | Command |
|---|---|
| lint | `cargo clippy -- -D warnings` |
| test | `cargo test` |
| audit | `cargo audit --json` |

### Ruby
| Purpose | Command |
|---|---|
| lint | `bundle exec rubocop` |
| test | `bundle exec rspec` · `bundle exec rake test` |
| audit | `bundle exec bundler-audit check` |

## Never run

No opt-out, on any stack. These mutate the working tree or the lockfile, and the
read-only guarantee is the reason anyone will run this tool on their own repo.

- `npm ci`, `npm install`, `pnpm install`, `yarn install`, `bun install`
- `pip install`, `uv sync`, `poetry install`, `bundle install`
- `go mod tidy`, `go get`, `cargo update`
- anything with `--fix`, `--write`, `--update-snapshots`, `-u`, `--save`
- `npm audit fix`, `cargo fix`
- `git stash`, `git checkout`, `git clean`, `git reset` — any of them

**Dependencies not installed** (no `node_modules/`, no venv): do not install
them. Emit the affected `tests[]` entries with `status: "not-run"` and
`bootstrap` set to the exact command. A review that says "suite not run, run
`npm ci` first" is useful. A review that installed 400 packages into someone's
repo to find out is not.

## Before running anything that writes

Coverage reporters, JSON audit output, and test caches write files. Before
running such a command, confirm its output path is already ignored:

```
git check-ignore -q coverage/ && echo ignored
```

If the path is not ignored, run the command without its output flag, or skip it
and record an `assumptions[]` entry. Do not add anything to `.gitignore`.

## CI gating is a fact you must check, not assume

Read `.github/workflows/*.yml` (or the equivalent) and determine **which of the
commands you just ran are actually gated on merge.** A suite that exists but is
not wired into CI does not protect the project, and a review that assumes it
does will under-report risk in exactly the area the team feels safest about.

Record the answer in the project memory's Stack section — it is expensive to
re-derive and stable between runs. An e2e suite excluded from CI because it
needs a dataset that is not committed is the canonical case: real coverage
locally, zero protection on a pull request.
