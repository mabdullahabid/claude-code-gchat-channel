import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import bodyParser from 'body-parser';
import { google } from 'googleapis';
import { createServer } from 'http';

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.GCHAT_PORT || '8788', 10);
const HOST = process.env.GCHAT_HOST || '0.0.0.0';

// Google Chat app configuration
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GOOGLE_PROJECT_NUMBER = process.env.GOOGLE_PROJECT_NUMBER || '';

// Optional: restrict which Google Chat spaces can interact with this channel
const ALLOWED_SPACES = new Set(
  (process.env.GCHAT_ALLOWED_SPACES || '').split(',').filter(Boolean)
);

// ─── Google Chat API Client ──────────────────────────────────────────────────

let chatClient: ReturnType<typeof google.chat> | null = null;

async function getChatClient() {
  if (chatClient) return chatClient;
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/chat.bot'],
  });

  chatClient = google.chat({ version: 'v1', auth });
  return chatClient;
}

// ─── Express HTTP Server ─────────────────────────────────────────────────────

const app = express();
app.use(bodyParser.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', channel: 'gchat' });
});

// Google Chat interaction endpoint
app.post('/gchat', async (req, res) => {
  try {
    const event = req.body;
    console.error('[GChat] Received event:', JSON.stringify(event, null, 2));

    // Handle different event types
    const eventType = event.type;

    if (eventType === 'ADDED_TO_SPACE') {
      // Bot was added to a space - send welcome message
      res.json({
        text: 'Hello! I am Claude, connected through Claude Code. Mention me with @Claude to start a conversation.',
      });
      return;
    }

    if (eventType === 'REMOVED_FROM_SPACE') {
      // Bot was removed - just acknowledge
      res.json({});
      return;
    }

    if (eventType === 'MESSAGE') {
      // User sent a message - forward to Claude Code
      const message = event.message;
      const space = event.space;
      const user = event.user;

      // Gate: check allowed spaces
      const spaceName = space?.name || '';
      if (ALLOWED_SPACES.size > 0 && !ALLOWED_SPACES.has(spaceName)) {
        console.error(`[GChat] Rejected message from unauthorized space: ${spaceName}`);
        res.json({ text: 'This space is not authorized to use this bot.' });
        return;
      }

      // Extract message text (remove @mention if present)
      let text = message?.text || '';
      const argumentText = message?.argumentText || '';
      
      // Use argumentText if available (it's the text without the @mention)
      if (argumentText.trim()) {
        text = argumentText.trim();
      } else if (text) {
        // Remove @mention from text
        text = text.replace(/@\S+\s*/, '').trim();
      }

      if (!text) {
        res.json({ text: 'I received an empty message. How can I help you?' });
        return;
      }

      // Build sender info
      const senderName = user?.displayName || user?.name || 'Unknown';
      const senderEmail = user?.email || '';
      const threadName = message?.thread?.name || '';
      const messageName = message?.name || '';

      // Forward to Claude Code via MCP notification
      await mcpServer.notification({
        method: 'notifications/claude/channel',
        params: {
          content: text,
          meta: {
            space_name: spaceName,
            thread_name: threadName,
            message_name: messageName,
            sender_name: senderName,
            sender_email: senderEmail,
            chat_id: spaceName, // Used for routing replies
          },
        },
      });

      // Acknowledge receipt (Claude will reply async via the reply tool)
      res.json({});
      return;
    }

    if (eventType === 'CARD_CLICKED') {
      // Handle button clicks on cards if needed
      res.json({ text: 'Button clicks are not yet supported.' });
      return;
    }

    // Unknown event type
    console.error(`[GChat] Unknown event type: ${eventType}`);
    res.json({});
  } catch (error) {
    console.error('[GChat] Error handling event:', error);
    res.status(500).json({ text: 'An error occurred while processing your request.' });
  }
});

// ─── MCP Server ──────────────────────────────────────────────────────────────

const mcpServer = new Server(
  { name: 'gchat', version: '1.0.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `
You are connected to Google Chat via the gchat channel.

Messages arrive as: <channel source="gchat" space_name="..." thread_name="..." message_name="..." sender_name="..." sender_email="..." chat_id="...">

When you receive a message:
1. The sender_name attribute tells you who sent the message
2. The chat_id attribute is the space name - use this when replying
3. Respond naturally to the user's message

To reply back to Google Chat, use the "reply" tool with:
- chat_id: The space name from the incoming message (e.g., "spaces/AAAAxxxx")
- text: Your response text

Keep responses concise but helpful. You can use basic markdown formatting.
`.trim(),
  }
);

// Register the reply tool
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description: 'Send a message back to Google Chat',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'The Google Chat space name to reply in (e.g., spaces/AAAAxxxx)',
          },
          text: {
            type: 'string',
            description: 'The message text to send',
          },
          thread_name: {
            type: 'string',
            description: 'Optional thread name to reply in a specific thread',
          },
        },
        required: ['chat_id', 'text'],
      },
    },
  ],
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'reply') {
    const { chat_id, text, thread_name } = req.params.arguments as {
      chat_id: string;
      text: string;
      thread_name?: string;
    };

    try {
      const client = await getChatClient();
      
      const messageBody: any = {
        text,
      };

      // Reply in thread if thread_name is provided
      if (thread_name) {
        messageBody.thread = {
          name: thread_name,
        };
        messageBody.messageReplyOption = 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD';
      }

      await client.spaces.messages.create({
        parent: chat_id,
        requestBody: messageBody,
      });

      console.error(`[GChat] Sent reply to ${chat_id}: ${text.substring(0, 100)}...`);
      return { content: [{ type: 'text', text: 'Message sent successfully' }] };
    } catch (error) {
      console.error('[GChat] Error sending reply:', error);
      return {
        content: [{ type: 'text', text: `Failed to send message: ${error}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${req.params.name}`);
});

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Connect to Claude Code via stdio
  await mcpServer.connect(new StdioServerTransport());
  console.error('[GChat] MCP server connected to Claude Code');

  // Start HTTP server for Google Chat webhooks
  const httpServer = createServer(app);
  httpServer.listen(PORT, HOST, () => {
    console.error(`[GChat] HTTP server listening on ${HOST}:${PORT}`);
    console.error(`[GChat] Configure Google Chat webhook URL to: https://your-domain.com/gchat`);
    console.error(`[GChat] Health check: http://${HOST}:${PORT}/health`);
  });
}

main().catch((error) => {
  console.error('[GChat] Fatal error:', error);
  process.exit(1);
});
