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

async function main() {
  const [deployer] = await ethers.getSigners();

  for (const id of OLD_UPKEEPS) {
    console.log(`\nUpkeep: ${id.slice(0,20)}...`);
    let cancelled = false;
    for (const regAddr of REGISTRIES) {
      try {
        const registry = new ethers.Contract(regAddr, REGISTRY_ABI, deployer);
        console.log(`  Tentando registry ${regAddr.slice(0,10)}...`);
        const tx = await registry.cancelUpkeep(id, { gasLimit: 200000 });
        await tx.wait();
        console.log(`  ✔ Cancelado no registry ${regAddr.slice(0,10)}...`);
        console.log("  Aguarde ~50 blocos (~10 min) e rode novamente para sacar LINK.");
        cancelled = true;
        break;
      } catch (e) {
        console.log(`  ✗ ${e.message.slice(0, 60)}`);
      }
    }
    if (!cancelled) {
      // Tenta sacar direto (se já foi cancelado antes)
      for (const regAddr of REGISTRIES) {
        try {
          const registry = new ethers.Contract(regAddr, REGISTRY_ABI, deployer);
          const tx = await registry.withdrawFunds(id, deployer.address, { gasLimit: 200000 });
          await tx.wait();
          console.log(`  ✔ LINK sacado do registry ${regAddr.slice(0,10)}...`);
          break;
        } catch (_) {}
      }
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
