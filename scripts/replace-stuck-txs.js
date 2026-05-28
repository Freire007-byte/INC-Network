// scripts/replace-stuck-txs.js
// Substitui TXs presas no mempool Polygon enviando replacement com gas alto
// Chama setPriceFeed nos nonces pendentes para forçar confirmação
//
// USO: npx hardhat run scripts/replace-stuck-txs.js --network polygon

const hre = require("hardhat");

const INC_CONTRACT = process.env.INC_CONTRACT_POLYGON || "0xf49841DF7726691D04D311BC4A0821C0AB9211f5";
const XAU_FEED     = "0x0C466540B2ee1a31b441671eac0ca886e051E410";
const GAS_PRICE    = 2000n * 10n ** 9n; // 2000 gwei — garante prioridade máxima

const ABI = [
  "function setPriceFeed(string calldata pair, address feed) external",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider   = hre.ethers.provider;

  const confirmedNonce = await provider.getTransactionCount(deployer.address, "latest");
  const pendingNonce   = await provider.getTransactionCount(deployer.address, "pending");

  console.log(`\n◈ Replace Stuck TXs — Polygon`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Nonce confirmado : ${confirmedNonce}`);
  console.log(`  Nonce pending    : ${pendingNonce}`);
  console.log(`  TXs a substituir : ${pendingNonce - confirmedNonce}\n`);

  if (confirmedNonce === pendingNonce) {
    console.log("  ✓ Nenhuma TX presa. Tudo ok!");
    return;
  }

  const inc = new hre.ethers.Contract(INC_CONTRACT, ABI, deployer);

  for (let nonce = confirmedNonce; nonce < pendingNonce; nonce++) {
    console.log(`  → Substituindo nonce ${nonce} com 2000 gwei...`);
    const tx = await inc.setPriceFeed("OURO/USDT", XAU_FEED, {
      nonce,
      gasPrice: GAS_PRICE,
      gasLimit: 100_000n,
    });
    console.log(`    TX: ${tx.hash}`);
  }

  console.log(`\n  ✓ ${pendingNonce - confirmedNonce} TXs de substituição enviadas.`);
  console.log(`  Aguardando confirmação do nonce ${confirmedNonce}...\n`);

  // Aguarda apenas a primeira (nonce confirmado) — as demais seguem em ordem
  const receipt = await provider.waitForTransaction(
    await provider.getTransactionCount(deployer.address, "latest").then(() => null),
    1, 60_000
  ).catch(() => null);

  const finalNonce = await provider.getTransactionCount(deployer.address, "latest");
  console.log(`  Nonce final confirmado: ${finalNonce}`);
}

main().catch(e => { console.error(e); process.exit(1); });
