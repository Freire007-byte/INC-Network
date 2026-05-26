// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              INC NETWORK — Utility Token $INC               ║
 * ║              ERC-20 · Fixed Supply · Multichain             ║
 * ║              v2.0 — Participation Lock                      ║
 * ║                                                              ║
 * ║  Supply: 100,000,000 INC                                    ║
 * ║  Distribution:                                              ║
 * ║    40% Ecosystem / Protocol Rewards                         ║
 * ║    20% Team (vested)                                        ║
 * ║    20% Liquidity (DEX)                                      ║
 * ║    10% Treasury                                             ║
 * ║    10% IDO / Community Sale                                 ║
 * ║                                                              ║
 * ║  PARTICIPATION LOCK:                                        ║
 * ║    Tokens recebidos por endereços comuns só podem ser        ║
 * ║    transferidos após o endereço interagir com o protocolo   ║
 * ║    INC Network (criar ou seguir pelo menos 1 sinal).        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Interface mínima do INCNetwork para verificar participação
interface IINCNetwork {
    function providerTotalSignals(address user) external view returns (uint256);
    function followerTotalStaked(address user) external view returns (uint256);
}

contract INCToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable2Step {

    // ── SUPPLY ──────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    // ── ALLOCATION WALLETS (imutáveis) ──────────────────────────
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

    // ── PARTICIPATION LOCK ──────────────────────────────────────

    /// @notice Lock ativo ou desativado (emergência: owner pode desligar)
    bool public lockEnabled = true;

    /// @notice Endereços que podem transferir sem restrição (wallets de alocação, DEX, bridges)
    mapping(address => bool) public isWhitelisted;

    /// @notice Endereço do contrato INCNetwork nesta rede (quem chama unlockAddress)
    address public incNetworkContract;

    /// @notice Endereços que já participaram e tiveram o lock liberado
    mapping(address => bool) public isUnlocked;

    // ── EVENTS ──────────────────────────────────────────────────
    event TokensBurned(address indexed burner, uint256 amount);
    event AddressUnlocked(address indexed user);
    event Whitelisted(address indexed addr, bool status);
    event LockToggled(bool enabled);
    event NetworkContractSet(address indexed network);

    // ── ERRORS ──────────────────────────────────────────────────
    error TokensLocked(address sender);

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

        // Wallets de alocação são automaticamente whitelisted (podem distribuir livremente)
        isWhitelisted[_ecosystemWallet] = true;
        isWhitelisted[_teamWallet]      = true;
        isWhitelisted[_liquidityWallet] = true;
        isWhitelisted[_treasuryWallet]  = true;
        isWhitelisted[_idoWallet]       = true;
        isWhitelisted[msg.sender]       = true; // deployer

        // Mint fixed supply e distribui imediatamente
        _mint(_ecosystemWallet, ECOSYSTEM);
        _mint(_teamWallet,      TEAM);
        _mint(_liquidityWallet, LIQUIDITY);
        _mint(_treasuryWallet,  TREASURY);
        _mint(_idoWallet,       IDO);
    }

    // ── PAUSE ────────────────────────────────────────────────────
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── PARTICIPATION LOCK — ADMIN ────────────────────────────────

    /// @notice Define o contrato INCNetwork que pode desbloquear endereços
    function setNetworkContract(address network) external onlyOwner {
        require(network != address(0), "INC: zero address");
        incNetworkContract = network;
        // O contrato INCNetwork é automaticamente whitelisted (precisa mover tokens para taxas etc.)
        isWhitelisted[network] = true;
        emit NetworkContractSet(network);
    }

    /// @notice Adiciona ou remove endereço da whitelist (DEX pools, bridges, CEXs)
    function setWhitelisted(address addr, bool status) external onlyOwner {
        require(addr != address(0), "INC: zero address");
        isWhitelisted[addr] = status;
        emit Whitelisted(addr, status);
    }

    /// @notice Batch whitelist para múltiplos endereços (ex: vários pools de DEX)
    function batchWhitelist(address[] calldata addrs, bool status) external onlyOwner {
        require(addrs.length <= 200, "INC: batch muito grande");
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] != address(0)) {
                isWhitelisted[addrs[i]] = status;
                emit Whitelisted(addrs[i], status);
            }
        }
    }

    /// @notice Liga/desliga o lock de participação (emergência)
    function setLockEnabled(bool enabled) external onlyOwner {
        lockEnabled = enabled;
        emit LockToggled(enabled);
    }

    // ── PARTICIPATION LOCK — UNLOCK ───────────────────────────────

    /**
     * @notice Desbloqueia um endereço para transferências.
     * @dev    Chamado pelo contrato INCNetwork quando o usuário cria ou segue um sinal.
     *         Também pode ser chamado pelo owner (ex: migração, suporte).
     */
    function unlockAddress(address user) external {
        require(
            msg.sender == incNetworkContract || msg.sender == owner(),
            "INC: apenas o contrato INCNetwork ou owner pode desbloquear"
        );
        require(user != address(0), "INC: zero address");
        if (!isUnlocked[user]) {
            isUnlocked[user] = true;
            emit AddressUnlocked(user);
        }
    }

    /**
     * @notice Desbloqueia o próprio endereço provando participação via leitura do INCNetwork.
     * @dev    Qualquer usuário pode chamar se o incNetworkContract estiver configurado
     *         e eles tiverem participação registrada on-chain.
     *         Isso elimina dependência de chamada ativa do INCNetwork.
     */
    function selfUnlock() external {
        require(incNetworkContract != address(0), "INC: contrato INCNetwork nao configurado");
        IINCNetwork net = IINCNetwork(incNetworkContract);
        bool participated =
            net.providerTotalSignals(msg.sender) > 0 ||
            net.followerTotalStaked(msg.sender)  > 0;
        require(participated, "INC: participe do protocolo INC para desbloquear");
        if (!isUnlocked[msg.sender]) {
            isUnlocked[msg.sender] = true;
            emit AddressUnlocked(msg.sender);
        }
    }

    /**
     * @notice Verifica se um endereço pode fazer transferências.
     */
    function canTransfer(address user) external view returns (bool) {
        if (!lockEnabled)           return true;
        if (isWhitelisted[user])    return true;
        if (isUnlocked[user])       return true;
        // Verifica on-chain se participou (sem precisar chamar unlockAddress antes)
        if (incNetworkContract != address(0)) {
            try IINCNetwork(incNetworkContract).providerTotalSignals(user) returns (uint256 n) {
                if (n > 0) return true;
            } catch {}
            try IINCNetwork(incNetworkContract).followerTotalStaked(user) returns (uint256 s) {
                if (s > 0) return true;
            } catch {}
        }
        return false;
    }

    // ── OVERRIDE _update ─────────────────────────────────────────

    /**
     * @dev Aplicação do lock de participação.
     *
     *      Regras:
     *        1. Mint (from == 0)         → sempre permitido
     *        2. Endereço whitelisted     → sempre permitido
     *        3. Endereço unlocked        → permitido
     *        4. Participação on-chain    → verifica IINCNetwork se configurado
     *        5. Caso contrário           → revert TokensLocked
     */
    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Pausable)
    {
        if (lockEnabled && from != address(0) && !isWhitelisted[from] && !isUnlocked[from]) {
            // Última chance: verifica participação on-chain (lazy unlock)
            bool participated = false;
            if (incNetworkContract != address(0)) {
                try IINCNetwork(incNetworkContract).providerTotalSignals(from) returns (uint256 n) {
                    if (n > 0) participated = true;
                } catch {}
                if (!participated) {
                    try IINCNetwork(incNetworkContract).followerTotalStaked(from) returns (uint256 s) {
                        if (s > 0) participated = true;
                    } catch {}
                }
            }
            if (!participated) revert TokensLocked(from);
            // Auto-unlock para não repetir a chamada cross-contract nas próximas txs
            isUnlocked[from] = true;
            emit AddressUnlocked(from);
        }

        super._update(from, to, value);
        if (to == address(0)) emit TokensBurned(from, value);
    }
}
