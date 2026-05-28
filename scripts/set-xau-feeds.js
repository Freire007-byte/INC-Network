// scripts/set-xau-feeds.js
// Configura o feed Chainlink XAU/USD (ouro) no INCNetwork em cada rede
//
// USO:
//   npx hardhat run scripts/set-xau-feeds.js --network polygon
//   npx hardhat run scripts/set-xau-feeds.js --network arbitrum
//   npx hardhat run scripts/set-xau-feeds.js --network avalanche

const hre = require("hardhat");

const CONFIG = {
  polygon: {
    contract: process.env.INC_CONTRACT_POLYGON || "0xf49841DF7726691D04D311BC4A0821C0AB9211f5",
    xauFeed:  "0x0C466540B2ee1a31b441671eac0ca886e051E410",
  },
  arbitrum: {
    contract: process.env.INC_CONTRACT_ARBITRUM || "0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745",
    xauFeed:  "0x1F954Dc24a49708C26E0C1777f16750B5C6d5a2c",
  },
  avalanche: {
    contract: process.env.INC_CONTRACT_AVALANCHE || "0x55413bF29C5b2c7EE54333fD09382f13Ca081593",
    xauFeed:  "0x1f41ef93dece881ad0b98082b2d44d3f6f0c515b",
  },
};

const ABI = [
  "function setPriceFeed(string calldata pair, address feed) external",
  "function getCurrentPrice(string calldata pair) external view returns (uint256)",
  "function owner() external view returns (address)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const netName    = hre.network.name;
  const cfg        = CONFIG[netName];

  if (!cfg) {
    console.error(`Rede "${netName}" não suportada. Use: polygon | arbitrum | avalanche`);
    process.exit(1);
  }

  console.log(`\n◈ INC Network — Set XAU/USD Feed`);
  console.log(`  Rede        : ${netName}`);
  console.log(`  Deployer    : ${deployer.address}`);
  console.log(`  INCNetwork  : ${cfg.contract}`);
  console.log(`  Feed XAU/USD: ${cfg.xauFeed}\n`);

  const inc = new hre.ethers.Contract(cfg.contract, ABI, deployer);

  // Verifica se deployer é owner
  const owner = await inc.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`  ❌ Deployer não é owner do contrato.`);
    console.error(`     Owner:    ${owner}`);
    console.error(`     Deployer: ${deployer.address}`);
    process.exit(1);
  }

  // Verifica se já está configurado
  let currentPrice;
  try {
    currentPrice = await inc.getCurrentPrice("OURO/USDT");
    if (currentPrice > 0n) {
      console.log(`  ✓ Feed OURO/USDT já configurado. Preço atual: $${(Number(currentPrice) / 1e8).toFixed(2)}`);
      console.log(`  → Atualizando para garantir endereço correto...`);
    }
  } catch {
    console.log(`  → Feed OURO/USDT ainda não configurado.`);
  }

  // Chama setPriceFeed com gas price adequado
  const feeData = await hre.ethers.provider.getFeeData();
  const gasOpts = feeData.maxFeePerGas
    ? { maxFeePerGas: feeData.maxFeePerGas * 2n, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n }
    : { gasPrice: feeData.gasPrice * 2n };
  console.log(`  → setPriceFeed("OURO/USDT", ${cfg.xauFeed})...`);
  console.log(`  → Gas: ${feeData.maxFeePerGas ? (Number(feeData.maxFeePerGas * 2n) / 1e9).toFixed(1) + " gwei (EIP-1559)" : (Number(feeData.gasPrice * 2n) / 1e9).toFixed(1) + " gwei"}`);
  const tx = await inc.setPriceFeed("OURO/USDT", cfg.xauFeed, gasOpts);
  console.log(`  → TX enviado: ${tx.hash}`);
  await tx.wait();
  console.log(`  ✓ TX confirmado!\n`);

  // Verificação — lê o preço do ouro ao vivo
  try {
    const price = await inc.getCurrentPrice("OURO/USDT");
    const usd   = (Number(price) / 1e8).toFixed(2);
    console.log(`  ✅ OURO/USDT configurado com sucesso!`);
    console.log(`     Preço ao vivo: $${usd} USD`);
  } catch (e) {
    console.warn(`  ⚠ Feed configurado, mas getCurrentPrice falhou: ${e.message}`);
    console.warn(`    Isso é normal se o feed não atualizou ainda. Tente em alguns minutos.`);
  }

  console.log(`\n  Adicione ao deployments.json:`);
  console.log(`  "${netName}".feeds."OURO/USDT": "${cfg.xauFeed}"\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
