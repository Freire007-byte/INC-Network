// scripts/resume-polygon.js
// Continua o deploy Polygon a partir do INCNetwork já deployado
// INCNetwork já em: 0x4078b28e19f826f3e4C24187eaE90b294A6A68cc
require("dotenv").config();
const hre = require("hardhat");

const NETWORK_ADDR = "0x4078b28e19f826f3e4C24187eaE90b294A6A68cc";

const NETWORK_ABI = [
  "function setPriceFeed(string calldata pair, address feed) external",
  "function setIncToken(address token) external",
  "function incTokenContract() view returns (address)",
];
const TOKEN_ABI = [
  "function setNetworkContract(address network) external",
  "function incNetworkContract() view returns (address)",
  "function isWhitelisted(address) view returns (bool)",
  "function lockEnabled() view returns (bool)",
  "function totalSupply() view returns (uint256)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const treasury = process.env.INC_TREASURY || deployer.address;

  console.log("\n◈ Polygon — Retomada do deploy\n");
  console.log(`  Deployer   : ${deployer.address}`);
  console.log(`  INCNetwork : ${NETWORK_ADDR} (já deployado)`);

  const network = new hre.ethers.Contract(NETWORK_ADDR, NETWORK_ABI, deployer);

  // BNB/USDT feed (checksum corrigido)
  console.log("\n► Adicionando feed BNB/USDT...");
  const txFeed = await network.setPriceFeed("BNB/USDT", "0x82A6c4Af830CAA6C97BB504425f6A992840954B2");
  await txFeed.wait();
  console.log("  ✓ BNB/USDT configurado");

  // Deploy INCToken v2
  const eco  = process.env.INC_ECOSYSTEM_WALLET  || deployer.address;
  const team = process.env.INC_TEAM_WALLET        || deployer.address;
  const liq  = process.env.INC_LIQUIDITY_WALLET   || deployer.address;
  const trs  = process.env.INC_TREASURY_WALLET    || deployer.address;
  const ido  = process.env.INC_IDO_WALLET         || deployer.address;

  console.log("\n► Deployando INCToken v2...");
  const TokenFactory = await hre.ethers.getContractFactory("INCToken");
  const token = await TokenFactory.deploy(eco, team, liq, trs, ido);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`  ✓ INCToken @ ${tokenAddr}`);

  // Wire
  console.log("\n► Conectando contratos...");
  const tx1 = await token.setNetworkContract(NETWORK_ADDR);
  await tx1.wait();
  console.log("  ✓ INCToken.setNetworkContract");

  const tx2 = await network.setIncToken(tokenAddr);
  await tx2.wait();
  console.log("  ✓ INCNetwork.setIncToken");

  // Verificação
  const ok =
    (await token.incNetworkContract()).toLowerCase() === NETWORK_ADDR.toLowerCase() &&
    (await network.incTokenContract()).toLowerCase()  === tokenAddr.toLowerCase() &&
    (await token.isWhitelisted(NETWORK_ADDR)) &&
    (await token.lockEnabled());

  const supply = await token.totalSupply();
  console.log(`\n  supply  : ${hre.ethers.formatEther(supply)} INC`);
  console.log(`  status  : ${ok ? "✅ OK" : "❌ ERRO"}`);

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  RESUMO — Polygon Mainnet");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  INCNetwork : ${NETWORK_ADDR}`);
  console.log(`  INCToken   : ${tokenAddr}`);
  console.log("\n  Adicione ao .env:");
  console.log(`  INC_CONTRACT_POLYGON=${NETWORK_ADDR}`);
  console.log(`  INC_TOKEN_POLYGON=${tokenAddr}`);
  console.log("\n  Verificar:");
  console.log(`  npx hardhat verify --network polygon ${NETWORK_ADDR} "${treasury}" "${deployer.address}"`);
  console.log(`  npx hardhat verify --network polygon ${tokenAddr} "${eco}" "${team}" "${liq}" "${trs}" "${ido}"`);
  console.log("══════════════════════════════════════════════════════════\n");
}

main().catch(e => { console.error(e); process.exit(1); });
