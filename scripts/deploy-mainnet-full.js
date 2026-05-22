// scripts/deploy-mainnet-full.js
// Deploy completo mainnet: INCNetwork v1.5 + INCToken v2 + wire + verify
// Uso: npx hardhat run scripts/deploy-mainnet-full.js --network polygon
//      npx hardhat run scripts/deploy-mainnet-full.js --network arbitrum
//      npx hardhat run scripts/deploy-mainnet-full.js --network avalanche

require("dotenv").config();
const hre = require("hardhat");

const FEEDS = {
  polygon: {
    "BTC/USDT": "0xc907E116054Ad103354f2D350FD2514433D57F6f",
    "ETH/USDT": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    "SOL/USDT": "0x10C8264C0935b3B9870013e057f330Ff3e9C56dC",
    "BNB/USDT": "0x82A6c4Af830CAA6C97BB504425f6A992840954B2",
  },
  arbitrum: {
    "BTC/USDT": "0x6ce185539ad4fdaecd7274954aeae3c8d5f2773a",
    "ETH/USDT": "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    "SOL/USDT": "0x24ceA4b8ce57cDA33212ac39Ee00A68539736e28",
    "BNB/USDT": "0x6970460aabF80C5BE983C6b74e5D06dEDCA95D4A",
  },
  avalanche: {
    "BTC/USDT": "0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743",
    "ETH/USDT": "0x976B3D034E162d8bD72D6b9C989d545b839003b0",
  },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const netName    = hre.network.name;
  const bal        = await hre.ethers.provider.getBalance(deployer.address);
  const treasury   = process.env.INC_TREASURY || deployer.address;

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  INC Network — Deploy Mainnet: ${netName.padEnd(27)}║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Saldo    : ${hre.ethers.formatEther(bal)}`);
  console.log(`  Treasury : ${treasury}\n`);

  if (bal === 0n) {
    console.error("  ❌ Saldo zero — adicione gas nesta rede");
    process.exit(1);
  }

  const eco  = process.env.INC_ECOSYSTEM_WALLET  || deployer.address;
  const team = process.env.INC_TEAM_WALLET        || deployer.address;
  const liq  = process.env.INC_LIQUIDITY_WALLET   || deployer.address;
  const trs  = process.env.INC_TREASURY_WALLET    || deployer.address;
  const ido  = process.env.INC_IDO_WALLET         || deployer.address;

  // ── 1. INCNetwork v1.5 ────────────────────────────────────────
  console.log("► [1/5] Deployando INCNetwork v1.5...");
  const NetworkFactory = await hre.ethers.getContractFactory("INCNetwork");
  const network = await NetworkFactory.deploy(treasury, deployer.address);
  await network.waitForDeployment();
  const networkAddr = await network.getAddress();
  console.log(`  ✓ INCNetwork @ ${networkAddr}`);

  // ── 2. Price feeds ────────────────────────────────────────────
  console.log("\n► [2/5] Configurando Chainlink Price Feeds...");
  const feeds = FEEDS[netName] || {};
  for (const [pair, feed] of Object.entries(feeds)) {
    const tx = await network.setPriceFeed(pair, feed);
    await tx.wait();
    console.log(`  ✓ ${pair} → ${feed}`);
  }

  // ── 3. INCToken v2 ────────────────────────────────────────────
  console.log("\n► [3/5] Deployando INCToken v2...");
  const TokenFactory = await hre.ethers.getContractFactory("INCToken");
  const token = await TokenFactory.deploy(eco, team, liq, trs, ido);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`  ✓ INCToken  @ ${tokenAddr}`);

  // ── 4. Wire ───────────────────────────────────────────────────
  console.log("\n► [4/5] Conectando contratos...");
  const tx1 = await token.setNetworkContract(networkAddr);
  await tx1.wait();
  console.log(`  ✓ INCToken.setNetworkContract`);

  const tx2 = await network.setIncToken(tokenAddr);
  await tx2.wait();
  console.log(`  ✓ INCNetwork.setIncToken`);

  // ── 5. Verificação ────────────────────────────────────────────
  console.log("\n► [5/5] Verificando...");
  const ok =
    (await token.incNetworkContract()).toLowerCase() === networkAddr.toLowerCase() &&
    (await network.incTokenContract()).toLowerCase() === tokenAddr.toLowerCase() &&
    (await token.isWhitelisted(networkAddr)) &&
    (await token.lockEnabled());
  console.log(`  status : ${ok ? "✅ OK" : "❌ ERRO"}`);

  const netKey = netName.toUpperCase();
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  RESUMO — ${netName}`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`  INCNetwork : ${networkAddr}`);
  console.log(`  INCToken   : ${tokenAddr}`);
  console.log(`\n  Adicione ao .env:`);
  console.log(`  INC_CONTRACT_${netKey}=${networkAddr}`);
  console.log(`  INC_TOKEN_${netKey}=${tokenAddr}`);
  console.log(`\n  Verificar:`);
  console.log(`  npx hardhat verify --network ${netName} ${networkAddr} "${treasury}" "${deployer.address}"`);
  console.log(`  npx hardhat verify --network ${netName} ${tokenAddr} "${eco}" "${team}" "${liq}" "${trs}" "${ido}"`);
  console.log(`══════════════════════════════════════════════════════════\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
