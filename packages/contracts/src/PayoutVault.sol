// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title PayoutVault - Advertiser USDC escrow with batch distribution
/// @notice Advertisers deposit USDC. Backend triggers batch payouts to verified human viewers.
contract PayoutVault is Ownable {
    IERC20 public immutable usdc;

    mapping(address => uint256) public deposits;
    uint256 public totalPooled;

    uint256 public feeBps; // platform fee in basis points (max 2000 = 20%)
    uint256 public constant MAX_FEE_BPS = 2000;

    event Deposited(address indexed advertiser, uint256 amount);
    event Withdrawn(address indexed advertiser, uint256 amount);
    event Distributed(address indexed advertiser, address[] recipients, uint256[] amounts, uint256 fee);

    error InsufficientDeposit();
    error ArrayLengthMismatch();
    error FeeTooHigh();

    constructor(address _usdc, uint256 _feeBps) Ownable(msg.sender) {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        usdc = IERC20(_usdc);
        feeBps = _feeBps;
    }

    function deposit(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalPooled += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        if (deposits[msg.sender] < amount) revert InsufficientDeposit();
        deposits[msg.sender] -= amount;
        totalPooled -= amount;
        usdc.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Distribute USDC from an advertiser's deposit to verified viewers
    /// @param advertiser The advertiser whose deposit funds the distribution
    /// @param recipients Array of viewer addresses
    /// @param amounts Array of USDC amounts (6 decimals)
    function distribute(
        address advertiser,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 fee = (total * feeBps) / 10000;
        uint256 required = total + fee;
        if (deposits[advertiser] < required) revert InsufficientDeposit();

        deposits[advertiser] -= required;
        totalPooled -= required;

        for (uint256 i = 0; i < recipients.length; i++) {
            usdc.transfer(recipients[i], amounts[i]);
        }

        if (fee > 0) {
            usdc.transfer(owner(), fee);
        }

        emit Distributed(advertiser, recipients, amounts, fee);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
    }
}
