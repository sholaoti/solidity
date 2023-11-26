// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import './AccessControl.sol';
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract ERC721Minting is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl {
    bytes32 internal constant MINTER = keccak256(abi.encode('MINTER'));
    uint256 internal _lastTokenId;

    constructor (
        address ownerAddress,
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        require(ownerAddress != address(0), 'Owner address can not be zero');
        _owner = ownerAddress;
        _grantRole(MINTER, _owner);
    }

    function mint (
        address to,
        string memory tokenUri
    ) external hasRole(MINTER) returns (uint256) {
        _lastTokenId ++;
        _safeMint(to, _lastTokenId, '');
        _setTokenURI(_lastTokenId, tokenUri);
        return _lastTokenId;
    }

    function getLastTokenId () external view returns(uint256) {
        return _lastTokenId;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(
            from,
            to,
            tokenId
        );
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(
            tokenId
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(
            interfaceId
        );
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}