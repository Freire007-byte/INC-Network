// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              INC NETWORK — Utility Token $INC               ║
 * ║              ERC-20 · Fixed Supply · Multichain             ║
 * ║                                                              ║
 * ║  Supply: 100,000,000 INC                                    ║
 * ║  Distribution:                                              ║
 * ║    40% Ecosystem / Protocol Rewards                         ║
 * ║    20% Team (vested)                                        ║
 * ║    20% Liquidity (DEX)                                      ║
 * ║    10% Treasury                                             ║
 * ║    10% IDO / Community Sale                                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract INCToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable2Step {

    // ── SUPPLY ──────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    // ── ALLOCATION WALLETS ──────────────────────────────────────
    address public immutable ecosystemWallet;
    address public immutable teamWallet;
    address public immutable liquidityWallet;
    address public immutable treasuryWallet;
    address public immutable idoWallet;

    // ── ALLOCATION AMOUNTS ──────────────────────────────────────
    uint256 public constant ECOSYSTEM  = 40_000_000 * 1e18;  // 40%
    uint256 public constant TEAM       = 20_000_000 * 1e18;  // 20%
    uint256 public constant LIQUIDITY  = 20_000_000 * 1e18;  // 20%
    uint256 public constant TREASURY   = 10_000_000 * 1e18;  // 10%
    uint256 public constant IDO        = 10_000_000 * 1e18;  // 10%

    // ── EVENTS ──────────────────────────────────────────────────
    event TokensBurned(address indexed burner, uint256 amount);

    // ── CONSTRUCTOR ─────────────────────────────────────────────
    constructor(
        address _ecosystemWallet,
        address _teamWallet,
        address _liquidityWallet,
        address _treasuryWallet,
        address _idoWallet
    )
        ERC20("INC Network Token", "INC")
        Ownable(msg.sender)
    {
        require(_ecosystemWallet != address(0), "ecosystem: zero");
        require(_teamWallet      != address(0), "team: zero");
        require(_liquidityWallet != address(0), "liquidity: zero");
        require(_treasuryWallet  != address(0), "treasury: zero");
        require(_idoWallet       != address(0), "ido: zero");

        ecosystemWallet  = _ecosystemWallet;
        teamWallet       = _teamWallet;
        liquidityWallet  = _liquidityWallet;
        treasuryWallet   = _treasuryWallet;
        idoWallet        = _idoWallet;

        // Mint fixed supply and distribute immediately
        _mint(_ecosystemWallet, ECOSYSTEM);
        _mint(_teamWallet,      TEAM);
        _mint(_liquidityWallet, LIQUIDITY);
        _mint(_treasuryWallet,  TREASURY);
        _mint(_idoWallet,       IDO);
    }

    // ── PAUSE ────────────────────────────────────────────────────
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── REQUIRED OVERRIDE ────────────────────────────────────────
    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
        if (to == address(0)) emit TokensBurned(from, value);
    }
}
