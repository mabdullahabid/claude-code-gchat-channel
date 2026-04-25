# Claude Code Google Chat Channel - Deployment Guide

## Overview

This is a custom **Claude Code Channel** that bridges Google Chat with Claude Code, enabling two-way communication. Users can @mention the bot in Google Chat, and Claude responds directly in the chat.

**Repository:** https://github.com/mabdullahabid/claude-code-gchat-channel

## Architecture

```
Google Chat User → Google Chat API → HTTPS Endpoint (/gchat)
                                            ↓
                                    Express HTTP Server (port 8788)
                                            ↓
                                    MCP Channel Server (stdio)
                                            ↓
                                    Claude Code Session
                                            ↓
                                    MCP "reply" tool
                                            ↓
                                    Google Chat API
                                            ↓
                                    Google Chat User
```

## Current Status

✅ **Built and tested locally** - Server starts, receives events, forwards to MCP
⬜ **Needs Google Cloud credentials** - Service account required
⬜ **Needs public HTTPS endpoint** - ngrok or deployed domain
⬜ **Needs Google Chat app configuration** - Webhook URL setup
⬜ **Needs Claude Code testing** - `--dangerously-load-development-channels`

## Deployment Steps

### 1. Google Cloud Setup (Required)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. **Enable Google Chat API**
4. Go to **APIs & Services > Credentials**
5. Create a **Service Account**:
   - Name: `claude-code-gchat`
   - Role: `Chat Bot Viewer`
6. Create a **JSON key** and download it
7. Extract from the JSON:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`
   - `project_id` → Note for later

### 2. Configure Environment

```bash
cd /home/clawdbot/repos/claude-code-gchat-channel
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----"
GOOGLE_PROJECT_NUMBER=123456789
GCHAT_PORT=8788
GCHAT_ALLOWED_SPACES=          # Optional: restrict to specific spaces
```

### 3. Expose HTTPS Endpoint

#### Option A: ngrok (Development)

```bash
# Get token from https://dashboard.ngrok.com
export NGROK_AUTHTOKEN=your_token

# Start with tunnel
./start-gchat-channel.sh $NGROK_AUTHTOKEN
```

This outputs a URL like `https://abc123.ngrok.io/gchat` - use this in Google Chat config.

#### Option B: Cloudflare Tunnel (Persistent)

```bash
# Install cloudflared
# See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

cloudflared tunnel --url http://localhost:8788
```

#### Option C: Deploy to VPS

Use the systemd service file:
```bash
sudo cp claude-gchat.service /etc/systemd/system/
sudo systemctl enable claude-gchat
sudo systemctl start claude-gchat
```

### 4. Configure Google Chat App

1. Go to [Chat API Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat)
2. Set up:
   - **App name**: Claude Code
   - **Avatar URL**: (optional)
   - **Description**: AI assistant powered by Claude
3. Under **Interactive features**:
   - **Functionality**: Check "Join spaces and group conversations"
   - **Connection settings**: HTTP endpoint URL
   - Enter: `https://your-domain.com/gchat`
4. Save

### 5. Start Claude Code with Channel

```bash
# From project directory with .mcp.json
claude --dangerously-load-development-channels server:gchat

# Or add to ~/.claude.json for global use
```

## Testing

1. Add the Claude bot to a Google Chat space
2. Send: `@Claude Hello, can you help me with something?`
3. Claude should receive the message and respond in the same space

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main channel server |
| `dist/index.js` | Compiled output |
| `start-gchat-channel.sh` | Start script with ngrok |
| `setup.sh` | Interactive setup wizard |
| `claude-gchat.service` | systemd service file |
| `.env.example` | Environment template |
| `.mcp.json.example` | MCP config template |

## Security

- **Space gating**: Use `GCHAT_ALLOWED_SPACES` to restrict access
- **Service account**: Keep private key secure
- **HTTPS only**: Google Chat requires HTTPS endpoints
- **Development flag**: `--dangerously-load-development-channels` is required during research preview

## Troubleshooting

### "Failed to connect" in Claude Code
```bash
cat ~/.claude/debug/<session-id>.txt
```

### Google Chat not receiving responses
1. Verify service account has `chat.bot` scope
2. Check bot is added to space
3. Ensure HTTPS endpoint is accessible

### Messages not forwarding
```bash
# Test endpoint manually
curl -X POST https://your-domain.com/gchat \
  -H "Content-Type: application/json" \
  -d '{"type":"MESSAGE","message":{"text":"test","argumentText":"test"},"space":{"name":"spaces/TEST"},"user":{"displayName":"Test"}}'
```

## Next Steps

1. ⬜ Get Google Cloud service account credentials
2. ⬜ Choose deployment method (ngrok/dev or VPS/prod)
3. ⬜ Configure Google Chat app webhook URL
4. ⬜ Test end-to-end with Claude Code
5. ⬜ Consider adding features:
   - Card responses (rich UI)
   - Slash commands (`/help`, `/status`)
   - File attachments
   - Thread management
   - Permission relay (approve/deny tool use remotely)

## References

- [Claude Code Channels Reference](https://code.claude.com/docs/en/channels-reference)
- [Google Chat API Docs](https://developers.google.com/workspace/chat)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
