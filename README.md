# TON Beast NFT & Jetton Platform

A Next.js application for minting, transferring NFTs and managing RISE jetton tokens on the TON blockchain testnet.

## 🚀 Features

- **Random Beast NFT Generation**: AI-powered procedural beast creation with unique traits
- **NFT Minting**: Automated minting to GetGems marketplace
- **NFT Transfers**: Send NFTs between wallets
- **RISE Jetton Transfers**: Send RISE tokens between wallets
- **Database Integration**: Supabase for tracking minted beasts
- **IPFS Storage**: Pinata for decentralized image storage

## 📋 API Endpoints

### 1. `/api/mint` - Mint Random Beast NFTs
Generates and mints procedurally created beast NFTs with random attributes.

**Features:**
- Random beast generation (Dragons, Phoenix, Griffin, etc.)
- Random colors, elements, and tiers
- Dynamic stat generation based on rarity
- IPFS image storage
- GetGems marketplace integration
- Database storage for tracking

**Example Response:**
```json
{
  "success": true,
  "requestId": "1703123456789",
  "name": "Crimson Dragon",
  "description": "A legendary fire beast with incredible power",
  "traits": [
    {"trait_type": "Attack", "value": "150"},
    {"trait_type": "Defense", "value": "120"},
    {"trait_type": "Speed", "value": "90"},
    {"trait_type": "Element", "value": "Fire"},
    {"trait_type": "Tier", "value": "Legendary"}
  ],
  "imageIpfsUri": "ipfs://bafkreig4o5g43aeyg7gf3sjiymx6f7z7doh6z4j53stwhbqh3egjlifdpa",
  "mintResponse": {
    "success": true,
    "response": {
      "status": "in_queue",
      "address": "EQAiSecR8RXTt0-cPb5JrLD-BLVYxKd48A9ySHksrqAUXoVJ",
      "url": "https://testnet.getgems.io/collection/..."
    }
  }
}
```

### 2. `/api/send` - Transfer NFTs
Transfer NFTs between TON wallets using TIP-004 standard.

**Request:**
```bash
# Local
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"nftAddress":"kQARsscn0oab2vMkhZpg8xDZXTOUfwMWXPKeflBWylacwRAY","toAddress":"0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA"}'

# Production
curl -X POST https://your-app.vercel.app/api/send \
  -H "Content-Type: application/json" \
  -d '{"nftAddress":"kQARsscn0oab2vMkhZpg8xDZXTOUfwMWXPKeflBWylacwRAY","toAddress":"0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA"}'
```

**Response:**
```json
{
  "success": true,
  "message": "NFT transfer submitted!",
  "fromWallet": "EQD77r9HUu7VXdz-l_pgzfDgJWdHKNgk45oza4QZ7Z1CykNY",
  "toAddress": "0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA",
  "nftAddress": "kQARsscn0oab2vMkhZpg8xDZXTOUfwMWXPKeflBWylacwRAY",
  "seqno": 6
}
```

### 3. `/api/send/rise` - Transfer RISE Jettons
Send RISE jetton tokens between wallets using TIP-003 standard.

**Request:**
```bash
# Local
curl -X POST http://localhost:3000/api/send/rise \
  -H "Content-Type: application/json" \
  -d '{"userWallet":"0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA","amount":1}'

# Production
curl -X POST https://your-app.vercel.app/api/send/rise \
  -H "Content-Type: application/json" \
  -d '{"userWallet":"0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA","amount":1}'
```

**Response:**
```json
{
  "success": true,
  "message": "RISE jetton sent!",
  "fromWallet": "EQD77r9HUu7VXdz-l_pgzfDgJWdHKNgk45oza4QZ7Z1CykNY",
  "toWallet": "0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA",
  "jettonAmount": "1000000000",
  "seqno": 5
}
```

### 4. `/api/mint/status/[statusid]` - Check Mint Status
Check the minting status of an NFT using the request ID.

**Request:**
```bash
# Local
curl http://localhost:3000/api/mint/status/1703123456789

# Production
curl https://your-app.vercel.app/api/mint/status/1703123456789
```

## 🛠 Technology Stack

- **Framework**: Next.js 14 with App Router
- **Blockchain**: TON (The Open Network) Testnet
- **Wallet**: WalletContractV4 with mnemonic-based key derivation
- **AI Generation**: Replicate API (Flux model)
- **IPFS Storage**: Pinata
- **Database**: Supabase
- **NFT Marketplace**: GetGems
- **SDK**: @ton/ton, @ton/crypto

## 🔧 Environment Variables

```env
# AI Image Generation
REPLICATE_API_TOKEN=your_replicate_token

# IPFS Storage
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret

# GetGems Integration
GETGEMS_AUTHORIZATION=your_getgems_token
GETGEMS_COLLECTION=your_collection_address
GETGEMS_BASE=https://api.testnet.getgems.io/public-api

# TON Blockchain
OWNER_MNEMONIC="your 12 word mnemonic phrase"
OWNER_ADDRESS=your_wallet_address
TONCENTER_API_KEY=your_toncenter_key

# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## 📊 Database Schema

```sql
CREATE TABLE beasts (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_ipfs_uri TEXT NOT NULL,
  nft_address VARCHAR(255),
  owner_address VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'in_queue',
  nft_index BIGINT,
  getgems_url TEXT,
  traits JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🎮 Beast Generation System

The platform generates random beasts with:

- **Types**: Dragon, Phoenix, Griffin, Hydra, Wyvern, Basilisk, Chimera, Manticore
- **Colors**: Crimson, Azure, Golden, Emerald, Shadow, Crystal, Flame, Frost
- **Elements**: Fire, Ice, Lightning, Earth, Wind, Dark, Light, Poison
- **Tiers**: Common, Rare, Epic, Legendary, Mythic
- **Stats**: Attack, Defense, Speed (scaled by tier)

## 🚀 Getting Started

1. **Install Dependencies**
```bash
npm install
```

2. **Set Environment Variables**
Create `.env.local` with required variables

3. **Run Development Server**
```bash
npm run dev
```

4. **Access APIs**

**Local Development:**
- Mint: `POST http://localhost:3000/api/mint`
- Transfer NFT: `POST http://localhost:3000/api/send`
- Transfer RISE: `POST http://localhost:3000/api/send/rise`
- Check Status: `GET http://localhost:3000/api/mint/status/[id]`

**Production (Vercel):**
- Mint: `POST https://your-app.vercel.app/api/mint`
- Transfer NFT: `POST https://your-app.vercel.app/api/send`
- Transfer RISE: `POST https://your-app.vercel.app/api/send/rise`
- Check Status: `GET https://your-app.vercel.app/api/mint/status/[id]`

## 📝 Recent Transactions

### Successful RISE Jetton Transfer
- **Amount**: 1 RISE token (1,000,000,000 nano-RISE)
- **From**: EQD77r9HUu7VXdz-l_pgzfDgJWdHKNgk45oza4QZ7Z1CykNY
- **To**: 0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA
- **Status**: ✅ Success (Seqno: 5)

### Successful NFT Transfer
- **NFT**: kQARsscn0oab2vMkhZpg8xDZXTOUfwMWXPKeflBWylacwRAY
- **From**: EQD77r9HUu7VXdz-l_pgzfDgJWdHKNgk45oza4QZ7Z1CykNY
- **To**: 0QBZLTG194NM_tKRI7C_D5fJomCGS7zgjJKe051uomBmn7BA
- **Status**: ✅ Success (Seqno: 6)

## 🔗 Contract Addresses

- **Jetton Master**: kQCAaM-DjdE5lT9aGQVMczU5V-0V61JfZE1sYefOu21bBBKZ
- **Jetton Wallet**: kQDt1cugwBboev3AnobpMQOmuOLGj05e4_5NbUSMfq1sefoi
- **Main Wallet**: EQD77r9HUu7VXdz-l_pgzfDgJWdHKNgk45oza4QZ7Z1CykNY

## 📄 License

MIT License - Feel free to use this project for learning and development purposes.