# INC Network — Proof of Signal

**Publique sinais de trading com stake real. Followers apostam junto. O protocolo resolve automaticamente via Chainlink Price Feeds.**

Site: **https://incnetwork.online**

---

## O que é

INC Network é um protocolo descentralizado onde traders publicam sinais on-chain com stake real em MATIC/ETH/AVAX. Seguidores podem apostar junto ao sinal. Quando o sinal vence ou perde, o Chainlink Price Feed resolve automaticamente e os lucros são distribuídos. Sem intermediários, sem custódia centralizada.

---

## Funcionalidades

- **Oracle ao vivo** — preços BTC, ETH, SOL e BNB via Binance API em tempo real
- **Sinais on-chain** — criação e acompanhamento de sinais com stake real (MATIC/ETH/AVAX)
- **INC Wallet** — carteira built-in no browser, PBKDF2+AES-GCM, sem extensão necessária
- **Entrada ultra-rápida** — LONG/SHORT com 1 clique na carteira → formulário já preenchido → só escolhe o valor
- **Token $INC** — ERC-20 com supply fixo de 100 milhões, Participation Lock
- **Faucet** — 100 INC grátis por carteira nova criada
- **Whale Tracker** — mapa de posições de grandes traders com animação de bolhas
- **Liquidações ao vivo** — feed de liquidações da Binance Futures via WebSocket
- **Multi-chain** — Polygon, Arbitrum, Avalanche, Sepolia

---

## Contratos Deployados

### INCNetwork (Protocolo Principal)

| Rede | Contrato | Explorer |
|------|----------|----------|
| Polygon | `0xf49841DF7726691D04D311BC4A0821C0AB9211f5` | [Polygonscan](https://polygonscan.com/address/0xf49841DF7726691D04D311BC4A0821C0AB9211f5) |
| Arbitrum One | `0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745` | [Arbiscan](https://arbiscan.io/address/0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745) |
| Avalanche C-Chain | `0x55413bF29C5b2c7EE54333fD09382f13Ca081593` | [Snowscan](https://snowscan.xyz/address/0x55413bF29C5b2c7EE54333fD09382f13Ca081593) |
| Sepolia (testnet) | `0x99ABa0D947367ABC96dDc612C6e407954aC46836` | [Etherscan](https://sepolia.etherscan.io/address/0x99ABa0D947367ABC96dDc612C6e407954aC46836) |

### Token $INC (ERC-20)

| Rede | Contrato | Explorer |
|------|----------|----------|
| Polygon | `0x4EC0c1c9C708A51712fD6cCaFd107299bBe30a51` | [Polygonscan](https://polygonscan.com/token/0x4EC0c1c9C708A51712fD6cCaFd107299bBe30a51) |
| Arbitrum One | `0xEaa8383593972b621Cb4Ed7E049db167e5fCC1C3` | [Arbiscan](https://arbiscan.io/token/0xEaa8383593972b621Cb4Ed7E049db167e5fCC1C3) |
| Avalanche C-Chain | `0x672CA0c46ED2E00a1bb8E57Cb1F6b3d74d7BAf54` | [Snowscan](https://snowscan.xyz/token/0x672CA0c46ED2E00a1bb8E57Cb1F6b3d74d7BAf54) |
| Sepolia (testnet) | `0x4249152E9c372B3968fEDCE1A05D093456CbFEC8` | [Etherscan](https://sepolia.etherscan.io/token/0x4249152E9c372B3968fEDCE1A05D093456CbFEC8) |

> **Wire-contracts executado:** INCToken.incNetworkContract ↔ INCNetwork nas redes Polygon, Arbitrum e Avalanche.

---

## Tokenomics — $INC

> Supply total fixo e imutável: **100.000.000 INC (100 milhões)**

| Alocação | % | Função |
|----------|---|--------|
| Ecosystem / Rewards | 40% | Recompensas do protocolo |
| Team | 20% | Equipe (vesting off-chain) |
| Liquidity | 20% | DEX liquidity pools |
| Treasury | 10% | Tesouraria do protocolo |
| IDO / Venda pública | 10% | Venda inicial |

Taxa do protocolo: **3,5%** sobre posições lucrativas.

**Participation Lock:** tokens recebidos por endereços comuns só podem ser transferidos após o endereço interagir com o protocolo (criar ou seguir pelo menos 1 sinal).

---

## Infraestrutura

### Servidor (VPS)
- **IP:** 153.75.224.178
- **Domínio:** incnetwork.online
- **Stack:** nginx + PM2 + Node.js
- **DDoS Protection:** nginx rate limiting (30 req/min global, 5 req/min faucet) + fail2ban (3 jails)
- **HTTPS:** SSL via Let's Encrypt

### Serviços em Produção (PM2)
| Serviço | Descrição |
|---------|-----------|
| `inc-faucet` | API Express.js — envia 100 INC por carteira nova (porta 3001, proxied via nginx) |
| `inc-upkeep-bot` | Bot de automação — substitui Chainlink Automation, verifica todas as redes a cada 60s |

### Upkeep Bot
O bot roda 24/7 no VPS e substitui o Chainlink Automation (sem custo de LINK):
- Chama `checkUpkeep()` em cada rede a cada 60 segundos
- Se `upkeepNeeded = true`, executa `performUpkeep()` automaticamente
- Estima gas com margem de 30%
- Paga apenas gas da transação

---

## Stack Técnica

- **Smart Contracts:** Solidity 0.8.20 · Hardhat · OpenZeppelin v5 · Chainlink Price Feeds
- **Testes:** 169+ testes (Hardhat + Chai)
- **Automação:** Upkeep Bot customizado (ethers.js v6) · PM2
- **Frontend:** HTML/CSS/JS vanilla · ethers.js v5.7.2 · Service Worker (PWA)
- **Servidor:** Express.js · nginx · fail2ban
- **Carteira:** PBKDF2+AES-GCM (browser localStorage), sem extensão

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Compilar contratos
npx hardhat compile

# Rodar testes (169 passando)
npx hardhat test

# Subir frontend local (porta 8765)
cd frontend
python -m http.server 8765
```

### Variáveis de ambiente (.env)

```
PRIVATE_KEY=sua_chave_privada
TREASURY_PRIVATE_KEY=chave_tesouraria
INC_CONTRACT_POLYGON=0xf49841DF7726691D04D311BC4A0821C0AB9211f5
INC_CONTRACT_ARBITRUM=0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745
INC_CONTRACT_AVALANCHE=0x55413bF29C5b2c7EE54333fD09382f13Ca081593
INC_CONTRACT_SEPOLIA=0x99ABa0D947367ABC96dDc612C6e407954aC46836
INC_TOKEN_POLYGON=0x4EC0c1c9C708A51712fD6cCaFd107299bBe30a51
INC_TOKEN_ARBITRUM=0xEaa8383593972b621Cb4Ed7E049db167e5fCC1C3
INC_TOKEN_AVALANCHE=0x672CA0c46ED2E00a1bb8E57Cb1F6b3d74d7BAf54
INC_TOKEN_SEPOLIA=0x4249152E9c372B3968fEDCE1A05D093456CbFEC8
POLYGONSCAN_KEY=chave_polygonscan
ARBISCAN_KEY=chave_arbiscan
SNOWTRACE_KEY=chave_snowtrace
ETHERSCAN_KEY=chave_etherscan
```

---

## Deploy dos Contratos

```bash
# Deploy do contrato principal em todas as redes
npx hardhat run scripts/deploy-all.js --network polygon
npx hardhat run scripts/deploy-all.js --network arbitrum
npx hardhat run scripts/deploy-all.js --network avalanche

# Deploy do token $INC
npx hardhat run scripts/deploy-token-all.js --network polygon

# Conectar INCToken ↔ INCNetwork
npx hardhat run scripts/wire-contracts.js --network polygon
npx hardhat run scripts/wire-contracts.js --network arbitrum
npx hardhat run scripts/wire-contracts.js --network avalanche
```

---

## Redes Suportadas

| Rede | Chain ID | Status |
|------|----------|--------|
| Polygon | 137 | ✅ Ativo |
| Arbitrum One | 42161 | ✅ Ativo |
| Avalanche C-Chain | 43114 | ✅ Ativo |
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
