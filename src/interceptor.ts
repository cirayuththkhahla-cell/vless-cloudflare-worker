/**
 * Data Interception & Logging Module
 * Captures and logs VLESS traffic for monitoring and debugging
 */

export interface InterceptedData {
  timestamp: number;
  sessionId: string;
  direction: 'client->server' | 'server->client';
  dataSize: number;
  dataHex: string;
  source: string;
  destination: string;
  port: number;
  protocol: 'TCP' | 'UDP' | 'MUX';
  uuid: string;
}

export interface TrafficStats {
  totalPackets: number;
  totalBytes: number;
  startTime: number;
  endTime: number;
  packetLog: InterceptedData[];
}

/**
 * Session-based traffic interceptor
 */
class TrafficInterceptor {
  private sessions: Map<string, TrafficStats> = new Map();
  private maxLogSize: number = 1000; // Max packets per session

  /**
   * Creates or gets session traffic stats
   */
  getSession(sessionId: string): TrafficStats {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        totalPackets: 0,
        totalBytes: 0,
        startTime: Date.now(),
        endTime: 0,
        packetLog: [],
      });
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * Intercepts and logs data
   */
  intercept(
    sessionId: string,
    direction: 'client->server' | 'server->client',
    data: Uint8Array,
    source: string,
    destination: string,
    port: number,
    protocol: 'TCP' | 'UDP' | 'MUX',
    uuid: string
  ): InterceptedData {
    const stats = this.getSession(sessionId);
    const intercepted: InterceptedData = {
      timestamp: Date.now(),
      sessionId,
      direction,
      dataSize: data.length,
      dataHex: this.toHexString(data.slice(0, 64)), // First 64 bytes
      source,
      destination,
      port,
      protocol,
      uuid,
    };

    // Add to log (with size limit)
    if (stats.packetLog.length < this.maxLogSize) {
      stats.packetLog.push(intercepted);
    }

    // Update stats
    stats.totalPackets += 1;
    stats.totalBytes += data.length;
    stats.endTime = Date.now();

    // Log to console
    this.logPacket(intercepted);

    return intercepted;
  }

  /**
   * Converts bytes to hex string for logging
   */
  private toHexString(data: Uint8Array): string {
    return Array.from(data)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  }

  /**
   * Logs packet to console
   */
  private logPacket(data: InterceptedData): void {
    const timestamp = new Date(data.timestamp).toISOString();
    const size = `${data.dataSize}B`;
    const hex = data.dataHex.substring(0, 32) + (data.dataHex.length > 32 ? '...' : '');

    console.log(
      `[INTERCEPT] ${timestamp} | ${data.direction} | ${data.protocol} | ` +
      `${data.source} → ${data.destination}:${data.port} | ${size} | ${hex}`
    );
  }

  /**
   * Gets session statistics
   */
  getStats(sessionId: string): TrafficStats | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Exports session data as JSON
   */
  exportSession(sessionId: string): string {
    const stats = this.sessions.get(sessionId);
    if (!stats) return JSON.stringify({ error: 'Session not found' });

    return JSON.stringify({
      sessionId,
      totalPackets: stats.totalPackets,
      totalBytes: stats.totalBytes,
      duration: stats.endTime - stats.startTime,
      packets: stats.packetLog,
    }, null, 2);
  }

  /**
   * Clears session data
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Lists all active sessions
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Global interceptor instance
export const interceptor = new TrafficInterceptor();

/**
 * Packet sniffer for detailed inspection
 */
export class PacketSniffer {
  /**
   * Analyzes packet header
   */
  static analyzeHeader(data: Uint8Array): Record<string, any> {
    if (data.length < 2) {
      return { error: 'Too short' };
    }

    const analysis: Record<string, any> = {
      length: data.length,
      firstBytes: this.toHex(data.slice(0, 8)),
    };

    // Try to detect protocol
    const firstByte = data[0];
    if (firstByte === 0x01) {
      analysis.possibleProtocol = 'VLESS';
      analysis.version = '1';
    } else if (firstByte === 0x00) {
      analysis.possibleProtocol = 'VLESS (v0)';
    }

    return analysis;
  }

  /**
   * Inspects application data
   */
  static inspectData(data: Uint8Array): Record<string, any> {
    const inspection: Record<string, any> = {
      size: data.length,
      hex: this.toHex(data.slice(0, 32)),
    };

    // Try to detect text content
    try {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(0, 128));
      if (text.length > 0 && text.match(/^[\x20-\x7E\n\r\t]*$/)) {
        inspection.textContent = text.substring(0, 64);
        inspection.type = 'text';
      }
    } catch (e) {
      inspection.type = 'binary';
    }

    return inspection;
  }

  /**
   * Converts bytes to hex string
   */
  private static toHex(data: Uint8Array): string {
    return Array.from(data)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  }
}

/**
 * Real-time traffic monitor
 */
export class TrafficMonitor {
  private bandwidth: Map<string, number> = new Map();
  private interval: NodeJS.Timeout | null = null;

  /**
   * Starts monitoring bandwidth
   */
  start(intervalMs: number = 5000): void {
    this.interval = setInterval(() => {
      this.reportBandwidth();
    }, intervalMs);
  }

  /**
   * Stops monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Records data transfer
   */
  recordTransfer(sessionId: string, bytes: number): void {
    const current = this.bandwidth.get(sessionId) || 0;
    this.bandwidth.set(sessionId, current + bytes);
  }

  /**
   * Reports bandwidth usage
   */
  private reportBandwidth(): void {
    const now = new Date().toISOString();
    console.log(`[MONITOR] ${now}`);

    for (const [sessionId, bytes] of this.bandwidth.entries()) {
      const mbps = (bytes / (5 * 1024 * 1024)).toFixed(2);
      console.log(`  Session ${sessionId}: ${bytes} bytes (${mbps} MB/5s)`);
    }

    // Reset counters
    this.bandwidth.clear();
  }
}

export const trafficMonitor = new TrafficMonitor();
