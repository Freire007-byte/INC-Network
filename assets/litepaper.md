# INC Network â€” Litepaper v1.0

## Resumo Executivo

INC Network Ã© um protocolo DeFi de **Proof-of-Signal**: um sistema on-chain onde traders publicam sinais de mercado com stake real como garantia de comprometimento. A resoluÃ§Ã£o Ã© automÃ¡tica, executada pelo Chainlink Oracle, sem intervenÃ§Ã£o humana.

---

## O Problema

Sinais de trading estÃ£o em todo lugar â€” Telegram, Twitter, Discord. Mas:

- **Nenhum tem skin in the game real.** Qualquer pessoa pode publicar "BTC vai subir" sem arriscar nada.
- **Sem auditoria.** Win rates sÃ£o fabricados, histÃ³ricos sÃ£o apagados.
- **Sem resoluÃ§Ã£o objetiva.** Quem decide se o sinal foi certo ou errado?

O mercado de copy trading movimenta **$5 bilhÃµes/ano** sem nenhuma prova verificÃ¡vel de resultado.

---

## A SoluÃ§Ã£o: Proof-of-Signal

INC Network resolve isso com trÃªs princÃ­pios:

### 1. Stake real obrigatÃ³rio
O Provider coloca ETH/MATIC/AVAX em risco antes de publicar qualquer sinal. Sem stake â†’ sem sinal.

### 2. Oracle independente
Chainlink Price Feeds valida o preÃ§o de entrada e monitora TP/SL em tempo real. Nenhuma parte humana pode adulterar o resultado.

### 3. ResoluÃ§Ã£o automÃ¡tica
Chainlink Automation executa `performUpkeep()` quando TP ou SL Ã© atingido. O pool inteiro vai para o lado vencedor sem pedido manual.

---

## Como Funciona

```
Provider
  â””â”€ Publica sinal (par, direÃ§Ã£o, entrada, TP, SL)
  â””â”€ Faz stake de ETH/MATIC/AVAX
  â””â”€ Chainlink valida preÃ§o de entrada (tolerÃ¢ncia 2%)

Followers (atÃ© 500)
  â””â”€ Apostam no mesmo sinal
  â””â”€ Pool cresce a cada novo follower

Oracle
  â””â”€ Monitora preÃ§o a cada bloco
  â””â”€ Quando TP atingido â†’ WIN â†’ Provider + Followers vencem
  â””â”€ Quando SL atingido â†’ LOSS â†’ Followers vencem, Provider perde

ResoluÃ§Ã£o
  â””â”€ Vencedores sacam via claimReward()
  â””â”€ Taxa de 3.5% vai para treasury do protocolo
```

---

## $INC Token

| Item | Valor |
|---|---|
| Supply | 100,000,000 (fixo) |
| PadrÃ£o | ERC-20 Â· Burnable Â· Pausable Â· Ownable2Step |
| Decimais | 18 |
| PreÃ§o inicial | $0.01 |

### DistribuiÃ§Ã£o

| AlocaÃ§Ã£o | % | Tokens |
|---|---|---|
| Ecosystem & Rewards | 40% | 40,000,000 |
| Team | 20% | 20,000,000 |
| Liquidity | 20% | 20,000,000 |
| Treasury | 10% | 10,000,000 |
| IDO / Airdrop | 10% | 10,000,000 |

### Utilidades

- **Desconto de taxa**: Holders de $INC pagam taxa reduzida no protocolo
- **GovernanÃ§a**: VotaÃ§Ã£o on-chain em parÃ¢metros do protocolo
- **Queima deflacionÃ¡ria**: Parte das taxas Ã© queimada permanentemente
- **Staking rewards**: Rewards em mÃºltiplas redes

---

## Contratos Verificados

| Rede | INCNetwork | $INC Token |
|---|---|---|
| Ethereum | `0xAD4Fbde...` | â€” |
| Arbitrum | `0x83F723...` | `0xeAa4FA...` |
| Polygon | `0x83F723...` | `0xeAa4FA...` |
| Avalanche | `0x83F723...` | `0x9A48dC...` |

Todos os contratos sÃ£o open source e verificados nos respectivos explorers.

---

## SeguranÃ§a

- **Chainlink Oracle**: preÃ§os a prova de manipulaÃ§Ã£o
- **ReentrancyGuard**: proteÃ§Ã£o em todas as funÃ§Ãµes que movimentam ETH
- **Ownable2Step**: transferÃªncia de ownership exige confirmaÃ§Ã£o
- **Timelock**: emergencyResolve com 4 dias de aviso
- **Circuit Breaker**: pause/unpause pelo owner
- **Pull Payment**: treasury nunca bloqueia o protocolo
- **68/68 testes** passando (Hardhat)

---

## Pools de Liquidez (Uniswap V3)

| Rede | Par | PreÃ§o |
|---|---|---|
| Arbitrum | INC/WETH | $0.01 |
| Polygon | INC/WMATIC | $0.01 |
| Avalanche | INC/WAVAX | $0.01 |

---

## Roadmap

### Fase 1 â€” ConcluÃ­da âœ…
- Deploy Sepolia testnet + testes completos
- Deploy mainnet: Ethereum, Arbitrum, Polygon, Avalanche
- $INC Token multichain
- Pools Uniswap V3
- Frontend web3

### Fase 2 â€” Em andamento ðŸ”„
- BNB Chain, Optimism, Rootstock
- Chainlink Automation em todas as redes
- Airdrop para early adopters
- CoinGecko / CoinMarketCap listing
- Trust Wallet assets

### Fase 3 â€” Planejado ðŸ“‹
- GovernanÃ§a on-chain com $INC
- Queima deflacionÃ¡ria automÃ¡tica
- Mobile app
- Programa de afiliados
- Audit por firma especializada

---

## Links

- **App**: https://incnetwork.vercel.app
- **GitHub**: https://github.com/Freire007-byte/INC-Network
- **Twitter**: https://x.com/incnetwork_
- **Instagram**: https://instagram.com/inc_network_
- **Uniswap**: https://app.uniswap.org/#/swap?outputCurrency=0xeAa4FAF815e36caaa082C71aC8ca962F531443d7&chain=arbitrum

---

*INC Network v1.4 â€” 2026*

