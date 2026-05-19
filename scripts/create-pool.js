// scripts/create-pool.js — Cria pool Uniswap V3 $INC/WETH na Arbitrum
const { ethers } = require("ethers");
require("dotenv").config();

const WETH          = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const INC_TOKEN     = "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7";
const FACTORY       = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const POS_MANAGER   = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const FEE           = 10000; // 1%
const TICK_SPACING  = 200;
const MIN_TICK      = -887200;
const MAX_TICK      =  887200;

// WETH (0x82af...) < INC (0xeaa4...) → token0=WETH, token1=INC
// Preço: 1 ETH = 300,000 INC  →  1 INC = $0.01 @ ETH=$3000
const PRICE_INC_PER_ETH = 300_000n;

const FACTORY_ABI = [
  "function createPool(address,address,uint24) returns (address)",
  "function getPool(address,address,uint24) view returns (address)",
];
const POOL_ABI = [
  "function initialize(uint160 sqrtPriceX96) external",
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
];
const PM_ABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) external payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
];
const WETH_ABI = [
  "function deposit() external payable",
  "function approve(address,uint256) returns (bool)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

function sqrtBigInt(n) {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

async function main() {
  const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const ethBal = await provider.getBalance(wallet.address);
  console.log("Carteira :", wallet.address);
  console.log("ETH saldo:", ethers.formatEther(ethBal));

  // Reserva 0.002 ETH para gas
  const ETH_LIQ  = ethers.parseEther("0.008");
  const INC_LIQ  = ethers.parseEther("2400");

  // sqrtPriceX96 = sqrt(price) * 2^96   (price = token1/token0 = INC/WETH = 300,000)
  const Q96          = 2n ** 96n;
  const sqrtPriceX96 = sqrtBigInt(PRICE_INC_PER_ETH * Q96 * Q96);

  const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, wallet);
  const weth     = new ethers.Contract(WETH, WETH_ABI, wallet);
  const incToken = new ethers.Contract(INC_TOKEN, ERC20_ABI, wallet);
  const pm       = new ethers.Contract(POS_MANAGER, PM_ABI, wallet);

  // 1. Criar pool (se não existir)
  console.log("\n1. Verificando pool INC/WETH 1% na Arbitrum...");
  let poolAddr = await factory.getPool(WETH, INC_TOKEN, FEE);

  if (poolAddr === ethers.ZeroAddress) {
    console.log("   Pool inexistente — criando...");
    const tx = await factory.createPool(WETH, INC_TOKEN, FEE);
    await tx.wait();
    poolAddr = await factory.getPool(WETH, INC_TOKEN, FEE);
    console.log("   ✔ Pool criado:", poolAddr);
  } else {
    console.log("   Pool existente:", poolAddr);
  }

  // 2. Inicializar preço (se não inicializado)
  const pool  = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  const slot0 = await pool.slot0();
  const currentSqrt = slot0[0];

  if (currentSqrt === 0n) {
    console.log("\n2. Inicializando preço: 1 INC = $0.01 (1 ETH = 300.000 INC)...");
    const tx = await pool.initialize(sqrtPriceX96);
    await tx.wait();
    console.log("   ✔ Preço configurado");
  } else {
    console.log("\n2. Pool já tem preço — mantendo preço existente");
  }

  // 3. Wrap ETH → WETH
  console.log("\n3. Convertendo", ethers.formatEther(ETH_LIQ), "ETH → WETH...");
  await (await weth.deposit({ value: ETH_LIQ })).wait();
  console.log("   ✔ WETH ok");

  // 4. Aprovações
  console.log("\n4. Aprovando WETH e INC para o Position Manager...");
  await (await weth.approve(POS_MANAGER, ETH_LIQ)).wait();
  console.log("   ✔ WETH aprovado");
  await (await incToken.approve(POS_MANAGER, INC_LIQ)).wait();
  console.log("   ✔ INC aprovado");

  // 5. Adicionar liquidez (range completo)
  console.log("\n5. Adicionando liquidez...");
  console.log("   WETH :", ethers.formatEther(ETH_LIQ));
  console.log("   INC  :", ethers.formatUnits(INC_LIQ, 18));
  console.log("   Range: tick", MIN_TICK, "→", MAX_TICK, "(range completo)");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const tx = await pm.mint({
    token0:          WETH,
    token1:          INC_TOKEN,
    fee:             FEE,
    tickLower:       MIN_TICK,
    tickUpper:       MAX_TICK,
    amount0Desired:  ETH_LIQ,
    amount1Desired:  INC_LIQ,
    amount0Min:      0n,
    amount1Min:      0n,
    recipient:       wallet.address,
    deadline,
  });

  const receipt = await tx.wait();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Pool de liquidez criado com sucesso!           ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("TX      :", receipt.hash);
  console.log("Pool    :", poolAddr);
  console.log("Preço   : 1 INC = $0.01");
  console.log("Arbiscan:", "https://arbiscan.io/tx/" + receipt.hash);
  console.log("Uniswap :", "https://app.uniswap.org/explore/pools/arbitrum/" + poolAddr);
}

main().catch(e => { console.error(e.message); process.exit(1); });
