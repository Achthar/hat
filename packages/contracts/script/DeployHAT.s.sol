// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "lib/forge-std/src/Script.sol";
import {HATToken} from "../src/HATToken.sol";

contract DeployHAT is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        HATToken hat = new HATToken();
        vm.stopBroadcast();

        console.log("HATToken deployed at:", address(hat));
    }
}
