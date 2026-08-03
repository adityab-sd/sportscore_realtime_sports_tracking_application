"""
run_all_updaters.py — runs ALL FOUR sport updaters together (local testing).

Usage (from backend/rag, with .venv active and .env in place):
    python run_all_updaters.py

Keep it running in its own terminal. It refreshes football, basketball, baseball
and F1 into the live index continuously, so the assistant has data for every
sport — the same thing start.sh does inside the deployed container.
Press Ctrl+C to stop.
"""
import threading
import time
import traceback

import football_live_updater
import basketball_live_updater
import baseball_live_updater
import f1_live_updater

UPDATERS = [
    ("football",   football_live_updater),
    ("basketball", basketball_live_updater),
    ("baseball",   baseball_live_updater),
    ("f1",         f1_live_updater),
]


def _run_forever(name, module):
    while True:
        try:
            module.run()  # each run() is its own while-True loop; if it returns/crashes we restart it
        except Exception:
            print(f"[run_all] {name} updater crashed — restarting in 15s")
            traceback.print_exc()
            time.sleep(15)


if __name__ == "__main__":
    print("[run_all] starting all 4 updaters (football, basketball, baseball, f1)...")
    for name, module in UPDATERS:
        threading.Thread(target=_run_forever, args=(name, module), daemon=True).start()
        time.sleep(1)  # small stagger so their prints don't interleave on the first cycle
    print("[run_all] all updaters started. Leave this running. Ctrl+C to stop.")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("\n[run_all] stopping.")