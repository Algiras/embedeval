#!/bin/bash

# Docker helper script for EmbedEval

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR"

function start() {
    echo "Starting Redis for BullMQ..."
    cd "$DOCKER_DIR"
    docker-compose up -d
    
    # Wait for Redis to be healthy
    echo "Waiting for Redis to be ready..."
    sleep 2
    
    until docker-compose exec -T redis redis-cli ping | grep -q PONG; do
        echo "Redis is not ready yet, waiting..."
        sleep 1
    done
    
    echo "Redis is ready!"
    echo "Redis URL: redis://localhost:6379"
}

function stop() {
    echo "Stopping Redis..."
    cd "$DOCKER_DIR"
    docker-compose down
}

function restart() {
    stop
    sleep 2
    start
}

function status() {
    cd "$DOCKER_DIR"
    docker-compose ps
}

function logs() {
    cd "$DOCKER_DIR"
    docker-compose logs -f redis
}

function reset() {
    echo "WARNING: This will delete all Redis data!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$DOCKER_DIR"
        docker-compose down -v
        echo "Redis data cleared."
    fi
}

case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    reset)
        reset
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|reset}"
        exit 1
        ;;
esac
