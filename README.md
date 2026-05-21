# INC Network — Proof of Signal

**Publique sinais de trading com stake real. Followers apostam junto. A Chainlink resolve automaticamente.**

Site: https://freire007-byte.github.io/INC-Network/

---

## O que é

INC Network é um protocolo descentralizado onde traders publicam sinais on-chain com stake real. Seguidores podem apostar junto ao sinal. Quando o sinal vence ou perde, a Chainlink Price Feed resolve automaticamente e os lucros são distribuídos. Sem intermediários, sem custódia centralizada.

---

## Funcionalidades

- **Oracle ao vivo** — preços BTC, ETH, SOL e BNB via Binance API em tempo real
- **Sinais on-chain** — criação e acompanhamento de sinais com stake em ETH
- **Whale Tracker** — mapa de posições de grandes traders com animação de bolhas
- **Liquidações ao vivo** — feed de liquidações da Binance Futures via WebSocket
- **Token $INC** — ERC-20 com supply fixo de 1 bilhão de tokens
- **Multi-chain** — suporte a Ethereum, Arbitrum, Polygon, BNB Chain, Optimism e Avalanche

---

## Contratos Deployados

| Rede | Contrato | Explorer |
|------|----------|----------|
| Sepolia (testnet) | `0x3aF7127ca9Fa313D4AB7FAcdf7062F0FA5574993` | [Etherscan](https://sepolia.etherscan.io/address/0x3aF7127ca9Fa313D4AB7FAcdf7062F0FA5574993) |
| Token $INC (Sepolia) | `0xeAa4FAF815e36caaa082C71aC8ca962F531443d7` | [Etherscan](https://sepolia.etherscan.io/token/0xeAa4FAF815e36caaa082C71aC8ca962F531443d7) |

---

## Tokenomics — $INC

Supply total fixo: **1.000.000.000 INC**

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
- **Deploy:** GitHub Pages (`gh-pages` branch)

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
| Sepolia Testnet | 11155111 | Ativo |
| Ethereum Mainnet | 1 | Planejado |
| Arbitrum One | 42161 | Planejado |
| Polygon | 137 | Planejado |
| BNB Chain | 56 | Planejado |
| Optimism | 10 | Planejado |
| Avalanche | 43114 | Planejado |

---

## Redes Sociais

- Twitter/X: [@inc_network_](https://x.com/inc_network_)
- Instagram: [@inc_network_](https://instagram.com/inc_network_)

---

## Licença

MIT
