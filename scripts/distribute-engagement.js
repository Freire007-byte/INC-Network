// scripts/distribute-engagement.js
// ══════════════════════════════════════════════════════════════
// Distribuição de $INC — Fase 1 (Engajamento Inicial)
// ══════════════════════════════════════════════════════════════
// Lê eventos on-chain do contrato INCNetwork e distribui $INC
// para todos os participantes proporcionalmente à atividade.
//
// REGRAS:
//   Criar sinal     → 2.000 $INC
//   Seguir sinal    → 500 $INC
//   Sinal resolvido → 1.000 $INC (provider ou follower)
//   Early adopter   → 5.000 $INC (primeiros 500 endereços únicos)
//
// SUPPLY ALOCADO: 10.000.000 $INC (10% — idoWallet)
// MAX POR ENDEREÇO: 50.000 $INC
//
// USO:
//   node scripts/distribute-engagement.js [--dry-run] [--network polygon]
//   --dry-run   : Mostra o resultado sem enviar transações
//   --network   : polygon | arbitrum | avalanche (default: polygon)
// ══════════════════════════════════════════════════════════════

const { ethers } = require("ethers");
require("dotenv").config();

// ── Configuração ──────────────────────────────────────────────

const INC_PER_CREATED  = ethers.parseEther("2000");
const INC_PER_FOLLOWED = ethers.parseEther("500");
const INC_PER_RESOLVED = ethers.parseEther("1000");
const INC_EARLY_BONUS  = ethers.parseEther("5000");
const MAX_PER_ADDR     = ethers.parseEther("50000");
const TOTAL_PHASE1     = ethers.parseEther("10000000"); // 10M INC
const EARLY_LIMIT      = 500; // primeiros N endereços únicos

const NETWORKS = {
  polygon: {
    rpc:      process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
    contract: process.env.INC_CONTRACT_POLYGON  || "0xf49841DF7726691D04D311BC4A0821C0AB9211f5",
    token:    "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7",
    name:     "Polygon",
  },
  arbitrum: {
    rpc:      "https://arb1.arbitrum.io/rpc",
    contract: process.env.INC_CONTRACT_ARBITRUM  || "0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745",
    token:    "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7",
    name:     "Arbitrum",
  },
  avalanche: {
    rpc:      "https://api.avax.network/ext/bc/C/rpc",
    contract: process.env.INC_CONTRACT_AVALANCHE || "0x55413bF29C5b2c7EE54333fD09382f13Ca081593",
    token:    "0x9A48dCDF8FC1e9047F1834D70e328C30B1B1863B",
    name:     "Avalanche",
  },
};

const CONTRACT_ABI = [
  "event SignalCreated(uint256 indexed signalId, address indexed provider, string pair, uint8 direction, uint256 entryPrice, uint256 targetPrice, uint256 stopPrice, uint256 stake, uint256 rsi, uint256 timestamp)",
  "event SignalFollowed(uint256 indexed signalId, address indexed follower, uint256 amount, uint256 networkFee)",
  "event SignalResolved(uint256 indexed signalId, uint8 status, uint256 resolvedAt)",
  "function totalSignals() view returns (uint256)",
  "function getSignal(uint256) view returns (tuple(uint256 id, address provider, string pair, uint8 direction, uint256 entryPrice, uint256 targetPrice, uint256 stopPrice, uint256 providerStake, uint256 followersStake, uint256 createdAt, uint256 resolvedAt, uint8 status, uint256 rsi, uint256 totalPoolAtResolution, address priceFeed))",
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// ── Utilitários ───────────────────────────────────────────────

function fmt(n) {
  return parseFloat(ethers.formatEther(n)).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function clamp(val, max) {
  return val > max ? max : val;
}

// ── Lógica principal ──────────────────────────────────────────

async function buildAllocation(contract, provider) {
  const allocation = new Map(); // address → { created, followed, resolved, inc }
  const firstSeen  = [];        // ordem cronológica de primeiros contatos

  const ensureEntry = (addr) => {
    const a = addr.toLowerCase();
    if (!allocation.has(a)) {
      allocation.set(a, { created: 0, followed: 0, resolved: 0, inc: 0n });
      firstSeen.push(a);
    }
    return allocation.get(a);
  };

  console.log("  Lendo eventos SignalCreated…");
  const createdFilter = contract.filters.SignalCreated();
  const createdLogs   = await contract.queryFilter(createdFilter, 0, "latest");
  for (const log of createdLogs) {
    const e = ensureEntry(log.args.provider);
    e.created++;
    e.inc += INC_PER_CREATED;
  }
  console.log(`  → ${createdLogs.length} sinais criados por ${allocation.size} providers`);

  console.log("  Lendo eventos SignalFollowed…");
  const followedFilter = contract.filters.SignalFollowed();
  const followedLogs   = await contract.queryFilter(followedFilter, 0, "latest");
  const followersSet   = new Set();
  for (const log of followedLogs) {
    const e = ensureEntry(log.args.follower);
    e.followed++;
    e.inc += INC_PER_FOLLOWED;
    followersSet.add(log.args.follower.toLowerCase());
  }
  console.log(`  → ${followedLogs.length} follows por ${followersSet.size} endereços únicos`);

  console.log("  Lendo eventos SignalResolved…");
  const resolvedFilter = contract.filters.SignalResolved();
  const resolvedLogs   = await contract.queryFilter(resolvedFilter, 0, "latest");

  // Para cada sinal resolvido, dar bônus ao provider e a todos os followers
  for (const log of resolvedLogs) {
    const status = Number(log.args.status);
    if (status !== 1 && status !== 2) continue; // só WIN e LOSS

    try {
      const sig = await contract.getSignal(log.args.signalId);
      // Provider recebe bônus
      const provE = ensureEntry(sig.provider);
      provE.resolved++;
      provE.inc += INC_PER_RESOLVED;
    } catch {}
  }
  console.log(`  → ${resolvedLogs.length} sinais resolvidos processados`);

  // Early adopter bonus: primeiros EARLY_LIMIT endereços únicos
  const earlyAddrs = firstSeen.slice(0, EARLY_LIMIT);
  for (const addr of earlyAddrs) {
    const e = allocation.get(addr);
    if (e) e.inc += INC_EARLY_BONUS;
  }
  console.log(`  → Early adopter bônus para ${earlyAddrs.length} endereços`);

  // Aplica cap por endereço
  let totalAllocated = 0n;
  for (const [addr, e] of allocation.entries()) {
    e.inc = clamp(e.inc, MAX_PER_ADDR);
    totalAllocated += e.inc;
  }

  // Se ultrapassar o total da fase, reduz proporcionalmente
  if (totalAllocated > TOTAL_PHASE1) {
    console.log(`  ⚠ Total alocado (${fmt(totalAllocated)} INC) > limite (${fmt(TOTAL_PHASE1)} INC). Reduzindo proporcionalmente...`);
    for (const [, e] of allocation.entries()) {
      e.inc = (e.inc * TOTAL_PHASE1) / totalAllocated;
    }
    totalAllocated = TOTAL_PHASE1;
  }

  return { allocation, totalAllocated };
}

async function printSummary(allocation, totalAllocated) {
  console.log("\n══════════════════════════════════════");
  console.log("  SUMÁRIO DA DISTRIBUIÇÃO");
  console.log("══════════════════════════════════════");
  console.log(`  Endereços elegíveis : ${allocation.size}`);
  console.log(`  Total a distribuir  : ${fmt(totalAllocated)} $INC`);
  console.log("");
  console.log("  Top 10 alocações:");

  const sorted = [...allocation.entries()]
    .filter(([, e]) => e.inc > 0n)
    .sort(([, a], [, b]) => (b.inc > a.inc ? 1 : -1))
    .slice(0, 10);

  for (const [addr, e] of sorted) {
    console.log(`  ${addr.slice(0,8)}…${addr.slice(-6)}  |  C:${e.created} F:${e.followed} R:${e.resolved}  →  ${fmt(e.inc)} INC`);
  }
  console.log("══════════════════════════════════════\n");
}

async function distribute(allocation, token, signer, dryRun) {
  const eligible = [...allocation.entries()].filter(([, e]) => e.inc > 0n);

  if (dryRun) {
    console.log(`  [DRY-RUN] ${eligible.length} transferências seriam enviadas.`);
    return;
  }

  const bal = await token.balanceOf(signer.address);
  const total = eligible.reduce((s, [, e]) => s + e.inc, 0n);
  if (bal < total) {
    console.error(`  ❌ Saldo insuficiente: ${fmt(bal)} INC disponível, ${fmt(total)} INC necessário`);
    process.exit(1);
  }

  console.log(`  Enviando para ${eligible.length} endereços...`);
  let done = 0;
  for (const [addr, e] of eligible) {
    try {
      const tx = await token.transfer(addr, e.inc);
      await tx.wait();
      done++;
      process.stdout.write(`\r  Progresso: ${done}/${eligible.length} (${addr.slice(0,8)}… → ${fmt(e.inc)} INC)`);
    } catch(err) {
      console.error(`\n  ⚠ Erro em ${addr}: ${err.shortMessage || err.message}`);
    }
  }
  console.log(`\n  ✅ Distribuição concluída: ${done}/${eligible.length} endereços`);
}

// ── Entry point ───────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes("--dry-run");
  const netName = args.find(a => !a.startsWith("--")) || "polygon";
  const net     = NETWORKS[netName];

  if (!net) {
    console.error("Rede desconhecida. Use: polygon | arbitrum | avalanche");
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("PRIVATE_KEY não definida no .env");
    process.exit(1);
  }

  console.log(`\n◈ INC Network — Distribuição Fase 1`);
  console.log(`  Rede   : ${net.name}`);
  console.log(`  Modo   : ${dryRun ? "DRY-RUN (sem transações)" : "PRODUÇÃO"}`);
  console.log(`  Carteira: ${new ethers.Wallet(process.env.PRIVATE_KEY).address}\n`);

  const prov    = new ethers.JsonRpcProvider(net.rpc);
  const wallet  = new ethers.Wallet(process.env.PRIVATE_KEY, prov);
  const contract = new ethers.Contract(net.contract, CONTRACT_ABI, prov);
  const token    = new ethers.Contract(net.token, TOKEN_ABI, wallet);

  const total = await contract.totalSignals();
  console.log(`  Sinais no contrato: ${total}\n`);

  console.log("► Construindo alocações...");
  const { allocation, totalAllocated } = await buildAllocation(contract, prov);

  await printSummary(allocation, totalAllocated);

  if (!dryRun) {
    const readline = require("readline").createInterface({ input: process.stdin, output: process.stdout });
    await new Promise(resolve => {
      readline.question(`  Confirmar distribuição de ${fmt(totalAllocated)} $INC para ${allocation.size} endereços? (s/N) `, ans => {
        readline.close();
        if (ans.trim().toLowerCase() !== "s") {
          console.log("  Cancelado.");
          process.exit(0);
        }
        resolve();
      });
    });
  }

  console.log("► Distribuindo tokens...");
  await distribute(allocation, token, wallet, dryRun);

  console.log("\n✔ Concluído.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
