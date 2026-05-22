# INC Network — Relatório de Segurança

**Versão auditada:** v1.4  
**Contratos:** `INCNetwork.sol`, `INCToken.sol`  
**Suite de testes:** `test/INCNetwork.attack.test.js`  
**Resultado:** 57 testes de ataque · **57 passando · 0 falhando**  
**Data:** 2026-05-22

---

## Resumo Executivo

O contrato INCNetwork v1.4 foi submetido a uma bateria de 57 testes de segurança cobrindo os principais vetores de ataque em contratos DeFi/Proof-of-Signal. Nenhuma vulnerabilidade crítica ou alta foi encontrada. O contrato implementa corretamente os padrões CEI (Checks-Effects-Interactions), ReentrancyGuard, Ownable2Step, e pull-payment para todas as transferências de ETH.

---

## Vetores Testados

### ATAQUE 1 — Reentrancy
| Teste | Resultado |
|-------|-----------|
| ReentrancyGuard bloqueia segunda chamada durante withdraw | ✅ BLOQUEADO |
| `pendingWithdrawal` zerado ANTES de `_sendETH` (padrão CEI) | ✅ CORRETO |

**Análise:** O contrato implementa o padrão Checks-Effects-Interactions em todas as funções de saque. `pendingWithdrawal[msg.sender] = 0` ocorre antes de `_sendETH()`. O modificador `nonReentrant` protege `withdraw()`, `claimReward()`, `claimExpired()`, `followSignal()`, `createSignal()` e `resolveByOracle()`.

---

### ATAQUE 2 — Double-Claim
| Teste | Resultado |
|-------|-----------|
| `claimReward()` rejeitado na segunda chamada | ✅ BLOQUEADO |
| `claimExpired()` rejeitado na segunda chamada | ✅ BLOQUEADO |
| `withdraw()` rejeitado com saldo zero | ✅ BLOQUEADO |

**Análise:** A flag `pos.claimed = true` é definida antes de `pendingWithdrawal += reward`. Mesmo sem o nonReentrant, o double-claim seria impossível. Com o guard, fica duplamente protegido.

---

### ATAQUE 3 — Provider Auto-Follow
| Teste | Resultado |
|-------|-----------|
| Provider não pode seguir o próprio sinal | ✅ BLOQUEADO |

**Análise:** `require(msg.sender != sig.provider)` impede que o provider amplie artificialmente seu pool.

---

### ATAQUE 4 — Manipulação de EntryPrice (WIN instantâneo)
| Teste | Resultado |
|-------|-----------|
| EntryPrice > 2% acima do oracle rejeitado | ✅ BLOQUEADO |
| EntryPrice < 2% abaixo do oracle rejeitado | ✅ BLOQUEADO |
| LONG com TP ≤ preço atual (WIN imediato) rejeitado | ✅ BLOQUEADO |
| SHORT com TP ≥ preço atual (WIN imediato) rejeitado | ✅ BLOQUEADO |
| LONG com SL ≥ entry (stop inválido) rejeitado | ✅ BLOQUEADO |

**Análise:** A validação `ENTRY_PRICE_TOLERANCE_BPS = 200 (2%)` impede que o provider defina um entry price manipulado. A checagem adicional `targetPrice > oraclePrice` (LONG) / `targetPrice < oraclePrice` (SHORT) garante que o TP não está já atingido no momento de criação do sinal.

---

### ATAQUE 5 — Oracle Staleness
| Teste | Resultado |
|-------|-----------|
| `_getPrice` reverte com feed atualizado há > 1h | ✅ BLOQUEADO |
| `_tryGetPrice` retorna false (não reverte) em checkUpkeep | ✅ SEGURO |
| `_getPrice` reverte com preço = 0 ou negativo | ✅ BLOQUEADO |

**Análise:** `PRICE_STALENESS_THRESHOLD = 3600s (1h)` garante que preços desatualizados são rejeitados. A versão `_tryGetPrice` usada no `checkUpkeep` nunca reverte, evitando que o Chainlink Automation seja bloqueado por um feed problemático.

---

### ATAQUE 6 — Dupla Resolução
| Teste | Resultado |
|-------|-----------|
| `resolveByOracle()` rejeitado em sinal já resolvido | ✅ BLOQUEADO |
| `expireSignal()` rejeitado em sinal já expirado | ✅ BLOQUEADO |
| `followSignal()` rejeitado em sinal fechado | ✅ BLOQUEADO |

**Análise:** O campo `sig.status` atua como lock de estado. Qualquer operação em sinal não-OPEN é rejeitada.

---

### ATAQUE 7 — Bypass de Timelock de Emergência
| Teste | Resultado |
|-------|-----------|
| Owner não pode propor resolução antes de 3 dias | ✅ BLOQUEADO |
| Owner não pode executar antes do timelock de 1 dia | ✅ BLOQUEADO |
| Não-owner não pode propor nem executar | ✅ BLOQUEADO |
| Segunda proposta rejeitada se já existe uma pendente | ✅ BLOQUEADO |

**Análise:** O mecanismo de emergência tem dois timelocks em série: `ADMIN_RESOLVE_DELAY = 3 dias` (antes de propor) + `EMERGENCY_TIMELOCK = 1 dia` (antes de executar). Total mínimo: 4 dias. Participantes têm janela de visibilidade para sacar antes de uma resolução de emergência adversa.

---

### ATAQUE 8 — DoS via Saturação de Followers
| Teste | Resultado |
|-------|-----------|
| Follow rejeitado ao atingir MAX_FOLLOWERS = 500 | ✅ BLOQUEADO |

**Análise:** `MAX_FOLLOWERS = 500` impede que um atacante bloqueie novos followers por saturação. O custo para saturar um sinal (500 × 0.001 ETH mínimo = 0.5 ETH) torna o ataque economicamente inviável.

---

### ATAQUE 9 — Controle de Acesso
| Teste | Resultado |
|-------|-----------|
| Não-owner não pode pausar | ✅ BLOQUEADO |
| createSignal rejeitado quando pausado | ✅ BLOQUEADO |
| followSignal rejeitado quando pausado | ✅ BLOQUEADO |
| Não-owner não pode registrar price feed | ✅ BLOQUEADO |
| setPriceFeed com endereço zero rejeitado | ✅ BLOQUEADO |
| Deploy com treasury = zero address rejeitado | ✅ BLOQUEADO |
| Deploy com treasury = owner rejeitado | ✅ BLOQUEADO |

**Análise:** Separação treasury/owner imposta no constructor. Feeds maliciosos com address(0) são rejeitados. A pausa de emergência só afeta criação e seguimento de sinais, não saques — usuários sempre podem recuperar fundos.

---

### ATAQUE 10 — Transferência de Propriedade
| Teste | Resultado |
|-------|-----------|
| Transferência requer aceitação pelo novo owner (2-step) | ✅ CORRETO |
| Transferência para endereço zero rejeitada | ✅ BLOQUEADO |

**Análise:** `Ownable2Step` implementado manualmente evita perda acidental da ownership por endereço errado.

---

### ATAQUE 11 — Stake Mínimo
| Teste | Resultado |
|-------|-----------|
| createSignal rejeita stake < 0.005 ETH | ✅ BLOQUEADO |
| followSignal rejeita stake < 0.001 ETH | ✅ BLOQUEADO |

**Análise:** Stakes mínimos eliminam spam de sinais sem compromisso econômico real.

---

### ATAQUE 12 — Expiração Antecipada
| Teste | Resultado |
|-------|-----------|
| expireSignal falha antes de 7 dias | ✅ BLOQUEADO |
| Qualquer pessoa pode expirar após 7 dias | ✅ PERMISSIONLESS |

**Análise:** `SIGNAL_TIMEOUT = 7 dias`. A expiração é permissionless (qualquer endereço pode acionar), eliminando dependência do owner ou do Chainlink para devolver fundos.

---

### ATAQUE 13 — Claim em Estado Incorreto
| Teste | Resultado |
|-------|-----------|
| claimReward em sinal WIN rejeitado | ✅ BLOQUEADO |
| claimExpired em sinal LOSS rejeitado | ✅ BLOQUEADO |
| Follower sem posição rejeitado | ✅ BLOQUEADO |
| claimReward em sinal sem followers rejeitado | ✅ BLOQUEADO |

---

### ATAQUE 14 — Operações em Sinal Inexistente
| Teste | Resultado |
|-------|-----------|
| followSignal para ID inexistente rejeitado | ✅ BLOQUEADO |
| resolveByOracle para ID = 0 rejeitado | ✅ BLOQUEADO |
| expireSignal para ID inexistente rejeitado | ✅ BLOQUEADO |

**Análise:** `require(sig.id != 0)` funciona porque o ID nunca é 0 (`signalId = ++totalSignals` começa em 1).

---

### ATAQUE 15 — Precisão Aritmética
| Teste | Resultado |
|-------|-----------|
| Soma de rewards ≤ totalPoolAtResolution (rounding correto) | ✅ CORRETO |
| Provider recebe exatamente totalPoolAtResolution em WIN | ✅ CORRETO |
| Devolução exata de stakes em EXPIRED | ✅ CORRETO |

**Análise:** Rounding por divisão inteira pode deixar até `n-1` wei (onde n = número de followers) presos no contrato. Para 500 followers, no máximo 499 wei (~$0,001) ficam irrecuperáveis. Considerado aceitável.

---

### ATAQUE 16 — performUpkeep Malicioso
| Teste | Resultado |
|-------|-----------|
| Ação 0 em sinal resolvido reverte corretamente | ✅ SEGURO |
| Ação 1 em sinal não expirado reverte corretamente | ✅ SEGURO |

**Análise:** `performUpkeep` não tem controle de acesso (qualquer endereço pode chamar), mas delega para `resolveByOracle()` e `expireSignal()` que validam completamente o estado. Não é possível causar dano via performData malicioso.

---

### ATAQUE 17 — Integridade das Taxas
| Teste | Resultado |
|-------|-----------|
| Treasury acumula taxas corretas (3,5%) | ✅ CORRETO |
| Treasury pode sacar via withdraw() | ✅ CORRETO |

**Análise:** Pull-payment para treasury evita falhas de envio se a treasury for um contrato. As taxas são calculadas em BPS com precisão adequada.

---

### ATAQUE 18 — Win Rate
| Teste | Resultado |
|-------|-----------|
| Win rate = 100% após 1 WIN | ✅ CORRETO |
| Win rate = 50% após 1 WIN + 1 LOSS | ✅ CORRETO |

---

### ATAQUE 19 — Parâmetros Inválidos
| Teste | Resultado |
|-------|-----------|
| Pair vazio rejeitado | ✅ BLOQUEADO |
| Pair > 20 caracteres rejeitado | ✅ BLOQUEADO |
| Par sem feed configurado rejeitado | ✅ BLOQUEADO |
| RSI > 100 rejeitado | ✅ BLOQUEADO |
| EntryPrice = 0 rejeitado | ✅ BLOQUEADO |

---

### ATAQUE 20 — Double Follow
| Teste | Resultado |
|-------|-----------|
| Segundo follow do mesmo endereço rejeitado | ✅ BLOQUEADO |

---

## Achados por Severidade

### CRÍTICO — Nenhum

### ALTO — Nenhum

### MÉDIO — Nenhum

### BAIXO

| ID | Título | Impacto | Status |
|----|--------|---------|--------|
| L-01 | Dust irrecuperável por rounding em claimReward | Até `followers-1` wei presos por sinal LOSS | Aceito (< $0,001) |
| L-02 | performUpkeep sem controle de acesso | Qualquer EOA pode acionar a automação | Aceito (design intencional, permissionless) |

### INFORMACIONAL

| ID | Título | Observação |
|----|--------|------------|
| I-01 | Expiry por timestamp de bloco | Miners podem manipular ±15s; irrelevante para timeout de 7 dias |
| I-02 | Win rate não contabiliza sinais expirados | Provider pode criar sinais sem followers para não afetar a taxa de acerto |
| I-03 | `_openSignalIds` cresce indefinidamente | Em cenários com milhares de sinais simultâneos, o checkUpkeep pode precisar de batches maiores |
| I-04 | Sem função `receive()` | ETH só entra via `createSignal()` e `followSignal()` — ETH acidental enviado diretamente reverte |

---

## Boas Práticas Implementadas

| Padrão | Implementação |
|--------|--------------|
| **CEI** (Checks-Effects-Interactions) | Todos os saques zerão `pendingWithdrawal` antes de `_sendETH` |
| **Pull Payment** | Treasury e usuários sacam via `withdraw()` — sem push automático |
| **ReentrancyGuard** | Todas as funções de escrita protegidas com `nonReentrant` |
| **Ownable2Step** | Transferência de ownership requer confirmação pelo novo owner |
| **Oracle Staleness Check** | Preços rejeitados se desatualizados há > 1h |
| **Timelock de Emergência** | 3 dias + 1 dia antes de resolução manual pelo owner |
| **Separação treasury/owner** | Fundos de taxa separados da conta de administração |
| **Imutabilidade da treasury** | `address public immutable incTreasury` — não pode ser alterado pós-deploy |
| **Validação de entryPrice** | Tolerância de ±2% em relação ao preço oracle atual |
| **Anti-WIN instantâneo** | TP deve estar além do preço atual no momento de criação |

---

## Como Executar os Testes

```bash
# Instalar dependências
npm install

# Rodar apenas os testes de segurança
npx hardhat test test/INCNetwork.attack.test.js

# Rodar toda a suite
npx hardhat test
```

**Resultado esperado:**
```
57 passing
0 failing
```

---

## Contratos em Produção

| Rede | Endereço | Explorer |
|------|----------|---------|
| Sepolia (testnet) | `0x99ABa0D947367ABC96dDc612C6e407954aC46836` | [sepolia.etherscan.io](https://sepolia.etherscan.io/address/0x99ABa0D947367ABC96dDc612C6e407954aC46836) |
| Polygon | `0xf49841DF7726691D04D311BC4A0821C0AB9211f5` | [polygonscan.com](https://polygonscan.com/address/0xf49841DF7726691D04D311BC4A0821C0AB9211f5) |
| Arbitrum | `0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745` | [arbiscan.io](https://arbiscan.io/address/0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745) |
| Avalanche | `0x55413bF29C5b2c7EE54333fD09382f13Ca081593` | [snowscan.xyz](https://snowscan.xyz/address/0x55413bF29C5b2c7EE54333fD09382f13Ca081593) |

---

## Divulgação Responsável

Se você encontrar uma vulnerabilidade não coberta neste relatório, por favor abra uma **issue privada** no repositório ou entre em contato via [X/Twitter @inc_network_](https://x.com/inc_network_) antes de divulgar publicamente.

---

*Auditoria realizada pela equipe INC Network com Claude Code. Os testes são open-source e auditáveis por qualquer pessoa.*
