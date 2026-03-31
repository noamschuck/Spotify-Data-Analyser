#!/bin/bash
cd /home/fakebakon76/Documents/spotify-app

# Start dev server only if not already running
if ! lsof -ti:5173 > /dev/null 2>&1; then
  npm run dev &>/dev/null &
  # Wait until server is ready
  while ! curl -s http://127.0.0.1:5173 > /dev/null 2>&1; do
    sleep 0.3
  done
fi

xdg-open http://127.0.0.1:5173
