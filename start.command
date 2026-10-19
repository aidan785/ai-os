#!/bin/zsh
# macOS: double-click to launch AIOS and open it in your browser.
cd "$(dirname "$0")"
lsof -ti tcp:4747 >/dev/null || (node server.mjs &)
sleep 2 && open http://localhost:4747
wait
