// scripts/deploy-sepolia-full.js
// Deploy completo na Sepolia: INCNetwork v1.5 + INCToken v2 + wire
// Uso: npx hardhat run scripts/deploy-sepolia-full.js --network sepolia

require("dotenv").config();
const hre = require("hardhat");

const SEPOLIA_FEEDS = {
  "BTC/USDT": "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
  "ETH/USDT": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const bal = await hre.ethers.provider.getBalance(deployer.address);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     INC Network — Deploy Completo Sepolia (testnet)      ║");
  console.log("║     INCNetwork v1.5 + INCToken v2                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Saldo    : ${hre.ethers.formatEther(bal)} ETH\n`);

  const treasury = process.env.INC_TREASURY || deployer.address;

  // ── 1. INCNetwork v1.5 ────────────────────────────────────────

  console.log("► [1/5] Deployando INCNetwork v1.5...");
  const NetworkFactory = await hre.ethers.getContractFactory("INCNetwork");
  const network = await NetworkFactory.deploy(treasury, deployer.address);
  await network.waitForDeployment();
  const networkAddr = await network.getAddress();
  console.log(`  ✓ INCNetwork @ ${networkAddr}`);

  // ── 2. Price feeds ────────────────────────────────────────────

  console.log("\n► [2/5] Configurando Chainlink Price Feeds...");
  for (const [pair, feed] of Object.entries(SEPOLIA_FEEDS)) {
    const tx = await network.setPriceFeed(pair, feed);
    await tx.wait();
    console.log(`  ✓ ${pair} → ${feed}`);
  }

  // ── 3. INCToken v2 ────────────────────────────────────────────

  console.log("\n► [3/5] Deployando INCToken v2...");
  // Usando deployer para todas as wallets — redistribuir depois
  const eco  = process.env.INC_ECOSYSTEM_WALLET  || deployer.address;
  const team = process.env.INC_TEAM_WALLET        || deployer.address;
  const liq  = process.env.INC_LIQUIDITY_WALLET   || deployer.address;
  const trs  = process.env.INC_TREASURY_WALLET    || deployer.address;
  const ido  = process.env.INC_IDO_WALLET         || deployer.address;

  const TokenFactory = await hre.ethers.getContractFactory("INCToken");
  const token = await TokenFactory.deploy(eco, team, liq, trs, ido);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`  ✓ INCToken  @ ${tokenAddr}`);

  // ── 4. Wire ───────────────────────────────────────────────────

  console.log("\n► [4/5] Conectando contratos...");
  const tx1 = await token.setNetworkContract(networkAddr);
  await tx1.wait();
  console.log(`  ✓ INCToken.setNetworkContract(${networkAddr})`);

  const tx2 = await network.setIncToken(tokenAddr);
  await tx2.wait();
  console.log(`  ✓ INCNetwork.setIncToken(${tokenAddr})`);

  // ── 5. Verificação ────────────────────────────────────────────

  console.log("\n► [5/5] Verificando configuração...");
  const netInToken    = await token.incNetworkContract();
  const tokenInNet    = await network.incTokenContract();
  const netWhitelisted= await token.isWhitelisted(networkAddr);
  const locked        = await token.lockEnabled();
  const supply        = await token.totalSupply();

  const ok = netInToken.toLowerCase()  === networkAddr.toLowerCase() &&
             tokenInNet.toLowerCase()  === tokenAddr.toLowerCase()   &&
             netWhitelisted && locked;

  console.log(`  incNetworkContract  : ${netInToken}`);
  console.log(`  incTokenContract    : ${tokenInNet}`);
  console.log(`  network whitelisted : ${netWhitelisted}`);
  console.log(`  lockEnabled         : ${locked}`);
  console.log(`  supply              : ${hre.ethers.formatEther(supply)} INC`);
  console.log(`  status              : ${ok ? "✅ OK" : "❌ ERRO"}\n`);

  console.log("══════════════════════════════════════════════════════════");
  console.log("  RESUMO — Endereços Sepolia");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  INCNetwork : ${networkAddr}`);
  console.log(`  INCToken   : ${tokenAddr}`);
  console.log(`  Treasury   : ${treasury}`);
  console.log(`  Deployer   : ${deployer.address}`);
  console.log("");
  console.log("  Adicione ao .env:");
  console.log(`  INC_CONTRACT_SEPOLIA=${networkAddr}`);
  console.log(`  INC_TOKEN_SEPOLIA=${tokenAddr}`);
  console.log("");
  console.log("  Verificar no Etherscan:");
  console.log(`  npx hardhat verify --network sepolia ${networkAddr} "${treasury}" "${deployer.address}"`);
  console.log(`  npx hardhat verify --network sepolia ${tokenAddr} "${eco}" "${team}" "${liq}" "${trs}" "${ido}"`);
  console.log("══════════════════════════════════════════════════════════\n");

  return { networkAddr, tokenAddr };
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
