# INC Network — Proof-of-Signal + $INC Token

Smart contract de staking de sinais on-chain com resolução automática via Chainlink Oracle.

## Contrato em produção (Sepolia Testnet)

| Item | Valor |
|---|---|
| **Contrato** | `0x3aF7127ca9Fa313D4AB7FAcdf7062F0FA5574993` |
| **Etherscan** | https://sepolia.etherscan.io/address/0x3aF7127ca9Fa313D4AB7FAcdf7062F0FA5574993#code |
| **Versão** | v1.4 |
| **Rede** | Sepolia Testnet (Chain ID: 11155111) |
| **Treasury** | `0xc23dC262362C105774c0F05f7a166D3515310D03` |
| **Taxa** | 3.5% |

## $INC Token (Sepolia Testnet)

| Item | Valor |
|---|---|
| **Contrato** | `0xeAa4FAF815e36caaa082C71aC8ca962F531443d7` |
| **Etherscan** | https://sepolia.etherscan.io/token/0xeAa4FAF815e36caaa082C71aC8ca962F531443d7 |
| **Símbolo** | $INC |
| **Supply** | 100,000,000 INC |
| **Decimais** | 18 |
| **Padrão** | ERC-20 · Burnable · Pausable · Ownable2Step |

## Pools de Liquidez (Uniswap V3)

| Rede | Par | Pool | Preço |
|---|---|---|---|
| Arbitrum | $INC / WETH | [`0x8770e3B0aE902092dE06F821ff59b48F961F098D`](https://app.uniswap.org/explore/pools/arbitrum/0x8770e3B0aE902092dE06F821ff59b48F961F098D) | $0.01 |
| Polygon | $INC / WMATIC | [`0xc15de19035399A2FF2b987fAfe8392F4DBccc2D1`](https://app.uniswap.org/explore/pools/polygon/0xc15de19035399A2FF2b987fAfe8392F4DBccc2D1) | $0.01 |
| Avalanche | $INC / WAVAX | [`0xa04A83aD438866788f54b67e6e9BB96E569C3061`](https://app.uniswap.org/explore/pools/avalanche/0xa04A83aD438866788f54b67e6e9BB96E569C3061) | $0.01 |

### Como comprar $INC

1. Acesse [app.uniswap.org](https://app.uniswap.org)
2. Selecione a rede (Arbitrum, Polygon ou Avalanche)
3. Cole o endereço do token: `0xeAa4FAF815e36caaa082C71aC8ca962F531443d7` (Arbitrum/Polygon) ou `0x9A48dCDF8FC1e9047F1834D70e328C30B1B1863B` (Avalanche)
4. Troque ETH/MATIC/AVAX por $INC

## Contratos Mainnet

| Rede | Contrato | Explorer |
|---|---|---|
| Polygon | `0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC` | https://polygonscan.com/address/0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC |
| Ethereum | `0xAD4Fbde4810f3919F169c827A582aed34330ADA0` | https://etherscan.io/address/0xAD4Fbde4810f3919F169c827A582aed34330ADA0 |
| Arbitrum | `0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC` | https://arbiscan.io/address/0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC |
| Optimism | — | em breve |
| BNB Chain | — | em breve |
| Avalanche | `0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC` | https://snowscan.xyz/address/0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC |
| Rootstock | — | em breve |

## Chainlink Automation

| Item | Valor |
|---|---|
| **Upkeep ID** | `75439110777960276467956536149758701315749263214294222503003354522819246112710` |
| **Dashboard** | https://automation.chain.link/sepolia |
| **LINK depositado** | 5 LINK (25 LINK disponíveis na carteira) |

## Feeds Chainlink configurados (Sepolia)

| Par | Feed |
|---|---|
| BTC/USDT | `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` |
| ETH/USDT | `0x694AA1769357215DE4FAC081bf1f309aDC325306` |

## Instalação

```bash
npm install
```

## Testes (68/68 passando)

```bash
npx hardhat test
```

### Cobertura completa dos testes

**Deploy**
- Treasury e owner são distintos
- Rejeita deploy com treasury igual ao owner

**setPriceFeed()**
- Owner registra feed corretamente
- Não-owner não pode registrar feed
- createSignal falha se par não tem feed
- getCurrentPrice retorna preço normalizado do feed

**createSignal()**
- Cria sinal LONG e adiciona à lista de abertos
- Cobra taxa de 3.5% para a treasury
- Rejeita LONG com TP abaixo do preço atual do oracle (exploit WIN instantâneo)
- Rejeita SHORT com TP acima do preço atual do oracle (exploit WIN instantâneo)

**resolveByOracle()**
- WIN: qualquer pessoa resolve quando preço atinge TP
- WIN: provider recebe o pool completo via pendingWithdrawal
- LOSS: resolve quando preço atinge SL
- LOSS: follower resgata recompensa após resolução
- Reverte se TP/SL ainda não foi atingido
- Reverte se preço estiver stale (>1 hora sem atualização)
- Remove sinal da lista de abertos após resolução
- Normaliza decimais: feed com 6 decimais → 8 decimais internamente

**resolveByOracle() — SHORT**
- SHORT WIN: resolve quando preço cai até TP
- SHORT LOSS: resolve quando preço sobe até SL

**emergencyResolve()**
- Bloqueia proposta de emergência antes de 3 dias
- Permite resolução de emergência após 3 dias + 1 dia de timelock
- Não-owner não pode propor resolução de emergência

**checkUpkeep() + performUpkeep()**
- checkUpkeep retorna false quando preço está entre TP e SL
- checkUpkeep retorna true quando TP é atingido
- checkUpkeep detecta sinal expirado
- performUpkeep resolve sinal quando TP atingido
- performUpkeep expira sinal após timeout
- checkUpkeep respeita batchSize via checkData

**claimReward() + withdraw()**
- Follower resgata recompensa após LOSS e saca
- Dois followers com stake igual recebem recompensas iguais
- Não pode reivindicar duas vezes

**Ownable2Step**
- Transferência exige aceitação do novo owner
- Terceiro não pode aceitar ownership

**Sem receive()**
- Rejeita ETH enviado diretamente ao contrato

**claimExpired()**
- Follower recupera stake após sinal expirado
- Provider recupera stake após sinal expirado
- Não pode chamar claimExpired duas vezes
- Não pode chamar claimExpired em sinal não expirado
- Follower saca ETH após claimExpired

**pause() / unpause()**
- Owner pausa e despausa o contrato
- Não-owner não pode pausar
- createSignal falha quando pausado
- followSignal falha quando pausado
- Após unpause, contrato volta a funcionar normalmente

**cancelEmergencyResolve()**
- Owner cancela proposta pendente
- Após cancelamento, nova proposta pode ser feita
- Não pode cancelar proposta inexistente
- Não pode executar após cancelamento

**Treasury withdraw()**
- Treasury acumula taxas de createSignal e followSignal
- Treasury saca ETH acumulado
- Treasury não pode sacar duas vezes sem novas taxas
- Treasury acumula taxas de múltiplos sinais

## Deploy Sepolia

Configure o `.env`:
```
PRIVATE_KEY=sua_chave_privada
INC_TREASURY=endereco_da_treasury
INC_OWNER=endereco_do_owner
SEPOLIA_RPC_URL=https://1rpc.io/sepolia
ETHERSCAN_KEY=sua_api_key
```

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Verificação no Etherscan

```bash
npx hardhat verify --network sepolia ENDERECO_CONTRATO "TREASURY" "OWNER"
```

## Registro do Chainlink Automation

```bash
npx hardhat run scripts/register-upkeep.js --network sepolia
```

## Deploy multi-chain (mainnet)

```bash
npx hardhat run scripts/deploy-all.js --network ethereum
npx hardhat run scripts/deploy-all.js --network arbitrum
npx hardhat run scripts/deploy-all.js --network polygon
npx hardhat run scripts/deploy-all.js --network bnb
npx hardhat run scripts/deploy-all.js --network optimism
npx hardhat run scripts/deploy-all.js --network avalanche
npx hardhat run scripts/deploy-all.js --network rootstock
```

> Feeds BTC/USDT e ETH/USDT são configurados automaticamente em cada rede.
> Para SOL/USDT e BNB/USDT em BSC, Optimism e Avalanche, adicione manualmente
> via `setPriceFeed()` após consultar os endereços em docs.chain.link.

## Verificação multi-chain

```bash
# Ethereum
npx hardhat verify --network ethereum 0xAD4Fbde4810f3919F169c827A582aed34330ADA0 "0xc23dC262362C105774c0F05f7a166D3515310D03" "0x391dd5b84ef7B5FCf845C3dD1D5d388945d5F679"

# Polygon
npx hardhat verify --network polygon 0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC "0xc23dC262362C105774c0F05f7a166D3515310D03" "0x391dd5b84ef7B5FCf845C3dD1D5d388945d5F679"

# Arbitrum
npx hardhat verify --network arbitrum 0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC "0xc23dC262362C105774c0F05f7a166D3515310D03" "0x391dd5b84ef7B5FCf845C3dD1D5d388945d5F679"

# Avalanche
npx hardhat verify --network avalanche 0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC "0xc23dC262362C105774c0F05f7a166D3515310D03" "0x391dd5b84ef7B5FCf845C3dD1D5d388945d5F679"
```

## Registro do Chainlink Automation (por rede)

Requer LINK na carteira do deployer em cada rede.

```bash
npx hardhat run scripts/register-upkeep.js --network ethereum
npx hardhat run scripts/register-upkeep.js --network polygon
npx hardhat run scripts/register-upkeep.js --network arbitrum
npx hardhat run scripts/register-upkeep.js --network avalanche
npx hardhat run scripts/register-upkeep.js --network bnb       # após deploy
npx hardhat run scripts/register-upkeep.js --network optimism  # após deploy
```

## Segurança

- `entryPrice` validado contra oracle Chainlink (tolerância 2%)
- Treasury usa pull-payment — nunca bloqueia o protocolo
- `emergencyResolve` com timelock de 1 dia (proposta + execução separadas)
- Circuit breaker: `pause()` / `unpause()` disponível para o owner
- ReentrancyGuard em todas as funções que movimentam ETH
- Ownable2Step — transferência de owner exige confirmação

## Redes suportadas para mainnet

| Rede | Chain ID | Moeda |
|---|---|---|
| Ethereum | 1 | ETH |
| Arbitrum | 42161 | ETH |
| Polygon | 137 | MATIC |
| BNB Chain | 56 | BNB |
| Optimism | 10 | ETH |
| Avalanche | 43114 | AVAX |
| Rootstock | 30 | RBTC |
