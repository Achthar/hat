// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "lib/forge-std/src/Test.sol";
import {PayoutVault} from "../src/PayoutVault.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract PayoutVaultTest is Test {
    PayoutVault vault;
    MockUSDC usdc;
    address advertiser = makeAddr("advertiser");
    address viewer1 = makeAddr("viewer1");
    address viewer2 = makeAddr("viewer2");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new PayoutVault(address(usdc), 250); // 2.5%

        usdc.mint(advertiser, 1000e6);
        vm.prank(advertiser);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(advertiser);
        vault.deposit(100e6);
        assertEq(vault.deposits(advertiser), 100e6);
        assertEq(vault.totalPooled(), 100e6);
    }

    function test_distribute() public {
        vm.prank(advertiser);
        vault.deposit(100e6);

        address[] memory recipients = new address[](2);
        recipients[0] = viewer1;
        recipients[1] = viewer2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10e6;
        amounts[1] = 5e6;

        vault.distribute(advertiser, recipients, amounts);

        assertEq(usdc.balanceOf(viewer1), 10e6);
        assertEq(usdc.balanceOf(viewer2), 5e6);
        // 15 USDC distributed + 2.5% fee = 0.375 USDC fee
        assertEq(usdc.balanceOf(address(this)), 0.375e6);
    }

    function test_withdraw() public {
        vm.prank(advertiser);
        vault.deposit(100e6);

        vm.prank(advertiser);
        vault.withdraw(50e6);
        assertEq(vault.deposits(advertiser), 50e6);
    }
}
