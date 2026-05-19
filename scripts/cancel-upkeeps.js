// scripts/cancel-upkeeps.js — Cancela upkeeps antigos e saca LINK
const { ethers } = require("hardhat");

// Upkeeps a cancelar (antigos — apontavam para contrato v1.3)
const OLD_UPKEEPS = [
  "30272584736006106819135222498325581770119847735504215194734786949589372446626", // original v1.3
  "40010273969942620208390322915276806408142105115751567569672519752542070472831", // registrado por engano (endereço errado)
];

// Chainlink Automation Registry 2.1 — Sepolia
// Fonte: https://docs.chain.link/chainlink-automation/overview/supported-networks
const REGISTRIES = [
  "0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad", // v2.1
  "0x6593c7De001fC8542bB1703532EE1A5aC0749bbD", // v2.0
];

const REGISTRY_ABI = [
  "function cancelUpkeep(uint256 id) external",
  "function withdrawFunds(uint256 id, address to) external",
];

// Registry correto (v2.1 Sepolia — onde cancelamento foi confirmado)
const MAIN_REGISTRY = "0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad";

async function main() {
  const [deployer] = await ethers.getSigners();
  const registry = new ethers.Contract(MAIN_REGISTRY, REGISTRY_ABI, deployer);

  const provider = deployer.provider;
  const block = await provider.getBlockNumber();
  console.log(`Bloco atual: ${block}\n`);

  for (const id of OLD_UPKEEPS) {
    console.log(`Upkeep: ${id.slice(0,20)}...`);
    try {
      const tx = await registry.withdrawFunds(id, deployer.address, { gasLimit: 200000 });
      await tx.wait();
      console.log(`  ✔ LINK sacado para ${deployer.address}`);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("TOO_SOON") || msg.includes("revert")) {
        console.log("  ⏳ Ainda dentro do período de espera (50 blocos).");
        console.log("     Cancellation aconteceu há pouco — tente em alguns minutos.");
      } else {
        console.log(`  ✗ ${msg.slice(0, 80)}`);
      }
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
