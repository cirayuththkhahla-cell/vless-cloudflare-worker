/**
 * VLESS Protocol Implementation
 * Handles VLESS protocol parsing and UUID validation
 */

/**
 * VLESS protocol packet structure
 */
export interface VLESSPacket {
  version: number;
  uuid: string;
  addons: string;
  command: number;
  addressType: number;
  address: string;
  port: number;
  data: Uint8Array;
}

/**
 * Validates UUID format (v4)
 * @param uuid - UUID string to validate
 * @returns boolean - true if valid
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Parses VLESS protocol handshake
 * @param data - Raw buffer data from client
 * @returns VLESSPacket or null if invalid
 */
export function parseVLESS(data: Uint8Array): VLESSPacket | null {
  try {
    if (data.length < 24) {
      return null;
    }

    let offset = 0;

    // Version (1 byte)
    const version = data[offset];
    offset += 1;

    if (version !== 0) {
      console.warn(`Invalid VLESS version: ${version}`);
      return null;
    }

    // UUID (16 bytes)
    const uuidBytes = data.slice(offset, offset + 16);
    const uuid = bytesToUUID(uuidBytes);
    offset += 16;

    if (!validateUUID(uuid)) {
      console.warn(`Invalid UUID: ${uuid}`);
      return null;
    }

    // Addons length (1 byte)
    const addonsLength = data[offset];
    offset += 1;

    // Addons (variable length)
    const addons = new TextDecoder().decode(
      data.slice(offset, offset + addonsLength)
    );
    offset += addonsLength;

    // Command (1 byte)
    const command = data[offset];
    offset += 1;

    // Address type (1 byte)
    const addressType = data[offset];
    offset += 1;

    let address = '';
    let addressLength = 0;

    // Parse address based on type
    switch (addressType) {
      case 1: // IPv4
        addressLength = 4;
        address = Array.from(data.slice(offset, offset + 4))
          .join('.');
        offset += 4;
        break;

      case 2: // Domain
        addressLength = data[offset];
        offset += 1;
        address = new TextDecoder().decode(
          data.slice(offset, offset + addressLength)
        );
        offset += addressLength;
        break;

      case 3: // IPv6
        addressLength = 16;
        address = ipv6ToString(data.slice(offset, offset + 16));
        offset += 16;
        break;

      default:
        console.warn(`Unknown address type: ${addressType}`);
        return null;
    }

    // Port (2 bytes, big-endian)
    const port = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    // Remaining data
    const remainingData = data.slice(offset);

    return {
      version,
      uuid,
      addons,
      command,
      addressType,
      address,
      port,
      data: remainingData,
    };
  } catch (error) {
    console.error('Error parsing VLESS packet:', error);
    return null;
  }
}

/**
 * Converts 16-byte array to UUID string
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
    parts.push(
      ((bytes[i] << 8) | bytes[i + 1]).toString(16)
    );
  }
  return parts.join(':');
}

/**
 * Creates VLESS response packet
 * @returns VLESS response bytes
 */
export function createVLESSResponse(): Uint8Array {
  // Response format: version (1) + addons length (1) + addons (variable) = minimum 2 bytes
  const response = new Uint8Array(2);
  response[0] = 0; // Version
  response[1] = 0; // No addons
  return response;
}
