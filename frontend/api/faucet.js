const { ethers } = require('ethers');

const AMOUNT = ethers.utils.parseEther('100');
const TOKEN_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)'
];

const NETS = {
  137:   { rpc: 'https://polygon-bor-rpc.publicnode.com',       token: '0x4EC0c1c9C708A51712fD6cCaFd107299bBe30a51' },
  42161: { rpc: 'https://arb1.arbitrum.io/rpc',                 token: '0xEaa8383593972b621Cb4Ed7E049db167e5fCC1C3' },
  43114: { rpc: 'https://api.avax.network/ext/bc/C/rpc',        token: '0x672CA0c46ED2E00a1bb8E57Cb1F6b3d74d7BAf54' },
  11155111: { rpc: 'https://rpc.sepolia.org',                   token: '0x4249152E9c372B3968fEDCE1A05D093456CbFEC8' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://incnetwork.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address, chainId } = req.body || {};
  if (!address || !ethers.utils.isAddress(address))
    return res.status(400).json({ error: 'Endereço inválido' });

  const net = NETS[Number(chainId)] || NETS[137];
  const key = process.env.FAUCET_PRIVATE_KEY;
  if (!key) return res.status(500).json({ error: 'Faucet não configurado' });

  try {
    const provider = new ethers.providers.JsonRpcProvider(net.rpc);
    const wallet   = new ethers.Wallet(key, provider);
    const token    = new ethers.Contract(net.token, TOKEN_ABI, wallet);

    const bal = await token.balanceOf(address);
    if (bal.gte(AMOUNT))
      return res.status(400).json({ error: 'already_claimed', msg: 'Endereço já possui INC' });

    const tx = await token.transfer(address, AMOUNT, { gasLimit: 120000 });

    return res.status(200).json({ success: true, txHash: tx.hash, amount: '100' });
  } catch (e) {
    const msg = e.reason || e.message || 'Erro desconhecido';
    return res.status(500).json({ error: msg });
  }
}
