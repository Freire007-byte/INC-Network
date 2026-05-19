// scripts/create-pool-polygon.js — Pool Uniswap V3 $INC/WMATIC na Polygon
const { ethers } = require("ethers");
require("dotenv").config();

const WMATIC        = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const INC_TOKEN     = "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7";
const FACTORY       = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const POS_MANAGER   = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const FEE           = 10000; // 1%
const MIN_TICK      = -887200;
const MAX_TICK      =  887200;

// WMATIC (0x0d50...) < INC (0xeaa4...) → token0=WMATIC, token1=INC
// Preço: 1 MATIC = 50 INC  →  1 INC = $0.01 @ MATIC=$0.50
const PRICE_INC_PER_MATIC = 50n;

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
const WMATIC_ABI = [
  "function deposit() external payable",
  "function approve(address,uint256) returns (bool)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
];

function sqrtBigInt(n) {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

async function main() {
  const rpc      = process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const maticBal = await provider.getBalance(wallet.address);
  console.log("Carteira  :", wallet.address);
  console.log("MATIC saldo:", ethers.formatEther(maticBal));

  const MATIC_LIQ = ethers.parseEther("6");
  const INC_LIQ   = ethers.parseEther("300");

  const Q96          = 2n ** 96n;
  const sqrtPriceX96 = sqrtBigInt(PRICE_INC_PER_MATIC * Q96 * Q96);

  const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, wallet);
  const wmatic   = new ethers.Contract(WMATIC, WMATIC_ABI, wallet);
  const incToken = new ethers.Contract(INC_TOKEN, ERC20_ABI, wallet);
  const pm       = new ethers.Contract(POS_MANAGER, PM_ABI, wallet);

  // 1. Criar pool
  console.log("\n1. Verificando pool INC/WMATIC 1% na Polygon...");
  let poolAddr = await factory.getPool(WMATIC, INC_TOKEN, FEE);

  if (poolAddr === ethers.ZeroAddress) {
    console.log("   Pool inexistente — criando...");
    const tx = await factory.createPool(WMATIC, INC_TOKEN, FEE);
    await tx.wait();
    poolAddr = await factory.getPool(WMATIC, INC_TOKEN, FEE);
    console.log("   ✔ Pool criado:", poolAddr);
  } else {
    console.log("   Pool existente:", poolAddr);
  }

  // 2. Inicializar preço
  const pool  = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  const slot0 = await pool.slot0();

  if (slot0[0] === 0n) {
    console.log("\n2. Inicializando preço: 1 INC = $0.01 (1 MATIC = 50 INC)...");
    const tx = await pool.initialize(sqrtPriceX96);
    await tx.wait();
    console.log("   ✔ Preço configurado");
  } else {
    console.log("\n2. Pool já tem preço — mantendo preço existente");
  }

  // 3. Wrap MATIC → WMATIC
  console.log("\n3. Convertendo", ethers.formatEther(MATIC_LIQ), "MATIC → WMATIC...");
  await (await wmatic.deposit({ value: MATIC_LIQ })).wait();
  console.log("   ✔ WMATIC ok");

  // 4. Aprovações
  console.log("\n4. Aprovando WMATIC e INC...");
  await (await wmatic.approve(POS_MANAGER, MATIC_LIQ)).wait();
  console.log("   ✔ WMATIC aprovado");
  await (await incToken.approve(POS_MANAGER, INC_LIQ)).wait();
  console.log("   ✔ INC aprovado");

  // 5. Adicionar liquidez
  console.log("\n5. Adicionando liquidez...");
  console.log("   WMATIC:", ethers.formatEther(MATIC_LIQ));
  console.log("   INC   :", ethers.formatUnits(INC_LIQ, 18));

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const tx = await pm.mint({
    token0:         WMATIC,
    token1:         INC_TOKEN,
    fee:            FEE,
    tickLower:      MIN_TICK,
    tickUpper:      MAX_TICK,
    amount0Desired: MATIC_LIQ,
    amount1Desired: INC_LIQ,
    amount0Min:     0n,
    amount1Min:     0n,
    recipient:      wallet.address,
    deadline,
  });

  const receipt = await tx.wait();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Pool de liquidez criado com sucesso!           ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("TX        :", receipt.hash);
  console.log("Pool      :", poolAddr);
  console.log("Preço     : 1 INC = $0.01");
  console.log("Polygonscan:", "https://polygonscan.com/tx/" + receipt.hash);
  console.log("Uniswap   :", "https://app.uniswap.org/explore/pools/polygon/" + poolAddr);
}

main().catch(e => { console.error(e.message); process.exit(1); });
