// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

interface IERC721Minting {
    function mint (
        address to,
        string memory tokenUri
    ) external returns (uint256);
}