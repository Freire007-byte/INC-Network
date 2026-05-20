# INC Network — Litepaper v1.0

## Resumo Executivo

INC Network é um protocolo DeFi de **Proof-of-Signal**: um sistema on-chain onde traders publicam sinais de mercado com stake real como garantia de comprometimento. A resolução é automática, executada pelo Chainlink Oracle, sem intervenção humana.

---

## O Problema

Sinais de trading estão em todo lugar — Telegram, Twitter, Discord. Mas:

- **Nenhum tem skin in the game real.** Qualquer pessoa pode publicar "BTC vai subir" sem arriscar nada.
- **Sem auditoria.** Win rates são fabricados, históricos são apagados.
- **Sem resolução objetiva.** Quem decide se o sinal foi certo ou errado?

O mercado de copy trading movimenta **$5 bilhões/ano** sem nenhuma prova verificável de resultado.

---

## A Solução: Proof-of-Signal

INC Network resolve isso com três princípios:

### 1. Stake real obrigatório
O Provider coloca ETH/MATIC/AVAX em risco antes de publicar qualquer sinal. Sem stake → sem sinal.

### 2. Oracle independente
Chainlink Price Feeds valida o preço de entrada e monitora TP/SL em tempo real. Nenhuma parte humana pode adulterar o resultado.

### 3. Resolução automática
Chainlink Automation executa `performUpkeep()` quando TP ou SL é atingido. O pool inteiro vai para o lado vencedor sem pedido manual.

---

## Como Funciona

```
Provider
  └─ Publica sinal (par, direção, entrada, TP, SL)
  └─ Faz stake de ETH/MATIC/AVAX
  └─ Chainlink valida preço de entrada (tolerância 2%)

Followers (até 500)
  └─ Apostam no mesmo sinal
  └─ Pool cresce a cada novo follower

Oracle
  └─ Monitora preço a cada bloco
  └─ Quando TP atingido → WIN → Provider + Followers vencem
  └─ Quando SL atingido → LOSS → Followers vencem, Provider perde

Resolução
  └─ Vencedores sacam via claimReward()
  └─ Taxa de 3.5% vai para treasury do protocolo
```

---

## $INC Token

| Item | Valor |
|---|---|
| Supply | 100,000,000 (fixo) |
| Padrão | ERC-20 · Burnable · Pausable · Ownable2Step |
| Decimais | 18 |
| Preço inicial | $0.01 |

### Distribuição

| Alocação | % | Tokens |
|---|---|---|
| Ecosystem & Rewards | 40% | 40,000,000 |
| Team | 20% | 20,000,000 |
| Liquidity | 20% | 20,000,000 |
| Treasury | 10% | 10,000,000 |
| IDO / Airdrop | 10% | 10,000,000 |

### Utilidades

- **Desconto de taxa**: Holders de $INC pagam taxa reduzida no protocolo
- **Governança**: Votação on-chain em parâmetros do protocolo
- **Queima deflacionária**: Parte das taxas é queimada permanentemente
- **Staking rewards**: Rewards em múltiplas redes

---

## Contratos Verificados

| Rede | INCNetwork | $INC Token |
|---|---|---|
| Ethereum | `0xAD4Fbde...` | — |
| Arbitrum | `0x83F723...` | `0xeAa4FA...` |
| Polygon | `0x83F723...` | `0xeAa4FA...` |
| Avalanche | `0x83F723...` | `0x9A48dC...` |

Todos os contratos são open source e verificados nos respectivos explorers.

---

## Segurança

- **Chainlink Oracle**: preços a prova de manipulação
- **ReentrancyGuard**: proteção em todas as funções que movimentam ETH
- **Ownable2Step**: transferência de ownership exige confirmação
- **Timelock**: emergencyResolve com 4 dias de aviso
- **Circuit Breaker**: pause/unpause pelo owner
- **Pull Payment**: treasury nunca bloqueia o protocolo
- **68/68 testes** passando (Hardhat)

---

## Pools de Liquidez (Uniswap V3)

| Rede | Par | Preço |
|---|---|---|
| Arbitrum | INC/WETH | $0.01 |
| Polygon | INC/WMATIC | $0.01 |
| Avalanche | INC/WAVAX | $0.01 |

---

## Roadmap

### Fase 1 — Concluída ✅
- Deploy Sepolia testnet + testes completos
- Deploy mainnet: Ethereum, Arbitrum, Polygon, Avalanche
- $INC Token multichain
- Pools Uniswap V3
- Frontend web3

### Fase 2 — Em andamento 🔄
- BNB Chain, Optimism, Rootstock
- Chainlink Automation em todas as redes
- Airdrop para early adopters
- CoinGecko / CoinMarketCap listing
- Trust Wallet assets

### Fase 3 — Planejado 📋
- Governança on-chain com $INC
- Queima deflacionária automática
- Mobile app
- Programa de afiliados
- Audit por firma especializada

---

## Links

- **App**: https://freire007-byte.github.io/INC-Network
- **GitHub**: https://github.com/Freire007-byte/INC-Network
- **Twitter**: https://twitter.com/incnetwork
- **Instagram**: https://instagram.com/incnetwork
- **Uniswap**: https://app.uniswap.org/#/swap?outputCurrency=0xeAa4FAF815e36caaa082C71aC8ca962F531443d7&chain=arbitrum

---

*INC Network v1.4 — 2026*
