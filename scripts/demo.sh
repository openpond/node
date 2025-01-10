#!/bin/bash

# Kill existing session if it exists
tmux kill-session -t swarm 2>/dev/null

# Create new session with three panes
tmux new-session -d -s swarm

# Split into three panes: CLI, Soulie log, Glu log
tmux split-window -h
tmux split-window -h

# Set pane sizes (33% each)
tmux select-layout even-horizontal

# Setup each pane
tmux select-pane -t 0
tmux send-keys "echo 'Starting CLI...' && sleep 2 && bun run scripts/swarm-cli.ts start" C-m

tmux select-pane -t 1
tmux send-keys "echo 'Watching Soulie messages...' && sleep 2 && grep 'soulie' swarm.log -i --line-buffered | grep -v 'Starting' --line-buffered" C-m

tmux select-pane -t 2
tmux send-keys "echo 'Watching Glu messages...' && sleep 2 && grep 'glu' swarm.log -i --line-buffered | grep -v 'Starting' --line-buffered" C-m

# Attach to session
tmux -2 attach-session -d 