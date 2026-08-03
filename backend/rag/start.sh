#!/usr/bin/env bash
# start.sh — container entrypoint for the RAG service (Option A).
# Runs the 4 live-data updater loops as background processes (so the Azure Search
# live index stays continuously fresh) AND the gunicorn web server (which answers
# questions). Everything runs inside this one container.

set -u

echo "[start] Ensuring the live search index exists (idempotent)..."
python create_live_football_index.py || echo "[start] index-create step skipped (probably already exists)"

# Run a script forever, auto-restarting it if it crashes — so one bad ESPN fetch
# doesn't permanently stop that sport's data from updating.
run_forever() {
    local script="$1"
    while true; do
        echo "[start] launching ${script}"
        python "${script}"
        echo "[start] ${script} exited (code $?). Restarting in 15s..."
        sleep 15
    done
}

echo "[start] Starting the 4 live updaters in the background..."
run_forever football_live_updater.py   &
run_forever basketball_live_updater.py &
run_forever baseball_live_updater.py   &
run_forever f1_live_updater.py         &

echo "[start] Starting the web server (gunicorn) in the foreground..."
# exec so gunicorn becomes the main process; if it dies the container restarts,
# which restarts the updaters too.
exec gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 4 --timeout 120 --preload app:app