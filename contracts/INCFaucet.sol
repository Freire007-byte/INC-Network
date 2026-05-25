// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Distribui 100 INC por carteira (uma vez por endereço)
contract INCFaucet is Ownable2Step {
    IERC20 public immutable token;
    uint256 public claimAmount = 100 * 1e18;
    mapping(address => bool) public claimed;

    event Claimed(address indexed user, uint256 amount);
    event AmountUpdated(uint256 newAmount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function claim() external {
        require(!claimed[msg.sender], "Ja reivindicado");
        require(token.balanceOf(address(this)) >= claimAmount, "Faucet sem saldo");
        claimed[msg.sender] = true;
        token.transfer(msg.sender, claimAmount);
        emit Claimed(msg.sender, claimAmount);
    }

    function setClaimAmount(uint256 amount) external onlyOwner {
        claimAmount = amount;
        emit AmountUpdated(amount);
    }

    function withdraw(uint256 amount) external onlyOwner {
        token.transfer(owner(), amount);
    }

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
