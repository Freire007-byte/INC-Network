// scripts/wire-contracts.js
// ══════════════════════════════════════════════════════════════
// Conecta INCToken v2 ↔ INCNetwork v1.5 após ambos deployados
//
// Executa:
//   1. INCToken.setNetworkContract(networkAddr)   → unlock via INCNetwork
//   2. INCNetwork.setIncToken(tokenAddr)           → desbloqueia token no followSignal/createSignal
//
// USO:
//   npx hardhat run scripts/wire-contracts.js --network polygon
//
// .env necessário:
//   INC_NETWORK_<CHAIN>   endereço do INCNetwork já deployado
//   INC_TOKEN_<CHAIN>     endereço do INCToken já deployado
//   (onde <CHAIN> = POLYGON | ARBITRUM | AVALANCHE | SEPOLIA)
// ══════════════════════════════════════════════════════════════

const hre = require("hardhat");

const ADDRESSES = {
  polygon: {
    network: process.env.INC_CONTRACT_POLYGON  || "0xf49841DF7726691D04D311BC4A0821C0AB9211f5",
    token:   process.env.INC_TOKEN_POLYGON     || "",
  },
  arbitrum: {
    network: process.env.INC_CONTRACT_ARBITRUM || "0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745",
    token:   process.env.INC_TOKEN_ARBITRUM    || "",
  },
  avalanche: {
    network: process.env.INC_CONTRACT_AVALANCHE || "0x55413bF29C5b2c7EE54333fD09382f13Ca081593",
    token:   process.env.INC_TOKEN_AVALANCHE    || "",
  },
  sepolia: {
    network: process.env.INC_CONTRACT_SEPOLIA  || "0x99ABa0D947367ABC96dDc612C6e407954aC46836",
    token:   process.env.INC_TOKEN_SEPOLIA     || "",
  },
  incchain: {
    network: process.env.INC_CONTRACT_INCCHAIN || "0x078cE5595677BF5699F941730485F9635f09aA2A",
    token:   process.env.INC_TOKEN_INCCHAIN    || "0x528c7a78d5a171063C6043d1872dDa2c887a17E7",
  },
};

const NETWORK_ABI = [
  "function setIncToken(address token) external",
  "function incTokenContract() view returns (address)",
];

const TOKEN_ABI = [
  "function setNetworkContract(address network) external",
  "function incNetworkContract() view returns (address)",
  "function isWhitelisted(address) view returns (bool)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const netName    = hre.network.name;
  const cfg        = ADDRESSES[netName];

  if (!cfg) {
    console.error(`Rede "${netName}" não configurada. Use: polygon | arbitrum | avalanche | sepolia`);
    process.exit(1);
  }

  if (!cfg.token) {
    console.error(`INC_TOKEN_${netName.toUpperCase()} não definido no .env — deploy INCToken primeiro.`);
    process.exit(1);
  }

  console.log(`\n◈ INC Network — Wire Contracts`);
  console.log(`  Rede       : ${netName}`);
  console.log(`  Deployer   : ${deployer.address}`);
  console.log(`  INCNetwork : ${cfg.network}`);
  console.log(`  INCToken   : ${cfg.token}\n`);

  const network = new hre.ethers.Contract(cfg.network, NETWORK_ABI, deployer);
  const token   = new hre.ethers.Contract(cfg.token,   TOKEN_ABI,   deployer);

  // 1. INCToken.setNetworkContract
  const currentNet = await token.incNetworkContract();
  if (currentNet.toLowerCase() === cfg.network.toLowerCase()) {
    console.log("  ✓ INCToken.incNetworkContract já configurado — pulando");
  } else {
    console.log("  → INCToken.setNetworkContract(networkAddr)...");
    const tx1 = await token.setNetworkContract(cfg.network);
    await tx1.wait();
    console.log(`  ✓ Configurado. TX: ${tx1.hash}`);
  }

  // 2. INCNetwork.setIncToken (opcional — versões antigas do INCNetwork não têm esta função)
  let tokenInNet = null;
  try {
    const currentToken = await network.incTokenContract();
    if (currentToken.toLowerCase() === cfg.token.toLowerCase()) {
      console.log("  ✓ INCNetwork.incTokenContract já configurado — pulando");
      tokenInNet = currentToken;
    } else {
      console.log("  → INCNetwork.setIncToken(tokenAddr)...");
      const tx2 = await network.setIncToken(cfg.token);
      await tx2.wait();
      tokenInNet = cfg.token;
      console.log(`  ✓ Configurado. TX: ${tx2.hash}`);
    }
  } catch {
    console.log("  ⚠ INCNetwork não suporta setIncToken() (versão antiga) — pulando");
    console.log("    O unlock automático via selfUnlock() e lazy-unlock continuam funcionando.");
  }

  // Verificação final
  const netInToken     = await token.incNetworkContract();
  const netWhitelisted = await token.isWhitelisted(cfg.network);

  console.log("\n  ── Verificação ───────────────────────────────────");
  console.log(`  token.incNetworkContract  : ${netInToken}`);
  console.log(`  network.incTokenContract  : ${tokenInNet ?? "N/A (versão antiga)"}`);
  console.log(`  network whitelisted?      : ${netWhitelisted}`);

  const ok = netInToken.toLowerCase() === cfg.network.toLowerCase() && netWhitelisted;

  if (ok) {
    console.log("\n  ✅ Contratos conectados com sucesso!\n");
  } else {
    console.error("\n  ❌ Verificação falhou — revise os endereços\n");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
