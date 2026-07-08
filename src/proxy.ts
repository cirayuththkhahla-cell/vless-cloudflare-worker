/**
 * Proxy Logic for Traffic Forwarding
 * Forwards traffic from WebSocket to destination servers
 */

/**
 * Forwards traffic from WebSocket to destination
 * @param wsSocket - WebSocket connection from client
 * @param address - Destination address
 * @param port - Destination port
 * @param initialData - Initial data to send
 */
export async function forwardTraffic(
  wsSocket: WebSocket,
  address: string,
  port: number,
  initialData: Uint8Array
): Promise<void> {
  try {
    // Construct the destination URL
    const protocol = port === 443 ? 'wss' : 'ws';
    const destinationUrl = `${protocol}://${address}:${port}/`;

    console.log(`[Proxy] Connecting to ${address}:${port}`);

    // Create connection to destination
    const destSocket = new WebSocket(destinationUrl);

    // Handle destination socket open
    destSocket.addEventListener('open', () => {
      console.log(`[Proxy] Connected to ${address}:${port}`);

      // Send initial data if present
      if (initialData && initialData.length > 0) {
        destSocket.send(initialData);
      }
    });

    // Handle messages from destination
    destSocket.addEventListener('message', (event: MessageEvent) => {
      try {
        wsSocket.send(event.data);
      } catch (error) {
        console.error('[Proxy] Error sending to client:', error);
      }
    });

    // Handle destination socket close
    destSocket.addEventListener('close', () => {
      console.log(`[Proxy] Destination closed for ${address}:${port}`);
      wsSocket.close(1000, 'Destination closed');
    });

    // Handle destination socket error
    destSocket.addEventListener('error', (error: Event) => {
      console.error(`[Proxy] Destination error: ${error}`);
      wsSocket.close(1011, 'Destination error');
    });

    // Handle messages from client WebSocket
    wsSocket.addEventListener('message', (event: MessageEvent) => {
      try {
        if (destSocket.readyState === WebSocket.OPEN) {
          destSocket.send(event.data);
        }
      } catch (error) {
        console.error('[Proxy] Error sending to destination:', error);
      }
    });

    // Handle client WebSocket close
    wsSocket.addEventListener('close', () => {
      console.log('[Proxy] Client disconnected');
      if (destSocket.readyState === WebSocket.OPEN) {
        destSocket.close(1000, 'Client disconnected');
      }
    });
  } catch (error) {
    console.error('[Proxy] Error establishing connection:', error);
    wsSocket.close(1011, 'Proxy error');
  }
}

/**
 * Creates a TCP socket connection (fallback for non-WebSocket)
 * Note: Cloudflare Workers doesn't support raw TCP connections
 * This is a placeholder for reference
 */
export async function createTCPConnection(
  address: string,
  port: number
): Promise<any> {
  // Cloudflare Workers limitation: No direct TCP socket support
  // Use fetch API with TCP proxy or WebSocket relay instead
  console.warn(
    '[Proxy] Direct TCP not supported in Workers. Use WebSocket relay.'
  );
  return null;
}

/**
 * Sends data with proper formatting
 * @param socket - WebSocket or TCP socket
 * @param data - Data to send
 */
export function sendData(socket: any, data: Uint8Array): void {
  if (socket instanceof WebSocket) {
    socket.send(data);
  } else {
    // Handle other socket types
    console.log('[Proxy] Sending data:', data.length, 'bytes');
  }
}

/**
 * Closes connection gracefully
 * @param socket - Socket to close
 * @param code - WebSocket close code
 * @param reason - Close reason
 */
export function closeConnection(
  socket: WebSocket,
  code: number = 1000,
  reason: string = 'Normal closure'
): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.close(code, reason);
  }
}
