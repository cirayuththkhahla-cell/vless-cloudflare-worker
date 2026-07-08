/**
 * WebSocket Handler for VLESS Protocol
 * Manages WebSocket connections and proxies traffic
 */

import { parseVLESS, createVLESSResponse, validateUUID } from './vless';
import { forwardTraffic } from './proxy';
import type { Env } from './index';

/**
 * Handles WebSocket upgrade and connection
 * @param request - Incoming request
 * @param env - Environment variables
 * @returns Response with WebSocket
 */
export async function handleWebSocket(
  request: Request,
  env: Env
): Promise<Response> {
  // Validate WebSocket upgrade
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected WebSocket', { status: 400 });
  }

  // Create WebSocket pair
  const { 0: clientSocket, 1: serverSocket } = new WebSocketPair();

  // Initialize WebSocket handler
  serverSocket.accept();

  // Handle incoming messages
  serverSocket.addEventListener('message', async (event: MessageEvent) => {
    try {
      const data = await event.data.arrayBuffer();
      const buffer = new Uint8Array(data);

      // Parse VLESS packet
      const packet = parseVLESS(buffer);

      if (!packet) {
        console.error('Failed to parse VLESS packet');
        serverSocket.close(1002, 'Invalid VLESS packet');
        return;
      }

      // Validate UUID against environment
      if (packet.uuid !== env.VLESS_UUID) {
        console.warn(`UUID mismatch: ${packet.uuid}`);
        serverSocket.close(1008, 'Invalid UUID');
        return;
      }

      // Log connection info
      console.log(
        `[VLESS] ${packet.address}:${packet.port} (Type: ${packet.addressType})`
      );

      // Send VLESS response
      const response = createVLESSResponse();
      serverSocket.send(response);

      // Forward traffic to destination
      await forwardTraffic(
        serverSocket,
        packet.address,
        packet.port,
        packet.data
      );
    } catch (error) {
      console.error('WebSocket message error:', error);
      serverSocket.close(1011, 'Internal error');
    }
  });

  // Handle WebSocket close
  serverSocket.addEventListener('close', () => {
    console.log('[VLESS] Connection closed');
  });

  // Handle WebSocket errors
  serverSocket.addEventListener('error', (error: Event) => {
    console.error('[VLESS] WebSocket error:', error);
  });

  return new Response(null, {
    status: 101,
    webSocket: clientSocket,
  });
}

/**
 * Creates a WebSocket pair for bidirectional communication
 * Type definition for WebSocketPair
 */
declare global {
  interface Response {
    webSocket?: WebSocket;
  }

  class WebSocketPair {
    constructor();
    0: WebSocket;
    1: WebSocket;
  }
}
