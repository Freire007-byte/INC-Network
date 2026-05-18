/**
 * deploy-token-all.js — Deploy INCToken em todas as redes mainnet
 *
 * Uso:
 *   npx hardhat run scripts/deploy-token-all.js --network ethereum
 *   npx hardhat run scripts/deploy-token-all.js --network polygon
 *   npx hardhat run scripts/deploy-token-all.js --network arbitrum
 *   npx hardhat run scripts/deploy-token-all.js --network bnb
 *   npx hardhat run scripts/deploy-token-all.js --network optimism
 *   npx hardhat run scripts/deploy-token-all.js --network avalanche
 */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await hre.ethers.provider.getNetwork();

  const eco  = process.env.INC_ECOSYSTEM_WALLET  || deployer.address;
  const team = process.env.INC_TEAM_WALLET       || deployer.address;
  const liq  = process.env.INC_LIQUIDITY_WALLET  || deployer.address;
  const trs  = process.env.INC_TREASURY_WALLET   || deployer.address;
  const ido  = process.env.INC_IDO_WALLET        || deployer.address;

  console.log(`Deployando INCToken na rede ${network.name} (${network.chainId})...`);
  const INCToken = await hre.ethers.getContractFactory("INCToken");
  const token    = await INCToken.deploy(eco, team, liq, trs, ido);
  await token.waitForDeployment();

  const addr = await token.getAddress();
  console.log(`✓ INCToken @ ${addr}`);
  console.log(`Adicione ao .env: INC_TOKEN_${network.chainId}=${addr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
