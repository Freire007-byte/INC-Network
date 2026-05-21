/**
 * deploy-token.js — Deploy INC Network Token ($INC)
 *
 * Uso:
 *   npx hardhat run scripts/deploy-token.js --network sepolia
 *   npx hardhat run scripts/deploy-token.js --network polygon
 *   npx hardhat run scripts/deploy-token.js --network ethereum
 *
 * Variáveis .env requeridas:
 *   PRIVATE_KEY
 *   INC_ECOSYSTEM_WALLET   (40% — rewards do protocolo)
 *   INC_TEAM_WALLET        (20% — equipe, vested off-chain)
 *   INC_LIQUIDITY_WALLET   (20% — DEX liquidity)
 *   INC_TREASURY_WALLET    (10% — treasury do protocolo)
 *   INC_IDO_WALLET         (10% — IDO / venda pública)
 *
 * Se as variáveis de wallet não forem definidas, usa o deployer
 * para todas as carteiras (útil em testnet).
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await hre.ethers.provider.getNetwork();

  console.log("╔═══════════════════════════════════════╗");
  console.log("║    INC TOKEN — Deploy Script          ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`Rede:      ${network.name} (chain ${network.chainId})`);
  console.log(`Deployer:  ${deployer.address}`);

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Saldo:     ${hre.ethers.formatEther(bal)} ETH\n`);

  // Guarda mainnet: rejeita deploy se wallets não estiverem definidas
  const MAINNETS = [1, 137, 42161, 56, 10, 43114, 30];
  if (MAINNETS.includes(Number(network.chainId))) {
    const missing = ["INC_ECOSYSTEM_WALLET","INC_TEAM_WALLET","INC_LIQUIDITY_WALLET","INC_TREASURY_WALLET","INC_IDO_WALLET"]
      .filter(k => !process.env[k]);
    if (missing.length > 0)
      throw new Error(`MAINNET — preencha no .env antes de deployar:\n  ${missing.join("\n  ")}`);
  }

  // Wallets de alocação (fallback: deployer em testnet)
  const ecosystemWallet  = process.env.INC_ECOSYSTEM_WALLET  || deployer.address;
  const teamWallet       = process.env.INC_TEAM_WALLET       || deployer.address;
  const liquidityWallet  = process.env.INC_LIQUIDITY_WALLET  || deployer.address;
  const treasuryWallet   = process.env.INC_TREASURY_WALLET   || deployer.address;
  const idoWallet        = process.env.INC_IDO_WALLET        || deployer.address;

  console.log("Alocações:");
  console.log(`  Ecosystem  (40%): ${ecosystemWallet}`);
  console.log(`  Team       (20%): ${teamWallet}`);
  console.log(`  Liquidity  (20%): ${liquidityWallet}`);
  console.log(`  Treasury   (10%): ${treasuryWallet}`);
  console.log(`  IDO        (10%): ${idoWallet}\n`);

  const INCToken = await hre.ethers.getContractFactory("INCToken");
  console.log("Deployando INCToken...");

  const token = await INCToken.deploy(
    ecosystemWallet,
    teamWallet,
    liquidityWallet,
    treasuryWallet,
    idoWallet
  );
  await token.waitForDeployment();

  const addr        = await token.getAddress();
  const totalSupply = await token.totalSupply();

  console.log("\n✓ INCToken deployado!");
  console.log(`  Endereço:    ${addr}`);
  console.log(`  Supply:      ${hre.ethers.formatUnits(totalSupply, 18)} INC`);

  // Verificação automática (Etherscan/Polygonscan)
  if (process.env.ETHERSCAN_KEY || process.env.POLYGONSCAN_KEY) {
    console.log("\nAguardando 5 blocos para verificação...");
    await token.deploymentTransaction().wait(5);
    try {
      await hre.run("verify:verify", {
        address: addr,
        constructorArguments: [
          ecosystemWallet,
          teamWallet,
          liquidityWallet,
          treasuryWallet,
          idoWallet,
        ],
      });
      console.log("✓ Contrato verificado no explorer!");
    } catch (e) {
      console.warn("Verificação falhou (pode já estar verificado):", e.message);
    }
  }

  console.log("\n══════════════════════════════════════════");
  console.log("Adicione ao .env:");
  console.log(`INC_TOKEN_${network.chainId}=${addr}`);
  console.log("══════════════════════════════════════════\n");
}

main().catch(e => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
