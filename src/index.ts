/**
 * VLESS Protocol Implementation for Cloudflare Workers
 * Supports WebSocket connections with UUID validation and proxy forwarding
 */

import { Router } from 'itty-router';
import { handleWebSocket } from './websocket';

const router = Router();

/**
 * Main request handler
 */
router.get('/', async (request: Request) => {
  return new Response('VLESS Worker - WebSocket proxy service', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
});

router.all('*', async (request: Request, env: Env) => {
  try {
    // Check for WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }

    // Handle other HTTP requests
    return new Response('VLESS Worker - Use WebSocket to connect', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

/**
 * Environment interface
 */
export interface Env {
  VLESS_UUID: string;
  FALLBACK_URL?: string;
}

export default {
  fetch: (request: Request, env: Env) => router.handle(request, env),
};
