// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "lib/forge-std/src/Test.sol";
import {HATToken} from "../src/HATToken.sol";

contract HATTokenTest is Test {
    HATToken hat;

    function setUp() public {
        hat = new HATToken();
    }

    function test_batchMint() public {
        address[] memory recipients = new address[](3);
        recipients[0] = makeAddr("user1");
        recipients[1] = makeAddr("user2");
        recipients[2] = makeAddr("user3");

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100e18;
        amounts[1] = 200e18;
        amounts[2] = 50e18;

        hat.batchMint(recipients, amounts);

        assertEq(hat.balanceOf(recipients[0]), 100e18);
        assertEq(hat.balanceOf(recipients[1]), 200e18);
        assertEq(hat.balanceOf(recipients[2]), 50e18);
        assertEq(hat.totalSupply(), 350e18);
    }

    function test_batchMint_onlyOwner() public {
        address[] memory recipients = new address[](1);
        recipients[0] = makeAddr("user");
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(makeAddr("notOwner"));
        vm.expectRevert();
        hat.batchMint(recipients, amounts);
    }
}
