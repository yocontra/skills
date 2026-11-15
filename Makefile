.PHONY: sync sync-openspec sync-local lint hooks install check-workflows check-evals evals vale pre-commit

# Install dependencies
install:
	uv sync
	@if command -v vale >/dev/null 2>&1; then \
		echo "Syncing Vale styles..."; vale sync; \
	else \
		echo "vale not found — install it for prose linting: https://vale.sh/docs/install"; \
	fi

# Sync all external skills
sync: sync-openspec

# Regenerate the openspec plugin from the pinned OpenSpec CLI (plugins/openspec/openspec-version)
sync-openspec:
	scripts/sync-openspec.sh

# Fast inner-loop dev: mirror ./plugins/ and the marketplace manifest into the
# locally-installed marketplace clone so edits land in Claude Code immediately.
# Avoids the round-trip through `git push` + `/plugin marketplace update`.
# Override MARKETPLACE_DIR to point at a different clone.
sync-local:
	@MARKETPLACE_DIR="$${MARKETPLACE_DIR:-$$HOME/.claude/plugins/marketplaces/skills}"; \
	if [ ! -d "$$MARKETPLACE_DIR" ]; then \
		echo "Skipping: marketplace dir not found at $$MARKETPLACE_DIR (install the marketplace first)"; \
		exit 0; \
	fi; \
	rsync -a --delete \
		--exclude='.git' \
		--exclude='.DS_Store' \
		--exclude='node_modules' \
		--exclude='__pycache__' \
		--exclude='.venv' \
		--exclude='dist' \
		--exclude='build' \
		--exclude='evals' \
		./plugins/ "$$MARKETPLACE_DIR/plugins/"; \
	mkdir -p "$$MARKETPLACE_DIR/.claude-plugin"; \
	cp .claude-plugin/marketplace.json "$$MARKETPLACE_DIR/.claude-plugin/marketplace.json"; \
	echo "Synced ./plugins/ + marketplace.json -> $$MARKETPLACE_DIR/"

# Run prek hooks
hooks:
	prek run --all-files

# Vale prose linting over docs + source comments
vale:
	scripts/vale-lint.sh

# Validate bundled dynamic-workflow scripts + plugin/marketplace version parity
check-workflows:
	node scripts/check-workflows.mjs

# Validate every plugin's eval suite: structure, scorability, skill coverage
check-evals:
	node scripts/check-evals.mjs

# Enforce per-token cost budgets on skills (description, body, refs, fan-out)
check-cost:
	node scripts/check-cost.mjs

# Run the eval suites for real (costs money). Usage:
#   make evals PLUGIN=gh
#   make evals PLUGIN=--all EVAL_ARGS="--runs 1 --ablation none"
PLUGIN ?= --all
EVAL_ARGS ?= --runs 1 --ablation none
evals:
	scripts/run-evals.sh $(PLUGIN) $(EVAL_ARGS)

# Full pre-commit gate: prek hooks (incl. Vale) + workflow/version/eval checks
pre-commit: hooks check-workflows check-evals

# Lint markdown files (trailing whitespace, EOF)
lint: hooks check-workflows check-evals
