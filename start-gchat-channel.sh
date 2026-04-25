#!/bin/bash
# Start the Claude Code Google Chat Channel
# Usage: ./start-gchat-channel.sh [ngrok-auth-token]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if built
if [ ! -f "dist/index.js" ]; then
    echo "Building..."
    npm run build
fi

# Check environment
if [ -z "$GOOGLE_CLIENT_EMAIL" ]; then
    echo "ERROR: GOOGLE_CLIENT_EMAIL not set"
    echo "Set Google Chat service account credentials in environment or .env file"
    exit 1
fi

if [ -z "$GOOGLE_PRIVATE_KEY" ]; then
    echo "ERROR: GOOGLE_PRIVATE_KEY not set"
    exit 1
fi

# Start ngrok tunnel if token provided
if [ -n "$1" ]; then
    echo "Starting ngrok tunnel..."
    
    # Find ngrok
    NGROK_BIN="${NGROK_BIN:-/tmp/ngrok}"
    if [ ! -f "$NGROK_BIN" ]; then
        echo "ngrok not found at $NGROK_BIN"
        echo "Download from https://ngrok.com/download or set NGROK_BIN path"
        exit 1
    fi
    
    # Configure ngrok
    mkdir -p ~/.config/ngrok
    cat > ~/.config/ngrok/ngrok.yml <<EOF
version: 2
authtoken: $1
EOF
    
    # Start tunnel in background
    $NGROK_BIN http 8788 --log=stdout > /tmp/ngrok.log 2>&1 &
    NGROK_PID=$!
    
    # Wait for tunnel
    echo "Waiting for ngrok tunnel..."
    for i in {1..30}; do
        sleep 1
        TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
        if [ -n "$TUNNEL_URL" ]; then
            echo ""
            echo "========================================"
            echo "NGROK TUNNEL URL: ${TUNNEL_URL}/gchat"
            echo "========================================"
            echo ""
            echo "Configure this URL in Google Chat API Console:"
            echo "https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat"
            echo ""
            break
        fi
        echo -n "."
    done
    
    if [ -z "$TUNNEL_URL" ]; then
        echo "ERROR: Failed to get ngrok tunnel URL"
        kill $NGROK_PID 2>/dev/null || true
        exit 1
    fi
    
    trap "kill $NGROK_PID 2>/dev/null || true" EXIT
fi

# Start the channel server
echo "Starting Google Chat Channel..."
node dist/index.js
