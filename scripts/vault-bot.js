/**
 * vault-bot.js — Sub-conta automática INC Network
 *
 * Monitora sinais abertos e segue automaticamente aqueles
 * com bom momentum em direção ao TP.
 *
 * Completamente off-chain: para o contrato é apenas mais
 * um follower anônimo — nenhuma relação com a treasury aparece
 * na blockchain.
 *
 * USO:
 *   node scripts/vault-bot.js               (produção)
 *   node scripts/vault-bot.js --dry-run     (simula sem enviar TX)
 */

require("dotenv").config();
const { ethers } = require("ethers");
const fs  = require("fs");
const path = require("path");

// ──────────────────────────────────────────────────────────
// CONFIGURAÇÃO — via .env
// ──────────────────────────────────────────────────────────
const CFG = {
  rpcUrl:      process.env.VAULT_RPC_URL      || process.env.SEPOLIA_RPC_URL,
  privateKey:  process.env.VAULT_PRIVATE_KEY,
  contract:    process.env.VAULT_CONTRACT     || "0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC",

  stakeEth:    process.env.VAULT_STAKE_ETH    || "0.005",  // ETH por sinal
  minProgress: parseFloat(process.env.VAULT_MIN_PROGRESS  || "45"),   // % mínimo rumo ao TP
  maxPoolEth:  parseFloat(process.env.VAULT_MAX_POOL_ETH  || "2.0"),  // não entra em pools muito grandes
  maxPerRun:   parseInt(  process.env.VAULT_MAX_PER_RUN   || "2"),    // máx de follows por ciclo
  intervalMin: parseFloat(process.env.VAULT_INTERVAL_MIN  || "5"),    // minutos entre ciclos
  lookback:    parseInt(  process.env.VAULT_LOOKBACK      || "40"),   // quantos sinais verificar

  logFile: path.resolve(__dirname, "../vault-bot.log"),
  dryRun:  process.argv.includes("--dry-run"),
};

const ABI = [
  "function totalSignals() view returns (uint256)",
  "function getSignal(uint256) view returns (tuple(uint256 id,address provider,string pair,uint8 direction,uint256 entryPrice,uint256 targetPrice,uint256 stopPrice,uint256 providerStake,uint256 followersStake,uint256 createdAt,uint256 resolvedAt,uint8 status,uint256 rsi,uint256 totalPoolAtResolution,address priceFeed))",
  "function getCurrentPrice(string) view returns (uint256)",
  "function getPosition(uint256,address) view returns (tuple(uint256 amount,bool claimed))",
  "function followerCount(uint256) view returns (uint256)",
  "function followSignal(uint256) payable",
];

// ──────────────────────────────────────────────────────────
// LOGGER
// ──────────────────────────────────────────────────────────
function log(msg, level = "INFO") {
  const ts   = new Date().toISOString().replace("T", " ").slice(0, 19);
  const line = `[${ts}] [${level.padEnd(5)}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(CFG.logFile, line + "\n"); } catch {}
}

const info  = m => log(m, "INFO");
const warn  = m => log(m, "WARN");
const error = m => log(m, "ERROR");
const ok    = m => log(m, "OK");

// ──────────────────────────────────────────────────────────
// CÁLCULO DE PROGRESSO RUMO AO TP
// ──────────────────────────────────────────────────────────
function calcProgress(sig, oraclePriceBN) {
  const entry = sig.entryPrice.toNumber()  / 1e8;
  const tp    = sig.targetPrice.toNumber() / 1e8;
  const sl    = sig.stopPrice.toNumber()   / 1e8;
  const cur   = oraclePriceBN.toNumber()   / 1e8;
  const isLong = sig.direction === 0;

  const tpDist = isLong ? tp - entry : entry - tp;
  const slDist = isLong ? entry - sl : sl - entry;

  if (tpDist <= 0) return null;

  const moved = isLong ? cur - entry : entry - cur;
  const pct   = (moved / tpDist) * 100;

  const slBreached = isLong ? cur <= sl : cur >= sl;
  const tpReached  = pct >= 100;

  // Risco/retorno: quanto do caminho ao SL já foi perdido
  const slPct = slDist > 0 ? (-moved / slDist) * 100 : 0;

  return { pct, slBreached, tpReached, cur, entry, tp, sl, isLong, slPct };
}

// ──────────────────────────────────────────────────────────
// CICLO PRINCIPAL
// ──────────────────────────────────────────────────────────
async function runCycle(provider, wallet, contract) {
  const sep = "━".repeat(56);
  info(sep);
  info(`Iniciando ciclo ${CFG.dryRun ? "[DRY-RUN] " : ""}…`);

  // Saldo da vault
  const balWei  = await provider.getBalance(wallet.address);
  const balEth  = parseFloat(ethers.utils.formatEther(balWei));
  const stakeEth = parseFloat(CFG.stakeEth);
  info(`Saldo vault: ${balEth.toFixed(6)} ETH`);

  if (balEth < stakeEth * 1.5) {
    warn(`Saldo baixo — mínimo recomendado ${(stakeEth * 1.5).toFixed(4)} ETH. Pulando ciclo.`);
    return;
  }

  const total = (await contract.totalSignals()).toNumber();
  if (total === 0) { info("Nenhum sinal no contrato."); return; }

  const from = Math.max(1, total - CFG.lookback + 1);
  info(`Analisando sinais #${from} → #${total} (${total - from + 1} sinais)…`);

  const candidates = [];

  for (let i = total; i >= from; i--) {
    try {
      const sig = await contract.getSignal(i);

      if (sig.status !== 0) continue;                   // só abertos

      // Não seguir o próprio sinal se vault for provider
      if (sig.provider.toLowerCase() === wallet.address.toLowerCase()) continue;

      // Verificar se vault já segue este sinal
      const myPos = await contract.getPosition(i, wallet.address);
      if (myPos.amount.gt(0)) continue;

      // Pool não muito grande
      const pool    = sig.providerStake.add(sig.followersStake);
      const poolEth = parseFloat(ethers.utils.formatEther(pool));
      if (poolEth > CFG.maxPoolEth) continue;

      // Checar expiração — não entrar com menos de 12h restantes
      const now     = Math.floor(Date.now() / 1000);
      const expires = sig.createdAt.toNumber() + 7 * 86400;
      if (now >= expires) continue;
      if (expires - now < 12 * 3600) continue;

      // Preço atual via oracle on-chain
      let oraclePrice;
      try {
        oraclePrice = await contract.getCurrentPrice(sig.pair);
      } catch {
        continue; // par sem feed configurado
      }

      const prog = calcProgress(sig, oraclePrice);
      if (!prog) continue;
      if (prog.slBreached) continue;   // SL atingido — perigo
      if (prog.tpReached)  continue;   // TP já atingido — Chainlink vai resolver
      if (prog.pct < 0)    continue;   // preço indo contra a direção

      candidates.push({ sigId: i, sig, prog, poolEth });

    } catch { /* ignora erros de sinal individual */ }
  }

  info(`${candidates.length} sinal(is) candidato(s) (progresso > 0%):`);
  for (const c of candidates) {
    info(`  #${c.sigId} ${c.sig.pair} ${c.sig.direction===0?"LONG":"SHORT"} — ${c.prog.pct.toFixed(1)}% → TP | pool ${c.poolEth.toFixed(3)} ETH`);
  }

  // Filtra por progresso mínimo e ordena do melhor para o pior
  const eligible = candidates
    .filter(c => c.prog.pct >= CFG.minProgress)
    .sort((a, b) => b.prog.pct - a.prog.pct);

  if (eligible.length === 0) {
    info(`Nenhum sinal atingiu o critério mínimo de ${CFG.minProgress}% de progresso.`);
    return;
  }

  info(`${eligible.length} elegível(is). Seguindo até ${CFG.maxPerRun} neste ciclo.`);

  let followed = 0;

  for (const { sigId, sig, prog } of eligible) {
    if (followed >= CFG.maxPerRun) break;

    info(`→ Tentando seguir #${sigId} ${sig.pair} (${prog.pct.toFixed(1)}% → TP, preço: $${prog.cur.toFixed(2)})`);

    if (CFG.dryRun) {
      ok(`  [DRY-RUN] Seguiria sinal #${sigId} com ${CFG.stakeEth} ETH`);
      followed++;
      continue;
    }

    try {
      const stakeWei    = ethers.utils.parseEther(CFG.stakeEth);
      const gasEstimate = await contract.estimateGas.followSignal(sigId, { value: stakeWei });
      const gasPrice    = await provider.getGasPrice();
      const gasCost     = gasEstimate.mul(gasPrice);
      const balNow      = await provider.getBalance(wallet.address);

      if (balNow.lt(stakeWei.add(gasCost.mul(130).div(100)))) {
        warn(`  Saldo insuficiente para stake + gas. Pulando.`);
        continue;
      }

      const tx = await contract.followSignal(sigId, {
        value:    stakeWei,
        gasLimit: gasEstimate.mul(120).div(100),
      });

      info(`  TX enviada: ${tx.hash}`);
      const receipt = await tx.wait();
      ok(`  Confirmado bloco ${receipt.blockNumber} — seguido sinal #${sigId} com ${CFG.stakeEth} ETH`);
      followed++;

    } catch (e) {
      error(`  Falha ao seguir #${sigId}: ${e.reason || e.message}`);
    }
  }

  info(`Ciclo concluído — ${followed} sinal(is) seguido(s).`);
}

// ──────────────────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────────────────
async function main() {
  if (!CFG.privateKey) {
    console.error("ERRO: VAULT_PRIVATE_KEY não definido no .env");
    process.exit(1);
  }
  if (!CFG.rpcUrl) {
    console.error("ERRO: VAULT_RPC_URL (ou SEPOLIA_RPC_URL) não definido no .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(CFG.rpcUrl);
  const wallet   = new ethers.Wallet(CFG.privateKey, provider);
  const contract = new ethers.Contract(CFG.contract, ABI, wallet);

  const network = await provider.getNetwork();

  info("╔══════════════════════════════════════════════════╗");
  info("║         INC NETWORK — VAULT BOT                 ║");
  info("╚══════════════════════════════════════════════════╝");
  info(`Rede:      ${network.name} (chain ${network.chainId})`);
  info(`Vault:     ${wallet.address}`);
  info(`Contrato:  ${CFG.contract}`);
  info(`Stake/op:  ${CFG.stakeEth} ETH`);
  info(`Progresso: ≥ ${CFG.minProgress}% → TP`);
  info(`Pool máx:  ${CFG.maxPoolEth} ETH`);
  info(`Máx/ciclo: ${CFG.maxPerRun}`);
  info(`Intervalo: ${CFG.intervalMin} min`);
  if (CFG.dryRun) warn("MODO DRY-RUN — nenhuma transação será enviada");
  info(`Log:       ${CFG.logFile}`);

  // Ciclo imediato ao iniciar
  try { await runCycle(provider, wallet, contract); }
  catch (e) { error(`Erro no ciclo inicial: ${e.message}`); }

  // Ciclos periódicos
  const ms = CFG.intervalMin * 60 * 1000;
  setInterval(async () => {
    try { await runCycle(provider, wallet, contract); }
    catch (e) { error(`Erro no ciclo: ${e.message}`); }
  }, ms);

  info(`Próximo ciclo em ${CFG.intervalMin} minutos. Pressione Ctrl+C para parar.`);
}

main().catch(e => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
