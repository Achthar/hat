// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "lib/forge-std/src/Script.sol";
import {PayoutVault} from "../src/PayoutVault.sol";
import {HATToken} from "../src/HATToken.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerKey);

        HATToken hat = new HATToken();
        PayoutVault vault = new PayoutVault(usdc, 250); // 2.5% fee

        vm.stopBroadcast();

        console.log("HATToken deployed at:", address(hat));
        console.log("PayoutVault deployed at:", address(vault));
    }
}
