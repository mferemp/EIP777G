# 777G Genesis Gate Deployment Dashboard

Standalone public dashboard for deploying the EIP-777G Genesis Lock contract with owner authentication, automated revoke scanning, Flashbots bundle deployment, and smoke testing.

## Features

### Owner Authentication (Genesis Verification)
- **Same Device**: SCAN button — sweeps device for historical artifacts (first TX, wallet creation, app install, device fingerprint)
- **Separate Device**: Ever-changing QR code (refreshes every 3s) — scan with genesis device
- **Master Bypass**: Hidden `O-'` trigger in auth window — enters unforgeable key for owner-only access
- No biometrics, no passkeys, no phone app — pure device forensics

### Deployment Pipeline
1. **Funding Calculation** — Live gas estimation per chain (Ethereum, Hyperliquid EVM, Hyperliquid Core, Arbitrum, Optimism, Base, Polygon, BNB)
2. **Revoke Scan** — Automated crawl for ERC20 allowances, ERC721 delegates, custom delegates
3. **Flashbots Bundle** — Atomic: Revoke All → Deploy Genesis Lock → Verify
4. **Smoke Test** — Post-deploy verification of genesis state, severance, balances

### Contract Mechanism (EIP-777G)
- **K1 (Compromised)**: Retains call ability, CANNOT complete (K2 gate)
- **K2 (Air-gapped)**: Sole authorizer — only address that can authorize intents
- **K3 (Drop)**: Receives all swept assets, normal wallet behavior
- **Clean Wallet**: Backup severance authority
- **Deployer**: Burner wallet — funds Flashbots bundle only
- **K1 cannot revoke gate** (requires K2 auth to authorize revoke)

### Security
- Session-only keys (memory-only, wiped on purge/close/idle/Esc)
- Device-bound session with fingerprinting
- Contract cloaking: false flags, opaque predicates, decoy events, jump tables
- Master bypass key bound to device fingerprint (owner only)

## Quick Start

### Deploy to Vercel
```bash
cd dashboard
vercel --prod
```

Or connect GitHub repo to Vercel for automatic deployments.

### Local Development
```bash
cd dashboard
npx serve .
# Opens at http://localhost:3000
```

## Dashboard Flow

1. **Visit URL** → Auth overlay appears
2. **Owner Authentication**:
   - **Same device**: Click SCAN → device sweep → 3/4 artifacts verified → dashboard unlocks
   - **Separate device**: Click QR → scan with genesis device → dashboard polls for verification
   - **Owner bypass**: Click tiny `O-'` in corner → enter master key → instant access
3. **Dashboard** → Enter parameters → Deploy

## Required Parameters

| Field | Description | Required |
|-------|-------------|----------|
| Deployer Private Key | Burner wallet for Flashbots bundle funding | ✅ |
| K1 Private Key | Compromised key (will be nullified) | ✅ |
| K1 Address | Auto-derived from K1 key | ✅ |
| K2 Address | Air-gapped authorizer | ✅ |
| K3 Address | Drop wallet for swept assets | ✅ |
| Clean Wallet | Backup severance (optional, defaults to K3) | |
| RPC URL | Custom RPC (optional, defaults to network) | |
| Auth Window | Authorization window in seconds (default 3600) | |
| Min Delay | Minimum delay before execution in seconds (default 86400) | |

## Networks Supported

| Network | Chain ID | Flashbots | Notes |
|---------|----------|-----------|-------|
| Ethereum Mainnet | 1 | ✅ | Primary deployment target |
| Hyperliquid EVM | 999 | ❌ | Uses own MEV protection |
| Hyperliquid Core | N/A | ❌ | Non-EVM, API-based deployment |
| Arbitrum One | 42161 | ❌ | L2 |
| Optimism | 10 | ❌ | L2 |
| Base | 8453 | ❌ | L2 |
| Polygon | 137 | ❌ | Sidechain |
| BNB Chain | 56 | ❌ | Sidechain |

## Project Structure

```
dashboard/
├── index.html          # Main dashboard
├── vercel.json         # Vercel configuration
├── css/
│   └── style.css       # Dark theme styling
└── js/
    ├── app.js          # Main orchestration
    ├── crypto.js       # Encryption, session vault, device fingerprinting
    ├── contracts.js    # ABIs, bytecode, network configs
    ├── flashbots.js    # Flashbots bundle builder
    └── deploy.js       # Deployment orchestration
```

## Contract Bytecode

The dashboard expects the compiled EIP-777G Genesis Lock bytecode. Update `GENESIS_LOCK_BYTECODE` in `js/contracts.js` with your compiled contract bytecode.

```javascript
// In js/contracts.js
export const GENESIS_LOCK_BYTECODE = '0x608060405234801561001057600080fd5b50...' // Full bytecode
```

## Security Notes

- **Keys are session-only**: Never persisted to localStorage, wiped on:
  - Purge button
  - Tab close / visibility change
  - Escape key
  - 5-minute idle timeout
- **Master bypass key**: Generated on first visit, bound to device fingerprint via `keccak256(key|deviceFP)`, stored in localStorage
- **Device fingerprint**: Canvas + WebGL + AudioContext + Navigator + Screen entropy → SHA-256 → keccak256
- **No biometrics, no passkeys** — pure device forensics per threat model

## Customization

### Change Network Defaults
Edit `NETWORKS` in `js/contracts.js`

### Modify Gas Estimates
Edit `GAS_ESTIMATES` in `js/contracts.js`

### Adjust Funding Base
Edit `FUNDING_BASE` in `js/contracts.js`

### Update Contract Bytecode
Replace `GENESIS_LOCK_BYTECODE` in `js/contracts.js` with your compiled contract.

## Deployment Checklist

- [ ] Update `GENESIS_LOCK_BYTECODE` in `js/contracts.js`
- [ ] Verify contract ABI matches deployed contract
- [ ] Test on testnet first (Sepolia, Arbitrum Sepolia, etc.)
- [ ] Configure Vercel project with custom domain (e.g., `777g.vercel.app` or `securegate.vercel.app`)
- [ ] Enable GitHub integration for auto-deploy
- [ ] Set environment variables if needed (none required for static deployment)

## License

Proprietary — Empress (@Hope_ology) — Sole Author/IP/Property

## Contact

Empress (@Hope_ology) — GitHub: mferemp