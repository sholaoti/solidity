// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import './AccessControl.sol';
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155Minting is ERC1155, AccessControl {
    bytes32 internal constant MINTER = keccak256(abi.encode('MINTER'));
    uint256 internal _lastTokenId;
    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;

    constructor (
        address ownerAddress,
        string memory baseUri
    ) ERC1155(baseUri) {
        require(ownerAddress != address(0), 'Owner address can not be zero');
        _owner = ownerAddress;
        _grantRole(MINTER, _owner);
    }

    function mint (
        address to,
        uint256 amount,
        string memory tokenUri
    ) external hasRole(MINTER) returns (uint256) {
        _lastTokenId ++;
        _mint(to, _lastTokenId, amount, '');
        _tokenURIs[_lastTokenId] = tokenUri;
        return _lastTokenId;
    }

    function mintBatch (
        address to,
        uint256[] memory amounts,
        string[] memory tokenUris
    ) external hasRole(MINTER) returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](amounts.length);
        for (uint256 i; i < amounts.length; i ++) {
            _lastTokenId ++;
            tokenIds[i] = _lastTokenId;
            if (i >= tokenUris.length) continue;
            _tokenURIs[tokenIds[i]] = tokenUris[i];
        }
        _mintBatch(to, tokenIds, amounts, '');
        return tokenIds;
    }

    function uri (
        uint256 tokenId
    ) public view override returns (string memory) {
        if (bytes(_tokenURIs[tokenId]).length == 0) return super.uri(tokenId);
        return _tokenURIs[tokenId];
    }

    /**
     * @dev Sets `tokenUri` as the tokenURI of `tokenId`.
     */
    function setTokenURI (
        uint256 tokenId, string memory tokenUri
    ) public hasRole(MINTER) returns (bool) {
        _tokenURIs[tokenId] = tokenUri;
        return true;
    }

    function getLastTokenId () external view returns(uint256) {
        return _lastTokenId;
    }
}