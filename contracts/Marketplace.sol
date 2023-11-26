// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.7.0) (token/ERC20/ERC20.sol)

pragma solidity 0.8.2;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol';
import './AccessControl.sol';
import './TransferHelper.sol';
import './IERC721Minting.sol';
import './IERC1155Minting.sol';
import 'hardhat/console.sol';

/**
 * @dev Marketplace for selling existing tokens (contract acts as escrow) and non-existing
 * tokens (contract mints token with specified tokenUri when it is paid for).
 * Tokens can be sold via offer with fixed price or via auction
 * Error messages:
 * 0.1 Sale is not found
 * 0.2 Sale is completed
 * 0.3 Sale is already cancelled
 * 0.4 Auction is already started
 * 1.1 Owner address can not be zero
 * 1.2 Fee receiver address can not be zero
 * 1.3 Fee percentage should be less than 100%
 * 2.1 Fee receiver address can not be zero
 * 3.1 Fee percentage should be less than 100%
 * 4.1 Price should be greater than zero
 * 4.1.1 Lot data error
 * 4.1.2 Start time should not be in the past
 * 4.1.3 End time should be greater than start time
 * 4.1.4 Step should be greater than zero
 * 4.1.5 Start bid should be greater than zero
 * 4.2 Amount should be greater than zero
 * 4.3 Payment address is not allowed
 * 4.4 Contract does not support neither ERC721 nor ERC1155 standards
 * 4.5 Unrecognized contract address for minting tokens
 * 4.6 Token uri is not defined
 * 5.1 The value for buying at once should be greater than the start bid
 * 5.2 Percent of the single payment value should be less than 100%
 * 6.1 Paid amount does not match
 * 7.1 Fixed price can not be set for auction
 * 7.2 Price should be greater than zero
 * 8.1 Parameters can not be set for fixed price sale record
 * 8.2 Start time should not be in the past
 * 8.3 End time should be greater than start time
 * 9.1 Parameters can not be set for fixed price sale record
 * 9.2 Step should be greater than zero
 * 10.1 Parameters can not be set for fixed price sale record
 * 10.2 Start bid should be greater than zero
 * 11.1 Parameters can not be set for fixed price sale record
 * 11.2 The value for buying at once should be greater than the start bid
 * 11.3 Percent of the single payment value should be less than 100%
 * 13.1 Sale is not found
 * 13.2 Sale is completed
 * 13.3 Sale is cancelled
 * 13.4 This is an auction. Use bid() function instead
 * 14.1 Sale is not found
 * 14.2 Sale is completed
 * 14.3 Sale is cancelled
 * 14.4 This is not an auction, use buy() function instead
 * 14.5 Auction is not started yet
 * 14.6 Current auction is over
 * 14.7 Lot step requirements does not met
 * 14.8 Lot startBid requirements does not met
 * 15.1 The lot with this id does not exist
 * 15.2 The lot with this id is cancelled
 * 15.3 The lot with this id is already completed
 * 15.4 Auction is not over yet
 */
contract Marketplace is AccessControl, ReentrancyGuard {
    event SaleModified (
        uint256 indexed saleId,
        bytes32 action
    );
    event Bid (
        uint256 indexed saleId,
        uint256 amount,
        address bidder
    );
    modifier CanModify (
        uint256 saleId
    ) {
        require(msg.sender == _sales[saleId].sellerAddress, '0.1');
        require(_sales[saleId].completedAt == 0, '0.2');
        require(_sales[saleId].cancelledAt == 0, '0.3');
        if (isAuction(saleId)) {
            require(_sales[saleId].startTime > block.timestamp, '0.4');
        }
        _;
    }

    struct Sale {
        address sellerAddress;
        address buyerAddress;
        address tokenAddress;  // for existing tokens - token contract address,
        // for non-existing tokens - minting contract address (they should be set in
        // the website config and approved in this contract with setMintingContract() )
        address paymentAddress; // payment contract address address(0) for native currency
        // (payment token contracts should be set in the website config and allowed in
        // this contract with setPaymentContract() )
        uint256 price; // fixed price for non-auction sale record
        uint256 tokenId; // token id to be sold, if == 0 it will be minted when paid
        uint256 amount; // token amount should be == 1 for erc721 or > 0 for erc1155
        uint256 createdAt; // creation time, used as flag that sale record exists
        uint256 completedAt; // completing time, used as flag that sale record is completed
        uint256 cancelledAt; // cancelling time, used as flag that sale record is completed
        string tokenUri; // should be specified for non-existing tokens (tokenId == 0)
        // token will be minted when paid with this tokenUri, tokenId will be defined by
        // minting contract (increment)

        // lot data (if auction)
        uint256 startTime; // start time
        uint256 endTime; // end time
        uint256 step; // minimal diff between last bid and a new bid
        uint256 startBid; // minimal value for a first bid
        uint256 lastBid; // value of the last bid, zero at the beginning
        uint256 singlePaymentValue; // Value of a single payment for buying at once
        uint256 singlePaymentPercent; // If last bid exceeds defined percent of the
        // singlePaymentValue, buying at once is not allowed
        address lastBidSender; // address of the last bid sender
    }

    mapping(uint256 => Sale) internal _sales; // sales records
    uint256 internal _salesNumber; // number of sales records
    mapping(address => bool) internal _erc1155; // true if token supports ERC1155 interface
    mapping(address => bool) internal _mintingContract; // true for minting contracts
    mapping(address => bool) internal _paymentAddresses; // allowed payment tokens addresses
    address internal _feeReceiver; // address for a fee receiving
    uint256 internal _fee; // percents * 100

    uint256 internal constant DECIMALS = 10000;
    bytes32 internal constant MANAGER = keccak256(abi.encode('MANAGER'));

    constructor (
        address newOwner,
        address feeReceiver,
        uint256 fee
    ) {
        require(newOwner != address(0), '1.1');
        require(feeReceiver != address(0), '1.2');
        require(fee < DECIMALS, '1.3');
        _owner = newOwner;
        _grantRole(MANAGER, newOwner);
        _feeReceiver = feeReceiver;
        _fee = fee;
    }

    /**
     * @dev Set fee receiver address
     */
    function setFeeReceiverAddress (
        address feeReceiver
    ) external hasRole(MANAGER) returns (bool) {
        require(feeReceiver != address(0), '2.1');
        _feeReceiver = feeReceiver;
        return true;
    }

    /**
     * @dev Set fee percentage
     */
    function setFee (
        uint256 fee
    ) external hasRole(MANAGER) returns (bool) {
        require(fee < DECIMALS, '3.1');
        _fee = fee;
        return true;
    }

    /**
     * @dev Allow minting contracts addresses to be used for minting non-existing tokens
     */
    function setMintingContract (
        address contractAddress,
        bool isMintingContract
    ) external hasRole(MANAGER) returns (bool) {
        _mintingContract[contractAddress] = isMintingContract;
        return true;
    }

    /**
     * @dev Allow payment contracts addresses to be used for payment
     */
    function setPaymentContract (
        address contractAddress,
        bool allowed
    ) external hasRole(MANAGER) returns (bool) {
        _paymentAddresses[contractAddress] = allowed;
        return true;
    }

    /**
     * @dev Create sale record for both existing and non-existing tokens (erc721, erc1155)
     * lotData array consists of:
     * 0 startTime
     * 1 endTime
     * 2 step
     * 3 startBid
     * 4 singlePaymentValue
     * 5 singlePaymentPercent
     * [] for fixed price (non-auction) record
     */
    function createSaleRecord (
        address tokenAddress,
        address paymentAddress,
        uint256 price,
        uint256 tokenId,
        uint256 amount,
        string memory tokenUri,
        uint256[] calldata lotData
    ) external returns (bool) {
        IERC165 contractInstance = IERC165(tokenAddress);
        if (lotData.length == 0) {
            require(price > 0, '4.1');
        } else {
            price = 0;
            require(lotData.length == 6, '4.1.1');
            require (lotData[0] >= block.timestamp, '4.1.2');
            require (lotData[1] > lotData[0], '4.1.3');
            require (lotData[2] > 0, '4.1.4');
            require (lotData[3] > 0, '4.1.5');
        }
        require(amount > 0, '4.2');
        require(
            paymentAddress == address(0) || _paymentAddresses[paymentAddress], '4.3'
        );
        if (contractInstance.supportsInterface(type(IERC1155).interfaceId)) {
            if (!_erc1155[tokenAddress]) _erc1155[tokenAddress] = true;
        } else {
            require(
                contractInstance.supportsInterface(type(IERC721).interfaceId), '4.4'
            );
            amount = 1;
        }

        if (tokenId > 0) {
            _takeToken(tokenAddress, msg.sender, tokenId, amount);
            tokenUri = '';
        } else {
            require(_mintingContract[tokenAddress], '4.5');
            require(bytes(tokenUri).length > 0, '4.6');
        }

        _salesNumber ++;
        if (lotData.length > 0) {
            _setAuction(_salesNumber, lotData);
        }
        _sales[_salesNumber].sellerAddress = msg.sender;
        _sales[_salesNumber].tokenAddress = tokenAddress;
        _sales[_salesNumber].paymentAddress = paymentAddress;
        _sales[_salesNumber].price = price;
        _sales[_salesNumber].tokenId = tokenId;
        _sales[_salesNumber].amount = amount;
        _sales[_salesNumber].createdAt = block.timestamp;
        if (tokenId == 0) {
            _sales[_salesNumber].tokenUri = tokenUri;
        }

        emit SaleModified(_salesNumber, keccak256(abi.encode('Created')));
        return true;
    }

    /**
     * @dev Function for setting lot data for auction record
     */
    function _setAuction (
        uint256 saleId,
        uint256[] calldata lotData
    ) internal returns (bool) {
        if (lotData[4] > 0) {
          require(lotData[4] > lotData[3], '5.1');
          require(lotData[5] < DECIMALS, '5.2');
          _sales[saleId].singlePaymentValue = lotData[4];
          _sales[saleId].singlePaymentPercent = lotData[5];
        }

        _sales[saleId].startTime = lotData[0];
        _sales[saleId].endTime = lotData[1];
        _sales[saleId].step = lotData[2];
        _sales[saleId].startBid = lotData[3];
        return true;
    }

    /**
     * @dev Function for transferring existing token to the contract address
     * when existing token is being sold
     */
    function _takeToken (
        address tokenAddress,
        address senderAddress,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool) {
        if (_erc1155[tokenAddress]) {
            IERC1155 contractInstance = IERC1155(tokenAddress);
            contractInstance.safeTransferFrom(
                senderAddress, address(this), tokenId, amount, ''
            );
        } else {
            IERC721 contractInstance = IERC721(tokenAddress);
            contractInstance.safeTransferFrom(
                senderAddress, address(this), tokenId
            );
        }
        return true;
    }

    /**
     * @dev Function for transferring tokens from contract address:
     * - back to the seller when sale record is cancelled
     * - back to the seller if no bid was maid when auction is completed
     * - to the buyer for fixed price record
     * - to the bidder who maid last bid when auction is completed
     */
    function _sendToken (
        address tokenAddress,
        address receiverAddress,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool) {
        if (_erc1155[tokenAddress]) {
            IERC1155(tokenAddress).safeTransferFrom(
                address(this), receiverAddress, tokenId, amount, ''
            );
        } else {
            IERC721(tokenAddress).safeTransferFrom(
                address(this), receiverAddress, tokenId
            );
        }
        return true;
    }


    /**
     * @dev Function for minting tokens when non-existing token was sold
     * - to the buyer address for fixed price record
     * - to the bidder address who maid last bid when auction is completed
     */
    function _mintToken (
        uint256 saleId
    ) internal returns (uint256) {
        if (_erc1155[_sales[saleId].tokenAddress]) {
            return IERC1155Minting(_sales[saleId].tokenAddress).mint(
                _sales[saleId].buyerAddress,
                _sales[saleId].amount,
                _sales[saleId].tokenUri
            );
        } else {
            return IERC721Minting(_sales[saleId].tokenAddress).mint(
                _sales[saleId].buyerAddress,
                _sales[saleId].tokenUri
            );
        }
    }

    /**
     * @dev Function for proceeding payments
     * - checks msg.value for native payments
     * - take tokens when payment in tokens
     */
    function _proceedPayment (
        uint256 saleId, uint256 amount, address buyer
    ) internal returns (bool) {
        if (_sales[saleId].paymentAddress == address(0)) {
            require(msg.value == amount, '6.1');
        } else {
            TransferHelper.safeTransferFrom(
                _sales[saleId].paymentAddress,
                buyer,
                address(this),
                amount
            );
        }
        return true;
    }

    /**
     * @dev Function for sending payments
     */
    function _sendPayment (
        address paymentAddress,
        address receiver,
        uint256 amount
    ) internal returns (bool) {
        if (amount == 0) return false;
        if (paymentAddress == address(0)) {
            payable(receiver).transfer(amount);
        } else {
            TransferHelper.safeTransfer(paymentAddress, receiver, amount);
        }
        return true;
    }

    /**
     * @dev Function for editing sale record price by seller
     */
    function setSalePrice (
        uint256 saleId,
        uint256 price
    ) external CanModify(saleId) returns (bool) {
        require(!isAuction(saleId), '7.1');
        require(price > 0, '7.2');
        _sales[saleId].price = price;
        return true;
    }

    /**
     * @dev Function for editing start time and end time by seller
     */
    function setLotTimestamps (
        uint256 saleId,
        uint256 startTime,
        uint256 endTime
    ) external CanModify(saleId) returns (bool) {
        require(isAuction(saleId), '8.1');
        require(startTime > block.timestamp, '8.2');
        require(endTime > startTime, '8.3');
        _sales[saleId].startTime = startTime;
        _sales[saleId].endTime = endTime;
        return true;
    }

    /**
     * @dev Function for editing auction step by seller
     */
    function setLotStep (
        uint256 saleId,
        uint256 step
    ) external CanModify(saleId) returns (bool) {
        require(isAuction(saleId), '9.1');
        require(step > 0, '9.2');
        _sales[saleId].step = step;
        return true;
    }

    /**
     * @dev Function for editing auction start bid by seller
     */
    function setLotStartBid (
        uint256 saleId,
        uint256 startBid
    ) external CanModify(saleId) returns (bool) {
        require(isAuction(saleId), '10.1');
        require(startBid > 0, '10.2');
        _sales[saleId].startBid = startBid;
        return true;
    }

    /**
     * @dev Function for editing auction buying at once data by seller
     */
    function setLotSinglePaymentData (
        uint256 saleId,
        uint256 singlePaymentValue,
        uint256 singlePaymentPercent
    ) external CanModify(saleId) returns (bool) {
        require(isAuction(saleId), '11.1');
        require(
            singlePaymentValue > _sales[saleId].startBid,
                '11.2'
        );
        require(
            singlePaymentPercent < DECIMALS,
                '11.3'
        );
        _sales[saleId].singlePaymentValue = singlePaymentValue;
        _sales[saleId].singlePaymentPercent = singlePaymentPercent;
        return true;
    }

    /**
     * @dev Function for sale record cancelling
     */
    function cancelSale (
        uint256 saleId
    ) external CanModify(saleId) nonReentrant returns (bool) {
        if (_sales[saleId].tokenId > 0) {
            _sendToken (
                _sales[saleId].tokenAddress,
                _sales[saleId].sellerAddress,
                _sales[saleId].tokenId,
                _sales[saleId].amount
            );
        }
        _sales[saleId].cancelledAt = block.timestamp;
        emit SaleModified(saleId, keccak256(abi.encode('Cancelled')));
        return true;
    }

    /**
     * @dev Function for buying token (fixed price sale record)
     */
    function buy (
        uint256 saleId
    ) external payable nonReentrant returns (bool) {
        require(_sales[saleId].createdAt > 0, '13.1');
        require(_sales[saleId].completedAt == 0, '13.2');
        require(_sales[saleId].cancelledAt == 0, '13.3');
        require(!isAuction(saleId), '13.4');
        uint256 feeAmount = _sales[saleId].price * _fee / DECIMALS;
        uint256 amount = _sales[saleId].price - feeAmount;
        _proceedPayment(saleId, _sales[saleId].price, msg.sender);
        _sales[saleId].buyerAddress = msg.sender;
        _sales[saleId].completedAt = block.timestamp;
        _sendPayment(
            _sales[saleId].paymentAddress,
            _feeReceiver,
            feeAmount
        );
        _sendPayment(
            _sales[saleId].paymentAddress,
            _sales[saleId].sellerAddress,
            amount
        );
        if (_sales[saleId].tokenId > 0) {
            _sendToken(
                _sales[saleId].tokenAddress,
                _sales[saleId].buyerAddress,
                _sales[saleId].tokenId,
                _sales[saleId].amount
            );
        } else {
            _sales[saleId].tokenId = _mintToken(saleId);
        }
        emit SaleModified(saleId, keccak256(abi.encode('Completed')));
        return true;
    }

    /**
     * @dev Function making bid (auction record)
     */
    function bid (
        uint256 saleId, uint256 amount
    ) public payable nonReentrant returns(bool) {
        require(_sales[saleId].createdAt > 0, '14.1');
        require(_sales[saleId].completedAt == 0, '14.2');
        require(_sales[saleId].cancelledAt == 0, '14.3');
        require(isAuction(saleId), '14.4');
        require(
            _sales[saleId].startTime <= block.timestamp,
                '14.5'
        );
        require(_sales[saleId].endTime >= block.timestamp, '14.6');
        if (_sales[saleId].lastBid > 0) {
            require(
                amount >= _sales[saleId].lastBid + _sales[saleId].step,
                    '14.7'
            );
        } else {
            require(
                amount >= _sales[saleId].startBid,
                    '14.8'
            );
        }
        bool singlePayment = _checkSinglePayment(saleId, amount);
        _proceedPayment(
            saleId, amount, msg.sender
        );
        _proceedBid(saleId, amount, msg.sender);
        if (singlePayment) {
            _completeAuction(saleId);
        }
        return true;
    }

    /**
    * @dev External completing auction function can be sent by anybody.
    * - if no bid was sent token will be sent to the sellerAddress
    * - otherwise token will be sent to the last bid sender and last bid value will be sent
    * to the seller address
    */
    function completeAuction (
        uint256 saleId
    ) external nonReentrant returns(bool) {
        require(_sales[saleId].startTime > 0, '15.1');
        require(_sales[saleId].cancelledAt == 0, '15.2');
        require(_sales[saleId].completedAt == 0, '15.3');
        require(_sales[saleId].endTime < block.timestamp, '15.4');
        return _completeAuction(saleId);
    }

    /**
    * @dev Completing auction function implementation
    * - if no bid was sent token will be sent to the sellerAddress
    * - otherwise token will be sent to the last bid sender and last bid value will be sent
    * to the seller address
    */
    function _completeAuction (
        uint256 saleId
    ) internal returns(bool) {
        if (_sales[saleId].lastBid == 0) {
            if (_sales[saleId].tokenId > 0) {
                // no bid was maid, send ERC721 token to the seller address
                _sendToken(
                    _sales[saleId].tokenAddress,
                    _sales[saleId].sellerAddress,
                    _sales[saleId].tokenId,
                    _sales[saleId].amount
                );
            }
        } else {
            _sales[saleId].buyerAddress = _sales[saleId].lastBidSender;
            if (_sales[saleId].tokenId > 0) {
                _sendToken(
                    _sales[saleId].tokenAddress,
                    _sales[saleId].buyerAddress,
                    _sales[saleId].tokenId,
                    _sales[saleId].amount
                );
            } else {
                _sales[saleId].tokenId = _mintToken(saleId);
            }
        }
        _sales[saleId].completedAt = block.timestamp;

        if (_sales[saleId].lastBid > 0) {
            uint256 feeAmount = _sales[saleId].lastBid * _fee / DECIMALS;
            uint256 amount = _sales[saleId].lastBid - feeAmount;
            _sendPayment(
                _sales[saleId].paymentAddress,
                _feeReceiver,
                feeAmount
            );
            _sendPayment(
                _sales[saleId].paymentAddress,
                _sales[saleId].sellerAddress,
                amount
            );
        }
        emit SaleModified(saleId, keccak256(abi.encode('Completed')));
        return true;
    }

    /**
     * @dev Function for processing bid
     */
    function _proceedBid (
        uint256 saleId,
        uint256 amount,
        address bidder
    ) internal returns(bool) {
        if (
            _sales[saleId].lastBidSender != address(0)
                && _sales[saleId].lastBid > 0
        ) {
            _sendPayment(
                _sales[saleId].paymentAddress,
                _sales[saleId].lastBidSender,
                _sales[saleId].lastBid
            );
        }
        _sales[saleId].lastBidSender = bidder;
        _sales[saleId].lastBid = amount;
        emit SaleModified(saleId, keccak256(abi.encode('Bid')));
        emit Bid(saleId, amount, bidder);
        return true;
    }

    /**
     * @dev Function for checking if single payment conditions for auction are met.
     */
    function _checkSinglePayment (
        uint256 saleId, 
        uint256 amount
    ) internal view returns(bool) {
        if (!(_sales[saleId].singlePaymentValue > 0)) return false;
        if (amount < _sales[saleId].singlePaymentValue) return false;
        uint256 singlePaymentDisableValue = _sales[saleId].singlePaymentValue
            * _sales[saleId].singlePaymentPercent / DECIMALS;
        if (_sales[saleId].lastBid >= singlePaymentDisableValue) return false;
        return true;
    }

    /**
     * @dev External function for checking if sale record is active (helper for
     * frontend implementation).
     */
    function saleRecordActive (
        uint256 saleId
    ) external view returns (bool) {
        return _sales[saleId].createdAt > 0
            && _sales[saleId].completedAt == 0
            && _sales[saleId].cancelledAt == 0;
    }

    /**
     * @dev Get fee currency address
     */
    function getFeeReceiverAddress () external view returns (address) {
        return _feeReceiver;
    }

    /**
     * @dev Get fee percentage
     */
    function getFee () external view returns (uint256) {
        return _fee;
    }

    /**
     * @dev Check if contract is allowed to be used as a minting contract
     */
    function checkMintingContract (
        address contractAddress
    ) external view returns (bool) {
        return _mintingContract[contractAddress];
    }

    /**
     * @dev Check if payment contract is allowed to be used as a payment contract
     */
    function checkPaymentContract (
        address contractAddress
    ) external view returns (bool) {
        return _paymentAddresses[contractAddress];
    }

    /**
     * @dev Returns sales number
     */
    function getSalesNumber () external view returns (uint256) {
        return _salesNumber;
    }

    /**
     * @dev Returns all sale record data
     */
    function getSale (
        uint256 saleId
    ) external view returns (
        address[] memory saleAddresses,
        uint256[] memory saleNumbers,
        string memory tokenUri,
        bool erc1155
    ) {
        address[] memory saleAddresses = new address[](5);
        saleAddresses[0] = _sales[saleId].sellerAddress;
        saleAddresses[1] = _sales[saleId].buyerAddress;
        saleAddresses[2] = _sales[saleId].tokenAddress;
        saleAddresses[3] = _sales[saleId].paymentAddress;
        saleAddresses[4] = _sales[saleId].lastBidSender;
        uint256[] memory saleNumbers = new uint256[](13);
        saleNumbers[0] = _sales[saleId].price;
        saleNumbers[1] = _sales[saleId].tokenId;
        saleNumbers[2] = _sales[saleId].amount;
        saleNumbers[3] = _sales[saleId].createdAt;
        saleNumbers[4] = _sales[saleId].completedAt;
        saleNumbers[5] = _sales[saleId].cancelledAt;
        saleNumbers[6] = _sales[saleId].step;
        saleNumbers[7] = _sales[saleId].startBid;
        saleNumbers[8] = _sales[saleId].lastBid;
        saleNumbers[9] = _sales[saleId].singlePaymentValue;
        saleNumbers[10] = _sales[saleId].singlePaymentPercent;
        saleNumbers[11] = _sales[saleId].startTime;
        saleNumbers[12] = _sales[saleId].endTime;
        return (
            saleAddresses,
            saleNumbers,
            _sales[saleId].tokenUri,
            _erc1155[_sales[saleId].tokenAddress]
        );
    }

    /**
     * @dev Returns sale record addresses data
     */
    function getSaleAddresses (
        uint256 saleId
    ) external view returns (
        address sellerAddress,
        address buyerAddress,
        address tokenAddress,
        address paymentAddress,
        bool erc1155
    ) {
        return (
            _sales[saleId].sellerAddress,
            _sales[saleId].buyerAddress,
            _sales[saleId].tokenAddress,
            _sales[saleId].paymentAddress,
            _erc1155[_sales[saleId].tokenAddress]
        );
    }

    /**
     * @dev Returns sale record data (except addresses data and timestamps)
     */
    function getSaleData (
        uint256 saleId
    ) external view returns (
        uint256 price,
        uint256 tokenId,
        uint256 amount,
        string memory tokenUri
    ) {
        return (
            _sales[saleId].price,
            _sales[saleId].tokenId,
            _sales[saleId].amount,
            _sales[saleId].tokenUri
        );
    }

    /**
     * @dev Returns sale record timestamps data
     */
    function getSaleTimestamps (
        uint256 saleId
    ) external view returns (
        uint256 createdAt,
        uint256 completedAt,
        uint256 cancelledAt
    ) {
        return (
            _sales[saleId].createdAt,
            _sales[saleId].completedAt,
            _sales[saleId].cancelledAt
        );
    }

    /**
     * @dev Checks if sale record is an auction
     */
    function isAuction (
        uint256 saleId
    ) public view returns (bool) {
        return _sales[saleId].startTime > 0;
    }

    /**
     * @dev Returns sale record auction data (except timestamps)
     */
    function getLotData (
        uint256 saleId
    ) external view returns (
        uint256 step,
        uint256 startBid,
        uint256 lastBid,
        uint256 singlePaymentValue,
        uint256 singlePaymentPercent,
        address lastBidSender
    ) {
        return (
            _sales[saleId].step,
            _sales[saleId].startBid,
            _sales[saleId].lastBid,
            _sales[saleId].singlePaymentValue,
            _sales[saleId].singlePaymentPercent,
            _sales[saleId].lastBidSender
        );
    }

    /**
     * @dev Returns sale record auction timestamps data
     */
    function getLotTimestamps (
        uint256 saleId
    ) external view returns (
        uint256 startTime,
        uint256 endTime
    ) {
        return (
            _sales[saleId].startTime,
            _sales[saleId].endTime
        );
    }

    /**
     * @dev onERC721Received implementation for accepting ERC721 transfers
     */
    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes calldata _data
    ) external pure returns(bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @dev onERC1155Received implementation for accepting ERC1155 transfers
     */
    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _id,
        uint256 _value,
        bytes calldata _data
    ) external pure returns(bytes4) {
        return this.onERC1155Received.selector;
    }
}