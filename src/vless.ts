/**
 * VLESS Protocol Implementation (v1 - Official)
 * Handles VLESS protocol parsing and UUID validation
 * Based on official Xray-core VLESS specification
 */

/**
 * VLESS protocol packet structure (v1)
 */
export interface VLESSPacket {
  version: number;
  uuid: string;
  addons: Uint8Array;
  command: number;
  port: number;
  addressType: number;
  address: string;
  data: Uint8Array;
}

/**
 * Address types in VLESS v1
 */
export enum AddressType {
  IPv4 = 0x01,
  Domain = 0x03,
  IPv6 = 0x04,
}

/**
 * Commands in VLESS protocol
 */
export enum Command {
  TCP = 0x01,
  UDP = 0x02,
  Mux = 0x03,
}

/**
 * Validates UUID format (RFC 4122)
 * @param uuid - UUID string to validate
 * @returns boolean - true if valid
 */
export function validateUUID(uuid: string): boolean {
  // RFC 4122 UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Parses VLESS protocol handshake (v1)
 * Format:
 * Version (1) | UUID (16) | Addon Length (1) | Addons (var) |
 * Command (1) | Port (2) | Address Type (1) | Address (var) | Data (var)
 *
 * @param data - Raw buffer data from client
 * @returns VLESSPacket or null if invalid
 */
export function parseVLESS(data: Uint8Array): VLESSPacket | null {
  try {
    if (data.length < 24) {
      console.warn('[VLESS] Packet too short, minimum 24 bytes required');
      return null;
    }

    let offset = 0;

    // Version (1 byte) - should be 0x01 for official version
    const version = data[offset];
    offset += 1;

    if (version !== 0x01) {
      console.warn(`[VLESS] Unsupported version: 0x${version.toString(16)}`);
      return null;
    }

    // UUID (16 bytes)
    const uuidBytes = data.slice(offset, offset + 16);
    const uuid = bytesToUUID(uuidBytes);
    offset += 16;

    if (!validateUUID(uuid)) {
      console.warn(`[VLESS] Invalid UUID format: ${uuid}`);
      return null;
    }

    // Addons Length (1 byte)
    const addonsLength = data[offset];
    offset += 1;

    // Addons (variable, ProtoBuf encoded)
    const addons = data.slice(offset, offset + addonsLength);
    offset += addonsLength;

    // Command (1 byte)
    const command = data[offset];
    offset += 1;

    if (![Command.TCP, Command.UDP, Command.Mux].includes(command)) {
      console.warn(`[VLESS] Unknown command: 0x${command.toString(16)}`);
      return null;
    }

    // Port (2 bytes, big-endian)
    const port = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    if (port < 1 || port > 65535) {
      console.warn(`[VLESS] Invalid port: ${port}`);
      return null;
    }

    // Address Type (1 byte)
    const addressType = data[offset];
    offset += 1;

    let address = '';
    let addressLength = 0;

    // Parse address based on type
    switch (addressType) {
      case AddressType.IPv4: // IPv4
        addressLength = 4;
        if (offset + addressLength > data.length) {
          console.warn('[VLESS] Incomplete IPv4 address');
          return null;
        }
        address = Array.from(data.slice(offset, offset + 4))
          .join('.');
        offset += 4;
        break;

      case AddressType.Domain: // Domain (v1 changed from 2 to 3)
        addressLength = data[offset];
        offset += 1;
        if (offset + addressLength > data.length) {
          console.warn('[VLESS] Incomplete domain address');
          return null;
        }
        address = new TextDecoder().decode(
          data.slice(offset, offset + addressLength)
        );
        offset += addressLength;
        break;

      case AddressType.IPv6: // IPv6 (v1 changed from 3 to 4)
        addressLength = 16;
        if (offset + addressLength > data.length) {
          console.warn('[VLESS] Incomplete IPv6 address');
          return null;
        }
        address = ipv6ToString(data.slice(offset, offset + 16));
        offset += 16;
        break;

      default:
        console.warn(`[VLESS] Unknown address type: 0x${addressType.toString(16)}`);
        return null;
    }

    // Remaining data
    const remainingData = data.slice(offset);

    const packet: VLESSPacket = {
      version,
      uuid,
      addons,
      command,
      port,
      addressType,
      address,
      data: remainingData,
    };

    console.log(
      `[VLESS] Parsed: ${getCommandName(command)} to ${address}:${port}`
    );

    return packet;
  } catch (error) {
    console.error('[VLESS] Error parsing packet:', error);
    return null;
  }
}

/**
 * Converts 16-byte array to UUID string (RFC 4122)
 * @param bytes - UUID bytes
 * @returns UUID string
 */
function bytesToUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * Converts IPv6 bytes to string
 * @param bytes - IPv6 bytes (16 bytes)
 * @returns IPv6 address string
 */
function ipv6ToString(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    const val = (bytes[i] << 8) | bytes[i + 1];
    parts.push(val.toString(16));
  }
  // Simple compression: replace consecutive zeros with ::
  return parts.join(':')
    .replace(/(:0)+:/, '::')
    .replace(/^0:/, ':')
    .replace(/:0$/, ':');
}

/**
 * Creates VLESS v1 response packet
 * Format: Version (1) | Addon Length (1) | Addons (var)
 * @returns VLESS response bytes
 */
export function createVLESSResponse(): Uint8Array {
  // Minimal response: version 0x01 + no addons (length 0)
  const response = new Uint8Array(2);
  response[0] = 0x01; // Version 1
  response[1] = 0x00; // No addons
  return response;
}

/**
 * Converts command byte to human-readable name
 * @param command - Command byte
 * @returns Command name
 */
function getCommandName(command: number): string {
  switch (command) {
    case Command.TCP:
      return 'TCP';
    case Command.UDP:
      return 'UDP';
    case Command.Mux:
      return 'Mux';
    default:
      return `Unknown(0x${command.toString(16)})`;
  }
}

/**
 * Decodes ProtoBuf addon data (basic implementation)
 * @param addonData - Raw addon bytes
 * @returns Decoded addon object
 */
export function decodeAddons(addonData: Uint8Array): Record<string, any> {
  // Basic ProtoBuf decoding
  // Most common extension: Flow (field 0x00) for XTLS Vision
  const addons: Record<string, any> = {};

  let offset = 0;
  while (offset < addonData.length) {
    const byte = addonData[offset];
    offset += 1;

    // ProtoBuf varint decoding
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;

    switch (fieldNumber) {
      case 0: // Flow field
        if (wireType === 2) {
          // Length-delimited (string/bytes)
          const length = addonData[offset];
          offset += 1;
          addons['flow'] = new TextDecoder().decode(
            addonData.slice(offset, offset + length)
          );
          offset += length;
        }
        break;
      default:
        // Skip unknown fields
        if (wireType === 0) {
          // varint
          while (addonData[offset] & 0x80) offset += 1;
          offset += 1;
        } else if (wireType === 2) {
          // length-delimited
          offset += 1 + addonData[offset];
        }
    }
  }

  return addons;
}
