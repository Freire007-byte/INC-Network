// scripts/deploy-incchain.js
// Deploy completo na INC Network (Chain ID 19191)
//
// Executa:
//   npx hardhat run scripts/deploy-incchain.js --network incchain

const hre   = require("hardhat");
const fs    = require("fs");
const path  = require("path");

const INITIAL_PRICES = {
  "BTC/USDT":  BigInt(10300000000000),  // $103,000
  "ETH/USDT":  BigInt(245000000000),    // $2,450
  "SOL/USDT":  BigInt(17000000000),     // $170
  "BNB/USDT":  BigInt(64500000000),     // $645
  "AVAX/USDT": BigInt(3800000000),      // $38
  "MATIC/USDT":BigInt(100000000),       // $1.00
  "XAU/USDT":  BigInt(330000000000),    // $3,300
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const bal = await hre.ethers.provider.getBalance(deployer.address);

  console.log("\n◈ INC NETWORK — Deploy Completo");
  console.log(`  Chain ID  : ${hre.network.config.chainId}`);
  console.log(`  Deployer  : ${deployer.address}`);
  console.log(`  Saldo     : ${hre.ethers.formatEther(bal)} ETH\n`);

  // ── 1. Deploy oracles de preço ──────────────────────────────
  console.log("1/5 — Deployando oracles de preço...");
  const MockAgg = await hre.ethers.getContractFactory("MockV3Aggregator");
  const feeds = {};
  for (const [pair, price] of Object.entries(INITIAL_PRICES)) {
    const feed = await MockAgg.deploy(8, price);
    await feed.waitForDeployment();
    const feedAddr = await feed.getAddress();
    feeds[pair] = { address: feedAddr };
    console.log(`  ✓ ${pair.padEnd(12)} → ${feedAddr}`);
  }

  // ── 2. Deploy INCNetwork ──────────────────────────────────────
  console.log("\n2/5 — Deployando INCNetwork...");
  const INCNetwork = await hre.ethers.getContractFactory("INCNetwork");
  const treasury = process.env.INC_TREASURY || deployer.address;
  const owner    = process.env.INC_OWNER    || deployer.address;
  const network  = await INCNetwork.deploy(treasury, owner);
  await network.waitForDeployment();
  const networkAddr = await network.getAddress();
  console.log(`  ✓ INCNetwork → ${networkAddr}`);

  // ── 3. Registrar todos os price feeds ────────────────────────
  console.log("\n3/5 — Registrando price feeds...");
  for (const [pair, feed] of Object.entries(feeds)) {
    const tx = await network.setPriceFeed(pair, feed.address);
    await tx.wait();
    console.log(`  ✓ setPriceFeed(${pair})`);
  }

  // ── 4. Deploy INCToken (opcional) ────────────────────────────
  let tokenAddr = null;
  const hasWallets = process.env.INC_ECOSYSTEM_WALLET && process.env.INC_ECOSYSTEM_WALLET.trim();
  if (hasWallets) {
    console.log("\n4/5 — Deployando INCToken...");
    const INCToken = await hre.ethers.getContractFactory("INCToken");
    const token = await INCToken.deploy(
      process.env.INC_ECOSYSTEM_WALLET,
      process.env.INC_TEAM_WALLET,
      process.env.INC_LIQUIDITY_WALLET,
      process.env.INC_TREASURY_WALLET  || treasury,
      process.env.INC_IDO_WALLET       || deployer.address,
    );
    await token.waitForDeployment();
    tokenAddr = await token.getAddress();
    console.log(`  ✓ INCToken → ${tokenAddr}`);

    console.log("\n5/5 — Conectando INCToken ↔ INCNetwork...");
    const tx1 = await token.setNetworkContract(networkAddr);
    await tx1.wait();
    console.log("  ✓ INCToken.setNetworkContract()");

    try {
      const tx2 = await network.setIncToken(tokenAddr);
      await tx2.wait();
      console.log("  ✓ INCNetwork.setIncToken()");
    } catch { console.log("  ⚠ INCNetwork.setIncToken() não suportado — ok"); }
  } else {
    console.log("\n4/5 — INCToken pulado (wallets não configuradas no .env)");
    console.log("5/5 — Wire pulado");
  }

  // ── 5. Salvar endereços ───────────────────────────────────────
  const depPath = path.join(__dirname, "..", "deployments.json");
  let deps = {};
  try { deps = JSON.parse(fs.readFileSync(depPath, "utf8")); } catch {}

  deps.incchain = {
    network:   networkAddr,
    token:     tokenAddr,
    chainId:   19191,
    feeds:     Object.fromEntries(Object.entries(feeds).map(([p, f]) => [p, f.address])),

    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(depPath, JSON.stringify(deps, null, 2));
  console.log(`\n  ✅ deployments.json atualizado`);

  console.log("\n══════════════════════════════════════════════");
  console.log("  INC NETWORK — Deploy concluído!");
  console.log("══════════════════════════════════════════════");
  console.log(`  INCNetwork : ${networkAddr}`);
  if (tokenAddr) console.log(`  INCToken   : ${tokenAddr}`);
  console.log(`  Chain ID   : 19191`);
  console.log(`  RPC        : http://153.75.224.178:8545`);
  console.log("══════════════════════════════════════════════\n");

  console.log("  Adicione ao .env:");
  console.log(`  INC_CONTRACT_INCCHAIN=${networkAddr}`);
  if (tokenAddr) console.log(`  INC_TOKEN_INCCHAIN=${tokenAddr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
