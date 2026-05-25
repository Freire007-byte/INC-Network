# INC Network — Proof of Signal

**Publique sinais de trading com stake real. Followers apostam junto. A Chainlink resolve automaticamente.**

> ⚡ **Live Update:** O site está passando por atualizações em tempo real.
> Acesse sempre pela URL oficial: **https://incnetwork.vercel.app**

Site: https://incnetwork.vercel.app

---

## O que é

INC Network é um protocolo descentralizado onde traders publicam sinais on-chain com stake real. Seguidores podem apostar junto ao sinal. Quando o sinal vence ou perde, a Chainlink Price Feed resolve automaticamente e os lucros são distribuídos. Sem intermediários, sem custódia centralizada.

---

## Funcionalidades

- **Oracle ao vivo** — preços BTC, ETH, SOL e BNB via Binance API em tempo real
- **Sinais on-chain** — criação e acompanhamento de sinais com stake em ETH
- **Whale Tracker** — mapa de posições de grandes traders com animação de bolhas
- **Liquidações ao vivo** — feed de liquidações da Binance Futures via WebSocket
- **Token $INC** — ERC-20 com supply fixo de 100 milhões de tokens
- **Multi-chain** — suporte a Ethereum, Arbitrum, Polygon, BNB Chain, Optimism e Avalanche

---

## Contratos Deployados

### INCNetwork (Protocolo)

| Rede | Contrato | Explorer |
|------|----------|----------|
| Polygon | `0xf49841DF7726691D04D311BC4A0821C0AB9211f5` | [Polygonscan](https://polygonscan.com/address/0xf49841DF7726691D04D311BC4A0821C0AB9211f5) |
| Arbitrum | `0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745` | [Arbiscan](https://arbiscan.io/address/0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745) |
| Avalanche | `0x55413bF29C5b2c7EE54333fD09382f13Ca081593` | [Snowscan](https://snowscan.xyz/address/0x55413bF29C5b2c7EE54333fD09382f13Ca081593) |
| Sepolia (testnet) | `0x99ABa0D947367ABC96dDc612C6e407954aC46836` | [Etherscan](https://sepolia.etherscan.io/address/0x99ABa0D947367ABC96dDc612C6e407954aC46836) |

### Token $INC (ERC-20)

| Rede | Contrato | Explorer |
|------|----------|----------|
| Polygon | `0x4EC0c1c9C708A51712fD6cCaFd107299bBe30a51` | [Polygonscan](https://polygonscan.com/token/0x4EC0c1c9C708A51712fD6cCaFd107299bBe30a51) |
| Arbitrum | `0xEaa8383593972b621Cb4Ed7E049db167e5fCC1C3` | [Arbiscan](https://arbiscan.io/token/0xEaa8383593972b621Cb4Ed7E049db167e5fCC1C3) |
| Avalanche | `0x672CA0c46ED2E00a1bb8E57Cb1F6b3d74d7BAf54` | [Snowscan](https://snowscan.xyz/token/0x672CA0c46ED2E00a1bb8E57Cb1F6b3d74d7BAf54) |
| Sepolia (testnet) | `0x4249152E9c372B3968fEDCE1A05D093456CbFEC8` | [Etherscan](https://sepolia.etherscan.io/token/0x4249152E9c372B3968fEDCE1A05D093456CbFEC8) |

---

## Tokenomics — $INC

> ⚠️ Supply total fixo e imutável: **100.000.000 INC (100 milhões)** — não existe e nunca existirá mais que isso.

Supply total fixo: **100.000.000 INC**

| Alocação | % | Função |
|----------|---|--------|
| Ecosystem / Rewards | 40% | Recompensas do protocolo |
| Team | 20% | Equipe (vesting off-chain) |
| Liquidity | 20% | DEX liquidity pools |
| Treasury | 10% | Tesouraria do protocolo |
| IDO / Venda pública | 10% | Venda inicial |

Taxa do protocolo: **3,5%** sobre posições lucrativas.

---

## Stack Técnica

- **Smart Contracts:** Solidity 0.8.20 · Hardhat
- **Oracles:** Chainlink Price Feeds
- **Frontend:** HTML/CSS/JS vanilla · ethers.js v5.7.2
- **Deploy:** Vercel (https://incnetwork.vercel.app)

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Compilar contratos
npx hardhat compile

# Rodar testes
npx hardhat test

# Subir frontend local (porta 8765)
cd frontend
python -m http.server 8765
```

### Variáveis de ambiente (.env)

```
PRIVATE_KEY=sua_chave_privada
INC_TREASURY=endereco_tesouraria
ETHERSCAN_KEY=chave_etherscan
POLYGONSCAN_KEY=chave_polygonscan
```

---

## Deploy dos Contratos

```bash
# Deploy do contrato principal
npx hardhat run scripts/deploy-all.js --network sepolia

# Deploy do token $INC
npx hardhat run scripts/deploy-token.js --network sepolia

# Verificar no Etherscan
npx hardhat verify --network sepolia ENDERECO "TREASURY_WALLET" "DEPLOYER_WALLET"
```

---

## Redes Suportadas

| Rede | Chain ID | Status |
|------|----------|--------|
| Polygon | 137 | ✅ Ativo |
| Arbitrum One | 42161 | ✅ Ativo |
| Avalanche | 43114 | ✅ Ativo |
| Sepolia Testnet | 11155111 | ✅ Ativo |
| Ethereum Mainnet | 1 | Planejado |
| BNB Chain | 56 | Planejado |
| Optimism | 10 | Planejado |

---

## Redes Sociais

- Twitter/X: [@incnetwork_](https://x.com/incnetwork_)
- Instagram: [@inc_network_](https://instagram.com/inc_network_)

---

## Licença

MIT
