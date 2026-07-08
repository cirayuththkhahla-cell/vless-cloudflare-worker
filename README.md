# VLESS Protocol Implementation for Cloudflare Workers

A WebSocket-based VLESS protocol proxy implementation for Cloudflare Workers with UUID validation and traffic forwarding.

## Features

- ✅ Full VLESS protocol support (v0)
- ✅ WebSocket connection handling
- ✅ UUID validation and authentication
- ✅ Support for multiple address types (IPv4, IPv6, Domain)
- ✅ Traffic forwarding and relay
- ✅ TypeScript support
- ✅ Error handling and logging

## Project Structure

```
src/
├── index.ts        # Main Worker entry point with routing
├── vless.ts        # VLESS protocol parsing and validation
├── websocket.ts    # WebSocket handler and connection management
└── proxy.ts        # Traffic forwarding logic

wrangler.toml       # Cloudflare Workers configuration
package.json        # Dependencies and scripts
tsconfig.json       # TypeScript configuration
```

## Installation

```bash
npm install
```

## Configuration

### 1. Set your VLESS UUID

Generate a UUID v4 (or use an existing one):

```bash
wrangler secret put VLESS_UUID
# Enter your UUID when prompted, e.g.: 550e8400-e29b-41d4-a716-446655440000
```

### 2. Update wrangler.toml

Modify the configuration for your domain:

```toml
[[routes]]
pattern = "yourdomain.com/*"
zone_name = "yourdomain.com"
```

## Building

```bash
npm run build
```

## Development

Run the local development server:

```bash
npm run dev
```

The Worker will be available at `http://localhost:8787`

## Deployment

Deploy to Cloudflare:

```bash
npm run deploy
```

## VLESS Protocol Details

### Packet Structure

**Client Handshake:**
```
Version (1 byte) | UUID (16 bytes) | Addons Length (1 byte) | Addons (variable) | 
Command (1 byte) | Address Type (1 byte) | Address (variable) | Port (2 bytes) | 
Data (variable)
```

**Version:** 0x00

**UUID:** 16-byte UUID (must match VLESS_UUID)

**Command:**
- 0x01: TCP
- 0x02: UDP
- 0x03: MUX

**Address Type:**
- 0x01: IPv4 (4 bytes)
- 0x02: Domain (1 byte length + domain)
- 0x03: IPv6 (16 bytes)

## Usage Example

Connect to the Worker using a VLESS client:

```
vless://550e8400-e29b-41d4-a716-446655440000@yourdomain.com:443?security=tls&type=ws&path=/
```

## How It Works

1. **Client connects** via WebSocket
2. **VLESS handshake** is parsed and validated
3. **UUID is verified** against `VLESS_UUID`
4. **Server responds** with VLESS response packet
5. **Traffic is forwarded** between client and destination
6. **Connection is maintained** until either side closes

## Security Considerations

- ✅ UUID-based authentication
- ✅ TLS encryption (use `security=tls` in VLESS URI)
- ✅ WebSocket secure (WSS) recommended for production
- ⚠️ Store VLESS_UUID in secrets, not in code
- ⚠️ Use strong UUIDs, regenerate periodically

## Limitations

- Cloudflare Workers does not support raw TCP connections
- UDP is emulated through WebSocket relay
- Some address types may have limitations based on Cloudflare's network

## Testing

### Test with curl (WebSocket)

```bash
# Note: Most WebSocket clients are needed for proper VLESS testing
# Use xray, v2ray, or other VLESS clients for full testing
```

### View logs

```bash
wrangler tail
```

## Troubleshooting

### UUID validation fails
- Ensure VLESS_UUID is correctly set as a secret
- Verify the client is sending the correct UUID
- Check UUID format (must be valid UUID v4)

### Connection closes immediately
- Check WebSocket headers are correct
- Verify TLS configuration if using WSS
- Review Worker logs: `wrangler tail`

### Traffic not forwarding
- Confirm destination is reachable
- Check address type matches destination format
- Verify port is correct and accessible

## License

MIT

## References

- [VLESS Protocol Specification](https://github.com/xtls/xray-core/releases)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
