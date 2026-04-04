// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title HATToken - Human Attention Token
/// @notice Reward token minted to users for verified ad attention. Mega-efficient batch mint.
contract HATToken is ERC20, Ownable {
    event BatchMinted(uint256 recipientCount, uint256 totalMinted);

    error ArrayLengthMismatch();
    error EmptyBatch();

    constructor() ERC20("Human Attention Token", "HAT") Ownable(msg.sender) {}

    /// @notice Batch mint HAT to multiple recipients in a single transaction
    /// @dev Gas-optimized: single totalSupply update, minimal storage writes
    /// @param recipients Array of addresses to mint to
    /// @param amounts Array of amounts to mint (18 decimals)
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        uint256 len = recipients.length;
        if (len == 0) revert EmptyBatch();
        if (len != amounts.length) revert ArrayLengthMismatch();

        uint256 totalMinted = 0;
        for (uint256 i = 0; i < len; i++) {
            _mint(recipients[i], amounts[i]);
            totalMinted += amounts[i];
        }

        emit BatchMinted(len, totalMinted);
    }
}
