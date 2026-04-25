# Quick Start Script for Google Chat Channel
# This script helps you set up the Google Chat channel step by step

set -e

echo "=========================================="
echo "Claude Code Google Chat Channel Setup"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Check Node.js
echo "Step 1: Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js 18+ required. Found: $(node --version)"
    exit 1
fi
echo "✓ Node.js $(node --version)"

# Step 2: Install dependencies
echo ""
echo "Step 2: Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# Step 3: Build
echo ""
echo "Step 3: Building..."
npm run build
echo "✓ Build complete"

# Step 4: Check for credentials
echo ""
echo "Step 4: Checking Google credentials..."
if [ -f ".env" ]; then
    echo "✓ .env file found"
    source .env
else
    echo "⚠ No .env file found"
fi

if [ -z "$GOOGLE_CLIENT_EMAIL" ] || [ -z "$GOOGLE_PRIVATE_KEY" ]; then
    echo ""
    echo "=========================================="
    echo "GOOGLE CREDENTIALS REQUIRED"
    echo "=========================================="
    echo ""
    echo "You need to create a Google Cloud service account:"
    echo ""
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create/select a project"
    echo "3. Enable Google Chat API"
    echo "4. Go to APIs & Services > Credentials"
    echo "5. Create Service Account:"
    echo "   - Name: claude-code-gchat"
    echo "   - Role: Chat Bot Viewer"
    echo "6. Create JSON key and download"
    echo "7. Extract client_email and private_key"
    echo ""
    echo "Then create .env file:"
    echo ""
    cat << 'EOF'
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_KEY_HERE
-----END PRIVATE KEY-----"
GOOGLE_PROJECT_NUMBER=123456789
GCHAT_PORT=8788
GCHAT_ALLOWED_SPACES=
EOF
    echo ""
    echo "Or set them as environment variables."
    exit 1
fi

echo "✓ Google credentials configured"

# Step 5: ngrok setup
echo ""
echo "Step 5: Checking ngrok..."
NGROK_BIN="${NGROK_BIN:-/tmp/ngrok}"
if [ ! -f "$NGROK_BIN" ]; then
    echo "Downloading ngrok..."
    curl -L -o /tmp/ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
    tar xzf /tmp/ngrok.tgz -C /tmp
    echo "✓ ngrok downloaded to /tmp/ngrok"
else
    echo "✓ ngrok found at $NGROK_BIN"
fi

# Check ngrok auth
if [ -z "$NGROK_AUTHTOKEN" ]; then
    echo ""
    echo "⚠ NGROK_AUTHTOKEN not set"
    echo "Get your token from https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "Set it: export NGROK_AUTHTOKEN=your_token"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Get ngrok auth token from https://dashboard.ngrok.com"
echo "2. Run: export NGROK_AUTHTOKEN=your_token"
echo "3. Start the channel:"
echo "   ./start-gchat-channel.sh $NGROK_AUTHTOKEN"
echo ""
echo "Or with explicit env:"
echo "   GOOGLE_CLIENT_EMAIL=... GOOGLE_PRIVATE_KEY=... ./start-gchat-channel.sh $NGROK_AUTHTOKEN"
echo ""
echo "4. Configure the HTTPS URL in Google Chat API Console:"
echo "   https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat"
echo ""
