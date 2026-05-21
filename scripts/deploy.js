// scripts/deploy.js
const { ethers } = require("hardhat");

// Endereços dos Chainlink Price Feeds por rede
// IMPORTANTE: verifique todos os endereços em docs.chain.link antes do deploy em produção
const FEEDS = {
  mainnet: {
    "BTC/USDT": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88b",
    "ETH/USDT": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "SOL/USDT": "0x4ffC43a60e009B551865A93d232E33Fce9f01507",
    "BNB/USDT": "0x14e613AC84a31f709eadbEF2dD6360A0f0FC3Af6",
  },
  arbitrum: {
    "BTC/USDT": "0x6ce185539ad4fdaBDFDa9d6e7f0cbE8E1438eF6D",
    "ETH/USDT": "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
  },
  bnb: {
    "BTC/USDT": "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
    "ETH/USDT": "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
    "BNB/USDT": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
  },
  optimism: {
    "BTC/USDT": "0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593",
    "ETH/USDT": "0x13e3Ee699D1909E989722E753853AE30b17e08c5",
  },
  avalanche: {
    "BTC/USDT": "0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743",
    "ETH/USDT": "0x976B3D034E162d8bD72D6b9C989d545b839003b0",
    "AVAX/USDT": "0x0A77230d17318075983913bC2145DB16C7366156",
  },
  polygon: {
    "BTC/USDT": "0xc907E116054Ad103354f2D350FD2514433D57F6f",
    "ETH/USDT": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    "SOL/USDT": "0x10C8264C0935b3B9870013e057f330Ff3e9C56dC",
    "BNB/USDT": "0x82a6c4AF830caa6c97bb504425f6A992840954b2",
  },
  sepolia: {
    "BTC/USDT": "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    "ETH/USDT": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  },
};

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   INC Network — Deploy + Configuração Oracle ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network    = hre.network.name;

  console.log("Rede:    ", network);
  console.log("Deployer:", deployer.address);
  console.log("Saldo:   ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const INC_TREASURY = process.env.INC_TREASURY;
  const INC_OWNER    = process.env.INC_OWNER || deployer.address;

  if (!INC_TREASURY) throw new Error("Defina INC_TREASURY no arquivo .env antes de fazer deploy");
  if (INC_TREASURY === INC_OWNER) throw new Error("INC_TREASURY e INC_OWNER devem ser carteiras diferentes");

  console.log("Treasury (recebe taxas):", INC_TREASURY);
  console.log("Owner    (emergências): ", INC_OWNER);

  // ── DEPLOY ────────────────────────────────────────────────────────────────
  console.log("\nDeployando INCNetwork...");
  const INCNetwork = await ethers.getContractFactory("INCNetwork");
  const contract   = await INCNetwork.deploy(INC_TREASURY, INC_OWNER);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✔ INCNetwork deployado em:", address);

  // ── CONFIGURAÇÃO DOS FEEDS CHAINLINK ──────────────────────────────────────
  const feeds = FEEDS[network];
  if (feeds) {
    console.log("\nConfigurando Chainlink Price Feeds...");
    for (const [pair, feedAddr] of Object.entries(feeds)) {
      const tx = await contract.setPriceFeed(pair, feedAddr);
      await tx.wait();
      console.log(`  ✔ ${pair} => ${feedAddr}`);
    }
  } else {
    console.log(`\n⚠ Nenhum feed configurado para a rede "${network}".`);
    console.log("  Configure manualmente via setPriceFeed() após o deploy.");
  }

  // ── CHAINLINK AUTOMATION ──────────────────────────────────────────────────
  console.log("\n── PRÓXIMOS PASSOS: Chainlink Automation ────────────────────");
  console.log("1. Acesse https://automation.chain.link");
  console.log("2. Clique em 'Register New Upkeep'");
  console.log("3. Selecione 'Custom Logic'");
  console.log("4. Contrato alvo:", address);
  console.log("5. checkData (varrer 20 sinais por vez, a partir do índice 0):");
  console.log("  ", ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"], [0, 20]));
  console.log("6. Financie o Upkeep com LINK");

  console.log("\n── VERIFICAÇÃO NO ETHERSCAN ─────────────────────────────────");
  console.log(`npx hardhat verify --network ${network} ${address} "${INC_TREASURY}" "${INC_OWNER}"`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
