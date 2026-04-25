# Claude Code Google Chat Channel

A custom [Claude Code Channel](https://code.claude.com/docs/en/channels-reference) that bridges Google Chat with Claude Code, enabling two-way communication between Google Chat users and Claude.

## Architecture

```
Google Chat User → Google Chat API → Your HTTPS Endpoint (/gchat)
                                                        ↓
                                              Express HTTP Server
                                                        ↓
                                              MCP Channel Server (stdio)
                                                        ↓
                                              Claude Code Session
                                                        ↓
                                              MCP reply tool
                                                        ↓
                                              Google Chat API
                                                        ↓
                                              Google Chat User
```

## Prerequisites

1. **Node.js 18+** and npm
2. **Google Workspace account** with Google Chat access
3. **Google Cloud Project** with Chat API enabled
4. **Service account** with Chat Bot credentials
5. **Public HTTPS endpoint** (for Google Chat webhooks)

## Setup

### 1. Google Cloud Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Chat API**
4. Go to **APIs & Services > Credentials**
5. Create a **Service Account**:
   - Name: `claude-code-gchat`
   - Grant role: `Chat Bot Viewer`
6. Create a key for the service account (JSON format)
7. Note the `client_email` and `private_key` from the JSON

### 2. Configure Google Chat App

1. Go to [Chat API Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat)
2. Set up the app:
   - **App name**: Claude Code
   - **Avatar URL**: (optional) Add an avatar
   - **Description**: AI assistant powered by Claude
3. Under **Interactive features**:
   - **Functionality**: Check "Join spaces and group conversations"
   - **Connection settings**: Select **HTTP endpoint URL**
   - Enter your public HTTPS URL (e.g., `https://your-domain.com/gchat`)
4. Save the configuration

### 3. Install Dependencies

```bash
cd /home/clawdbot/repos/claude-code-gchat-channel
npm install
npm run build
```

### 4. Configure Environment

Copy the example config and fill in your values:

```bash
cp .mcp.json.example .mcp.json
```

Edit `.mcp.json` with your actual credentials:

```json
{
  "mcpServers": {
    "gchat": {
      "command": "node",
      "args": ["/home/clawdbot/repos/claude-code-gchat-channel/dist/index.js"],
      "env": {
        "GOOGLE_CLIENT_EMAIL": "your-service-account@project.iam.gserviceaccount.com",
        "GOOGLE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----",
        "GOOGLE_PROJECT_NUMBER": "123456789",
        "GCHAT_PORT": "8788",
        "GCHAT_ALLOWED_SPACES": ""
      }
    }
  }
}
```

**Note**: The private key must have actual newlines. If using JSON, use `\n` escapes.

### 5. Expose HTTP Endpoint

Google Chat requires a public HTTPS endpoint. Options:

#### Option A: Using ngrok (for development)

```bash
# Install ngrok
npm install -g ngrok

# Start tunnel to your local server
ngrok http 8788

# Use the HTTPS URL provided (e.g., https://abc123.ngrok.io/gchat)
# Update your Google Chat app configuration with this URL
```

#### Option B: Using Cloudflare Tunnel

```bash
# Install cloudflared
# See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

cloudflared tunnel --url http://localhost:8788
```

#### Option C: Deploy to a VPS

Deploy the channel to a VPS with a public IP and HTTPS (using nginx + Let's Encrypt).

### 6. Start Claude Code with the Channel

```bash
# From a project directory with .mcp.json
claude --dangerously-load-development-channels server:gchat

# Or add to your global ~/.claude.json config
```

## Usage

1. Add the Claude bot to a Google Chat space
2. Mention the bot with `@Claude` followed by your message
3. Claude will receive the message and respond in the same space

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_EMAIL` | Service account client email | (required) |
| `GOOGLE_PRIVATE_KEY` | Service account private key | (required) |
| `GOOGLE_PROJECT_NUMBER` | Google Cloud project number | (required) |
| `GCHAT_PORT` | HTTP server port | `8788` |
| `GCHAT_HOST` | HTTP server host | `0.0.0.0` |
| `GCHAT_ALLOWED_SPACES` | Comma-separated list of allowed space names | (empty = allow all) |

## Security

- **Space gating**: Use `GCHAT_ALLOWED_SPACES` to restrict which spaces can interact with Claude
- **Service account**: Keep the private key secure - it has bot permissions
- **HTTPS only**: Google Chat requires HTTPS endpoints

## Troubleshooting

### "Failed to connect" in Claude Code

Check the debug log:
```bash
cat ~/.claude/debug/<session-id>.txt
```

### Google Chat not receiving responses

1. Verify the service account has the correct permissions
2. Check that the bot is added to the space
3. Ensure the HTTPS endpoint is accessible from Google's servers

### Messages not forwarding to Claude

1. Check the HTTP server logs
2. Verify the Google Chat app configuration URL matches your endpoint
3. Test the endpoint manually:
   ```bash
   curl -X POST https://your-domain.com/gchat \
     -H "Content-Type: application/json" \
     -d '{"type":"MESSAGE","message":{"text":"Hello"},"space":{"name":"spaces/TEST"},"user":{"displayName":"Test"}}'
   ```

## License

MIT
