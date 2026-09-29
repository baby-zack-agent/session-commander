#!/bin/sh
# quick smoke test: CLI runs, free commands work with no transcripts present
set -e
./bin/session-commander --help >/dev/null
./bin/session-commander status
SC_CLAUDE_DIR=/tmp/does-not-exist SC_CODEX_DIR=/tmp/does-not-exist ./bin/session-commander sessions
npm test
echo "selftest OK"
