// scripts/deploy-all.js
// INC Network — Deploy em todas as redes principais
const { ethers, network } = require("hardhat");

const INC_TREASURY = process.env.INC_TREASURY;
if (!INC_TREASURY) throw new Error("INC_TREASURY não definido no .env");

const NETWORKS = [
  { name: "ethereum",  label: "Ethereum Mainnet", explorer: "https://etherscan.io/address/" },
  { name: "arbitrum",  label: "Arbitrum One",     explorer: "https://arbiscan.io/address/" },
  { name: "polygon",   label: "Polygon",           explorer: "https://polygonscan.com/address/" },
  { name: "bnb",       label: "BNB Chain",         explorer: "https://bscscan.com/address/" },
  { name: "optimism",  label: "Optimism",          explorer: "https://optimistic.etherscan.io/address/" },
  { name: "avalanche", label: "Avalanche C-Chain", explorer: "https://snowscan.xyz/address/" },
  { name: "rootstock", label: "Rootstock (BTC)",   explorer: "https://explorer.rsk.co/address/" },
];

const FEEDS = {
  ethereum: {
    "BTC/USDT": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88b",
    "ETH/USDT": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "SOL/USDT": "0x4ffC43a60e009B551865A93d232E33Fce9f01507",
    "BNB/USDT": "0x14e613AC84a31f709eadbEF2dD6360A0f0FC3Af6",
  },
  arbitrum: {
    "BTC/USDT": "0x6ce185539ad4fdaecd7274954aeae3c8d5f2773a",
    "ETH/USDT": "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    "SOL/USDT": "0x24ceA4b8ce57cdA33212aC39Ee00a68539736e28",
    "BNB/USDT": "0x6970460aabF80C5BE983C6b74e5D06dEDCA95D4A",
  },
  polygon: {
    "BTC/USDT": "0xc907E116054Ad103354f2D350FD2514433D57F6f",
    "ETH/USDT": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    "SOL/USDT": "0x10C8264C0935b3B9870013e057f330Ff3e9C56dC",
    "BNB/USDT": "0x82a6c4AF830caa6c97bb504425f6A992840954b2",
  },
  bnb: {
    // BTC e ETH confirmados — adicione SOL e BNB via setPriceFeed() após verificar em docs.chain.link
    "BTC/USDT": "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
    "ETH/USDT": "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
    "BNB/USDT": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
  },
  optimism: {
    // BTC e ETH confirmados — adicione SOL e BNB via setPriceFeed() após verificar em docs.chain.link
    "BTC/USDT": "0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593",
    "ETH/USDT": "0x13e3Ee699D1909E989722E753853AE30b17e08c5",
  },
  avalanche: {
    // BTC e ETH confirmados — adicione SOL e BNB via setPriceFeed() após verificar em docs.chain.link
    "BTC/USDT": "0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743",
    "ETH/USDT": "0x976B3D034E162d8bD72D6b9C989d545b839003b0",
  },
};

async function deployToNetwork() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  const info = NETWORKS.find(n => n.name === net) || { label: net, explorer: "" };

  console.log("\n" + "═".repeat(56));
  console.log(`  Deployando em: ${info.label}`);
  console.log("═".repeat(56));
  console.log(`  Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Saldo    : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("  ⚠ SALDO ZERO — pulando esta rede\n");
    return null;
  }

  console.log(`  Tesouraria INC: ${INC_TREASURY}`);
  console.log("  Deployando contrato...");

  const Factory  = await ethers.getContractFactory("INCNetwork");
  const contract = await Factory.deploy(INC_TREASURY, deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const receipt = await contract.deploymentTransaction().wait();

  console.log(`\n  ✔ CONTRATO DEPLOYADO`);
  console.log(`  Endereço : ${address}`);
  console.log(`  Gas usado: ${receipt.gasUsed.toString()}`);
  console.log(`  Explorer : ${info.explorer}${address}`);

  const feeds = FEEDS[net];
  if (feeds) {
    console.log(`\n  Configurando Chainlink Price Feeds...`);
    for (const [pair, feedAddr] of Object.entries(feeds)) {
      const tx = await contract.setPriceFeed(pair, feedAddr);
      await tx.wait();
      console.log(`    ✔ ${pair} => ${feedAddr}`);
    }
  } else {
    console.log(`\n  ⚠ Nenhum feed mapeado para "${net}" — configure via setPriceFeed() manualmente.`);
  }

  return { network: net, label: info.label, address, explorer: info.explorer, deployer: deployer.address };
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║         INC Network — Multi-Chain Deploy               ║");
  console.log("║         Proof-of-Signal · v1.0                         ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  const result = await deployToNetwork();

  if (result) {
    console.log("\n" + "═".repeat(56));
    console.log("  RESUMO DO DEPLOY");
    console.log("═".repeat(56));
    console.log(`  Rede     : ${result.label}`);
    console.log(`  Endereço : ${result.address}`);
    console.log(`  Tesouraria: ${INC_TREASURY}`);
    console.log(`  Taxa INC : 1.5%`);
    console.log("═".repeat(56));
    console.log("\n  PRÓXIMO PASSO — Verificar código-fonte:");
    console.log(`  npx hardhat verify --network ${result.network} ${result.address} "${INC_TREASURY}" "${result.deployer}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
