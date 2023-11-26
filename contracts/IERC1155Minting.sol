// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

interface IERC1155Minting {
    function mint (
        address to,
        uint256 amount,
        string memory tokenUri
    ) external returns (uint256);
}