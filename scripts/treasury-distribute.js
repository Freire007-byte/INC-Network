// scripts/treasury-distribute.js
// Saca taxas de cada contrato e distribui: 90% para carteira de destino, 10% fica para gas
const { ethers } = require("hardhat");
require("dotenv").config();

const DISTRIBUTE_BPS = 9000n; // 90%
const BPS_BASE       = 10000n;
const GAS_RESERVE    = ethers.parseEther("0.005"); // reserva mínima para gas

const NETWORKS = [
  {
    name:        "Polygon",
    rpc:         "https://polygon-bor-rpc.publicnode.com",
    contract:    process.env.INC_CONTRACT_POLYGON,
    destination: process.env.WALLET_POLYGON,
    symbol:      "MATIC",
  },
  {
    name:        "Arbitrum",
    rpc:         "https://arb1.arbitrum.io/rpc",
    contract:    process.env.INC_CONTRACT_ARBITRUM,
    destination: process.env.WALLET_ARBITRUM,
    symbol:      "ETH",
  },
  {
    name:        "Avalanche",
    rpc:         "https://api.avax.network/ext/bc/C/rpc",
    contract:    process.env.INC_CONTRACT_AVALANCHE,
    destination: process.env.WALLET_AVALANCHE,
    symbol:      "AVAX",
  },
  {
    name:        "Ethereum",
    rpc:         "https://ethereum-rpc.publicnode.com",
    contract:    null, // ainda não deployado
    destination: process.env.WALLET_ETH,
    symbol:      "ETH",
  },
];

const CONTRACT_ABI = [
  "function pendingWithdrawal(address) view returns (uint256)",
  "function withdraw() external",
];

async function distributeNetwork(net, treasuryWallet) {
  if (!net.contract) {
    console.log(`\n[${net.name}] contrato não deployado — pulando`);
    return;
  }
  if (!net.destination) {
    console.log(`\n[${net.name}] carteira destino não configurada — pulando`);
    return;
  }

  console.log(`\n[${net.name}]`);

  const provider  = new ethers.JsonRpcProvider(net.rpc);
  const signer    = treasuryWallet.connect(provider);
  const contract  = new ethers.Contract(net.contract, CONTRACT_ABI, signer);

  // 1. Verifica saldo pendente no contrato
  const pending = await contract.pendingWithdrawal(signer.address);
  console.log(`  Pendente no contrato: ${ethers.formatEther(pending)} ${net.symbol}`);

  if (pending === 0n) {
    console.log(`  Nenhuma taxa para sacar.`);
    return;
  }

  // 2. Saca para a tesouraria
  console.log(`  Sacando do contrato...`);
  const txWithdraw = await contract.withdraw({ gasLimit: 100_000 });
  await txWithdraw.wait(1);
  console.log(`  Saque ok: ${txWithdraw.hash}`);

  // 3. Calcula 90% para distribuir
  const balAposWitdraw = await provider.getBalance(signer.address);
  const fee            = await provider.getFeeData();
  const gasEstimate    = fee.gasPrice * 50_000n; // custo estimado do envio
  const disponivel     = balAposWitdraw - gasEstimate - GAS_RESERVE;

  if (disponivel <= 0n) {
    console.log(`  Saldo insuficiente após reserva de gas — nada distribuído.`);
    return;
  }

  const enviar = (disponivel * DISTRIBUTE_BPS) / BPS_BASE;
  console.log(`  Saldo disponível: ${ethers.formatEther(disponivel)} ${net.symbol}`);
  console.log(`  Enviando 90% (${ethers.formatEther(enviar)} ${net.symbol}) para ${net.destination}`);

  // 4. Envia 90% para carteira de destino
  const txSend = await signer.sendTransaction({
    to:       net.destination,
    value:    enviar,
    gasLimit: 21_000,
  });
  await txSend.wait(1);
  console.log(`  Envio ok: ${txSend.hash}`);

  const balFinal = await provider.getBalance(signer.address);
  console.log(`  Reserva na tesouraria: ${ethers.formatEther(balFinal)} ${net.symbol} (10% + gas)`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   INC Network — Distribuição da Tesouraria   ║");
  console.log("║   90% → carteira destino | 10% → gas/rede    ║");
  console.log("╚══════════════════════════════════════════════╝");

  if (!process.env.TREASURY_PRIVATE_KEY) {
    throw new Error("TREASURY_PRIVATE_KEY não configurada no .env");
  }

  const treasuryWallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY);
  console.log(`\nTesouraria: ${treasuryWallet.address}`);

  for (const net of NETWORKS) {
    try {
      await distributeNetwork(net, treasuryWallet);
    } catch (e) {
      console.log(`  ERRO em ${net.name}: ${e.shortMessage || e.message}`);
    }
  }

  console.log("\n✔ Distribuição concluída.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
