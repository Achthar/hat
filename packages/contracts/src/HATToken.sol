// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title HATToken - Human Attention Token
/// @notice Reward token minted to users for verified ad attention. Gas-optimized batch mint.
contract HATToken is ERC20, Ownable {
    event BatchMinted(uint256 recipientCount, uint256 totalMinted);

    error ArrayLengthMismatch();
    error EmptyBatch();

    constructor() ERC20("Human Attention Token", "HAT") Ownable(msg.sender) {}

    /// @notice Batch mint HAT to multiple recipients in a single transaction
    /// @dev Bypasses _mint to avoid N redundant _totalSupply SSTOREs.
    ///      Writes each recipient balance directly (slot 0 mapping) and updates
    ///      _totalSupply (slot 2) exactly once. Storage layout is pinned to
    ///      OpenZeppelin ERC20 v5 (contracts/token/ERC20/ERC20.sol).
    /// @param recipients Array of addresses to mint to
    /// @param amounts Array of amounts to mint (18 decimals)
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        uint256 len = recipients.length;
        if (len == 0) revert EmptyBatch();
        if (len != amounts.length) revert ArrayLengthMismatch();

        uint256 totalMinted;
        for (uint256 i; i < len; ) {
            address to = recipients[i];
            if (to == address(0)) revert ERC20InvalidReceiver(address(0));

            uint256 amt = amounts[i];
            // _balances[to] += amt — mapping at slot 0
            assembly {
                mstore(0x00, to)
                mstore(0x20, 0)
                let slot := keccak256(0x00, 0x40)
                sstore(slot, add(sload(slot), amt))
            }
            emit Transfer(address(0), to, amt);

            totalMinted += amt;
            unchecked { ++i; }
        }

        // Single _totalSupply SSTORE — slot 2 in OZ ERC20 v5
        assembly {
            sstore(2, add(sload(2), totalMinted))
        }

        emit BatchMinted(len, totalMinted);
    }
}
