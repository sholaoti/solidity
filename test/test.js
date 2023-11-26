const { expect } = require('chai');
const { ethers } = require("hardhat");

const d = {};

// Start test block
describe('Marketplace contract testing', function () {
  beforeEach(async function () {
    d.signers = await ethers.getSigners();
    d.owner = d.signers[10];
    d.feeReceiver = d.signers[9];
    d.manager = d.signers[8];
    d.seller = d.signers[7];
    d.zero = '0x0000000000000000000000000000000000000000';
    d.price = 24;
    d.buyer = d.signers[6];
    d.bidder1 = d.signers[5];
    d.bidder2 = d.signers[4];
    d.bidder3 = d.signers[3];
    d.fee = 10; // %
    d.amount = 3;
    d.totalSupply = 1000000;
    d.initialTransfer = 10000;
    d.tokenUri = 'tokenUri';

    d.Marketplace = await ethers.getContractFactory("Marketplace");
    d.marketplace = await d.Marketplace.deploy(
      d.owner.address,
      d.feeReceiver.address,
      d.fee * 100
    );
    await d.marketplace.deployed();

    d.provider = d.marketplace.provider;

    d.ERC721Minting = await ethers.getContractFactory("ERC721Minting");
    d.erc721Minting = await d.ERC721Minting.deploy(
      d.owner.address,
      'Name',
      'Symbol'
    );
    await d.erc721Minting.deployed();
    await d.erc721Minting.connect(d.owner).grantRole('MINTER', d.marketplace.address);
    await d.marketplace.connect(d.owner).setMintingContract(
      d.erc721Minting.address,
      true
    );
    await d.erc721Minting.connect(d.owner).mint(
      d.seller.address,
      'uri1'
    );
    await d.erc721Minting.connect(d.owner).mint(
      d.seller.address,
      'uri2'
    );
    await d.erc721Minting.connect(d.owner).mint(
      d.seller.address,
      'uri3'
    );
    await d.erc721Minting.connect(d.seller).setApprovalForAll(
      d.marketplace.address, true
    );

    d.ERC1155Minting = await ethers.getContractFactory("ERC1155Minting");
    d.erc1155Minting = await d.ERC1155Minting.deploy(
      d.owner.address,
      '' // baseUrl
    );
    await d.erc1155Minting.deployed();
    await d.erc1155Minting.connect(d.owner).grantRole('MINTER', d.marketplace.address);
    await d.marketplace.connect(d.owner).setMintingContract(
      d.erc1155Minting.address,
      true
    );
    await d.erc1155Minting.connect(d.owner).mint(
      d.seller.address,
      d.amount,
      'uri1'
    );
    await d.erc1155Minting.connect(d.owner).mintBatch(
      d.seller.address,
      [2, 4],
      ['uri2', 'uri3']
    );
    await d.erc1155Minting.connect(d.seller).setApprovalForAll(
      d.marketplace.address, true
    );

    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.seller.address);
    expect(await d.erc721Minting.ownerOf(2)).to.equal(d.seller.address);
    expect(await d.erc721Minting.ownerOf(3)).to.equal(d.seller.address);
    expect(await d.erc721Minting.tokenURI(1)).to.equal('uri1');
    expect(await d.erc721Minting.tokenURI(2)).to.equal('uri2');
    expect(await d.erc721Minting.tokenURI(3)).to.equal('uri3');

    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 1)
    )).to.equal(d.amount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 2)
    )).to.equal(2);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 3)
    )).to.equal(4);
    expect(await d.erc1155Minting.uri(1)).to.equal('uri1');
    expect(await d.erc1155Minting.uri(2)).to.equal('uri2');
    expect(await d.erc1155Minting.uri(3)).to.equal('uri3');

    d.PaymentToken = await ethers.getContractFactory("PaymentToken");
    d.paymentToken = await d.PaymentToken.deploy(
      d.owner.address,
      ethers.utils.parseUnits(d.totalSupply.toString()),
      'Payment token',
      'Payment token'
    );
    await d.paymentToken.deployed();
    await d.paymentToken.connect(d.owner).transfer(
      d.buyer.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.owner).transfer(
      d.bidder1.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.owner).transfer(
      d.bidder2.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.owner).transfer(
      d.bidder3.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.buyer).approve(
      d.marketplace.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.bidder1).approve(
      d.marketplace.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.bidder2).approve(
      d.marketplace.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.paymentToken.connect(d.bidder3).approve(
      d.marketplace.address, ethers.utils.parseUnits(d.initialTransfer.toString()),
    );
    await d.marketplace.connect(d.owner).setPaymentContract(
      d.paymentToken.address,
      true
    );
  });

  it('Existing token selling, erc721, payment in tokens', async function () {
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      1,
      '',
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc721Minting.address);
    expect(d.result.paymentAddress).to.equal(d.paymentToken.address);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(1);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.marketplace.address);
    expect(await d.marketplace.isAuction(1)).to.be.false;
    
    await expect(
      d.marketplace.connect(d.buyer).buy(2)
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ));
    await d.marketplace.connect(d.buyer).buy(1);
    d.feeAmount = d.price * d.fee / 100;
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ))).to.equal(d.buyer.balance - d.price);
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.buyer.address);
  });

  it('Existing token selling, erc721, payment in native', async function () {
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.zero,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      1,
      '',
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc721Minting.address);
    expect(d.result.paymentAddress).to.equal(d.zero);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(1);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.marketplace.address);

    await expect(
      d.marketplace.connect(d.buyer).buy(
        2,
        {value: ethers.utils.parseUnits(d.price.toString())}
      )
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ));
    await d.marketplace.connect(d.buyer).buy(
      1,
      {value: ethers.utils.parseUnits(d.price.toString())}
    );
    d.feeAmount = d.price * d.fee / 100;
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    )), 2)).to.equal(roundTo(d.buyer.balance - d.price, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.buyer.address);
  });

  it('Existing token selling, erc1155, payment in tokens', async function () {
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      d.amount,
      '',
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc1155Minting.address);
    expect(d.result.paymentAddress).to.equal(d.paymentToken.address);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(d.amount);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(d.amount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.buyer.address, 1)
    )).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(2)
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ));
    await d.marketplace.connect(d.buyer).buy(1);
    d.feeAmount = d.price * d.fee / 100;
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ))).to.equal(d.buyer.balance - d.price);
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.buyer.address, 1)
    )).to.equal(d.amount);
  });

  it('Existing token selling, erc1155, payment in native', async function () {
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.zero,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      d.amount,
      '',
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc1155Minting.address);
    expect(d.result.paymentAddress).to.equal(d.zero);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(d.amount);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(d.amount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.buyer.address, 1)
    )).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(
        2,
        {value: ethers.utils.parseUnits(d.price.toString())}
      )
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ));
    await d.marketplace.connect(d.buyer).buy(
      1,
      {value: ethers.utils.parseUnits(d.price.toString())}
    );
    d.feeAmount = d.price * d.fee / 100;
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    )), 2)).to.equal(roundTo(d.buyer.balance - d.price, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.buyer.address, 1)
    )).to.equal(d.amount);
  });

  it('Non-existing token selling, erc721, payment in tokens', async function () {
    await expect(
      d.marketplace.connect(d.seller).createSaleRecord(
        d.erc721Minting.address,
        d.paymentToken.address,
        ethers.utils.parseUnits(d.price.toString()),
        0,
        1,
        '',
        []
      )
    ).to.be.revertedWith('4.6');
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      0,
      1,
      d.tokenUri,
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc721Minting.address);
    expect(d.result.paymentAddress).to.equal(d.paymentToken.address);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(0);
    expect(Number(d.result.amount)).to.equal(1);
    expect(d.result.tokenUri).to.equal(d.tokenUri);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(2)
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ));
    d.netxTokenId = Number(await d.erc721Minting.getLastTokenId()) + 1;
    await d.marketplace.connect(d.buyer).buy(1);
    d.feeAmount = d.price * d.fee / 100;
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ))).to.equal(d.buyer.balance - d.price);
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(await d.erc721Minting.ownerOf(d.netxTokenId)).to.equal(d.buyer.address);
    expect(await d.erc721Minting.tokenURI(d.netxTokenId)).to.equal(d.tokenUri);
  });

  it('Non-existing token selling, erc721, payment in native', async function () {
    await expect(
      d.marketplace.connect(d.seller).createSaleRecord(
        d.erc721Minting.address,
        d.paymentToken.address,
        ethers.utils.parseUnits(d.price.toString()),
        0,
        1,
        '',
        []
      )
    ).to.be.revertedWith('4.6');
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.zero,
      ethers.utils.parseUnits(d.price.toString()),
      0,
      1,
      d.tokenUri,
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc721Minting.address);
    expect(d.result.paymentAddress).to.equal(d.zero);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(0);
    expect(Number(d.result.amount)).to.equal(1);
    expect(d.result.tokenUri).to.equal(d.tokenUri);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(
        2,
        {value: ethers.utils.parseUnits(d.price.toString())}
      )
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ));
    d.netxTokenId = Number(await d.erc721Minting.getLastTokenId()) + 1;
    await d.marketplace.connect(d.buyer).buy(
      1,
      {value: ethers.utils.parseUnits(d.price.toString())}
    );
    d.feeAmount = d.price * d.fee / 100;
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    )), 2)).to.equal(roundTo(d.buyer.balance - d.price, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    )), 8)).to.equal(roundTo(d.feeReceiver.balance + d.feeAmount, 8));
    expect(await d.erc721Minting.ownerOf(d.netxTokenId)).to.equal(d.buyer.address);
    expect(await d.erc721Minting.tokenURI(d.netxTokenId)).to.equal(d.tokenUri);
    await expect(
      d.marketplace.connect(d.buyer).buy(
        1,
        {value: ethers.utils.parseUnits(d.price.toString())}
      )
    ).to.be.revertedWith('13.2');
  });

  it('Non-existing token selling, erc1155, payment in tokens', async function () {
    await expect(
      d.marketplace.connect(d.seller).createSaleRecord(
        d.erc1155Minting.address,
        d.paymentToken.address,
        ethers.utils.parseUnits(d.price.toString()),
        0,
        d.amount,
        '',
        []
      )
    ).to.be.revertedWith('4.6');
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      0,
      d.amount,
      d.tokenUri,
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc1155Minting.address);
    expect(d.result.paymentAddress).to.equal(d.paymentToken.address);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(0);
    expect(Number(d.result.amount)).to.equal(d.amount);
    expect(d.result.tokenUri).to.equal(d.tokenUri);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(2)
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ));
    d.netxTokenId = Number(await d.erc1155Minting.getLastTokenId()) + 1;
    await d.marketplace.connect(d.buyer).buy(1);
    d.feeAmount = d.price * d.fee / 100;
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.buyer.address)
    ))).to.equal(d.buyer.balance - d.price);
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, d.netxTokenId)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.buyer.address, d.netxTokenId)
    )).to.equal(d.amount);
  });

  it('Non-existing token selling, erc1155, payment in native', async function () {
    await expect(
      d.marketplace.connect(d.seller).createSaleRecord(
        d.erc1155Minting.address,
        d.zero,
        ethers.utils.parseUnits(d.price.toString()),
        0,
        d.amount,
        '',
        []
      )
    ).to.be.revertedWith('4.6');
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.zero,
      ethers.utils.parseUnits(d.price.toString()),
      0,
      d.amount,
      d.tokenUri,
      []
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc1155Minting.address);
    expect(d.result.paymentAddress).to.equal(d.zero);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    expect(Number(d.result.tokenId)).to.equal(0);
    expect(Number(d.result.amount)).to.equal(d.amount);
    expect(d.result.tokenUri).to.equal(d.tokenUri);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(
        2,
        {value: ethers.utils.parseUnits(d.price.toString())}
      )
    ).to.be.revertedWith('13.1');
    d.buyer.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ));
    d.netxTokenId = Number(await d.erc1155Minting.getLastTokenId()) + 1;
    await d.marketplace.connect(d.buyer).buy(
      1,
      {value: ethers.utils.parseUnits(d.price.toString())}
    );
    d.feeAmount = d.price * d.fee / 100;
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.buyer.address)
    )), 2)).to.equal(roundTo(d.buyer.balance - d.price, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    )), 8)).to.equal(roundTo(d.seller.balance + d.price - d.feeAmount, 8));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, d.netxTokenId)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.buyer.address, d.netxTokenId)
    )).to.equal(d.amount);
  });

  it('Existing token cancelling, erc721', async function () {
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.seller.address);
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      1,
      '',
      []
    );
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.marketplace.address);

    await expect(
      d.marketplace.connect(d.buyer).cancelSale(1)
    ).to.be.revertedWith('0.1');
    await d.marketplace.connect(d.seller).cancelSale(1);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.seller.address);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.be.greaterThan(0);
    expect(Number(d.result.completedAt)).to.equal(0);
  });

  it('Existing token cancelling, erc1155', async function () {
    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 1)
    )).to.equal(d.amount);
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      d.amount,
      '',
      []
    );
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(d.amount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 1)
    )).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).cancelSale(1)
    ).to.be.revertedWith('0.1');
    await d.marketplace.connect(d.seller).cancelSale(1);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 1)
    )).to.equal(d.amount);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.be.greaterThan(0);
    expect(Number(d.result.completedAt)).to.equal(0);
  });

  it('Non-existing token cancelling', async function () {
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      0,
      1,
      d.tokenUri,
      []
    );
    await expect(
      d.marketplace.connect(d.buyer).cancelSale(1)
    ).to.be.revertedWith('0.1');
    await d.marketplace.connect(d.seller).cancelSale(1);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.be.greaterThan(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    await expect(
      d.marketplace.connect(d.buyer).buy(1)
    ).to.be.revertedWith('13.3');
  });

  it('Existing token auction, with single payment, erc721, payment in tokens', async function () {
    d.blockNumber = await ethers.provider.getBlockNumber();
    d.block = await ethers.provider.getBlock(d.blockNumber);
    d.now = d.block.timestamp;
    d.day = 3600 * 24;
    d.startTime = d.now + d.day;
    d.endTime = d.now + 10 * d.day;
    d.step = 0.5;
    d.startBid = 1;
    d.singlePaymentValue = 20;
    d.singlePaymentPercent = 75; //%

    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.seller.address);
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      1,
      '',
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc721Minting.address);
    expect(d.result.paymentAddress).to.equal(d.paymentToken.address);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(0);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(1);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.marketplace.address);
    expect(await d.marketplace.isAuction(1)).to.be.true;

    d.result = await d.marketplace.getLotData(1);
    expect(Number(ethers.utils.formatUnits(d.result.step))).to.equal(d.step);
    expect(Number(ethers.utils.formatUnits(d.result.startBid))).to.equal(d.startBid);
    expect(Number(ethers.utils.formatUnits(d.result.lastBid))).to.equal(0);
    expect(Number(ethers.utils.formatUnits(
      d.result.singlePaymentValue
    ))).to.equal(d.singlePaymentValue);
    expect(Number(d.result.singlePaymentPercent)).to.equal(d.singlePaymentPercent * 100);
    expect(d.result.lastBidSender).to.equal(d.zero);

    d.result = await d.marketplace.getLotTimestamps(1);
    expect(Number(d.result.startTime)).to.equal(d.startTime);
    expect(Number(d.result.endTime)).to.equal(d.endTime);

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        2,
        ethers.utils.parseUnits(d.startBid.toString())
      )
    ).to.be.revertedWith('14.1');
    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString())
      )
    ).to.be.revertedWith('14.5');

    await hre.timeAndMine.increaseTime('1 day');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString())
      )
    ).to.be.revertedWith('14.8');
    await expect(
      d.marketplace.connect(d.bidder1).buy(1)
    ).to.be.revertedWith('13.4');

    d.bidder1.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder1.address)
    ));
    d.bidder2.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder2.address)
    ));
    d.bidder3.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder3.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ));
    d.marketplace.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ));
    await d.marketplace.connect(d.bidder1).bid(
      1,
      ethers.utils.parseUnits((d.startBid).toString())
    );
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder1.address)
    ))).to.equal(d.bidder1.balance - d.startBid);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.startBid);

    await expect(
      d.marketplace.connect(d.bidder2).bid(
        1,
        ethers.utils.parseUnits((d.startBid + d.step * 0.9).toString())
      )
    ).to.be.revertedWith('14.7');
    await d.marketplace.connect(d.bidder2).bid(
      1,
      ethers.utils.parseUnits((d.startBid + d.step).toString())
    );
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder1.address)
    ))).to.equal(d.bidder1.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder2.address)
    ))).to.equal(d.bidder2.balance - (d.startBid + d.step));
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + (d.startBid + d.step));

    await d.marketplace.connect(d.bidder3).bid(
      1,
      ethers.utils.parseUnits((d.singlePaymentValue).toString())
    );
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.be.greaterThan(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.bidder3.address);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder2.address)
    ))).to.equal(d.bidder2.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder3.address)
    ))).to.equal(d.bidder3.balance - d.singlePaymentValue);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance);
    d.lastBid = d.singlePaymentValue;
    d.feeAmount = d.lastBid * d.fee / 100;

    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ))).to.equal(d.seller.balance + (d.lastBid - d.feeAmount));
  });

  it('Existing token auction, without single payment, erc721, payment in tokens', async function () {
    d.blockNumber = await ethers.provider.getBlockNumber();
    d.block = await ethers.provider.getBlock(d.blockNumber);
    d.now = d.block.timestamp;
    d.day = 3600 * 24;
    d.startTime = d.now + d.day;
    d.endTime = d.now + 10 * d.day;
    d.step = 0.5;
    d.startBid = 1;
    d.singlePaymentValue = 20;
    d.singlePaymentPercent = 75; //%

    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.seller.address);
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      1,
      '',
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc721Minting.address);
    expect(d.result.paymentAddress).to.equal(d.paymentToken.address);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(0);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(1);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.marketplace.address);
    expect(await d.marketplace.isAuction(1)).to.be.true;

    d.result = await d.marketplace.getLotData(1);
    expect(Number(ethers.utils.formatUnits(d.result.step))).to.equal(d.step);
    expect(Number(ethers.utils.formatUnits(d.result.startBid))).to.equal(d.startBid);
    expect(Number(ethers.utils.formatUnits(d.result.lastBid))).to.equal(0);
    expect(Number(ethers.utils.formatUnits(
      d.result.singlePaymentValue
    ))).to.equal(d.singlePaymentValue);
    expect(Number(d.result.singlePaymentPercent)).to.equal(d.singlePaymentPercent * 100);
    expect(d.result.lastBidSender).to.equal(d.zero);

    d.result = await d.marketplace.getLotTimestamps(1);
    expect(Number(d.result.startTime)).to.equal(d.startTime);
    expect(Number(d.result.endTime)).to.equal(d.endTime);

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        2,
        ethers.utils.parseUnits(d.startBid.toString())
      )
    ).to.be.revertedWith('14.1');
    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString())
      )
    ).to.be.revertedWith('14.5');

    await hre.timeAndMine.increaseTime('1 day');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString())
      )
    ).to.be.revertedWith('14.8');
    await expect(
      d.marketplace.connect(d.bidder1).buy(1)
    ).to.be.revertedWith('13.4');

    d.bidder1.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder1.address)
    ));
    d.bidder2.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder2.address)
    ));
    d.bidder3.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder3.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ));
    d.marketplace.balance = Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ));
    await d.marketplace.connect(d.bidder1).bid(
      1,
      ethers.utils.parseUnits((d.startBid).toString())
    );
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder1.address)
    ))).to.equal(d.bidder1.balance - d.startBid);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.startBid);

    await expect(
      d.marketplace.connect(d.bidder2).bid(
        1,
        ethers.utils.parseUnits((d.startBid + d.step * 0.9).toString())
      )
    ).to.be.revertedWith('14.7');
    await d.marketplace.connect(d.bidder2).bid(
      1,
      ethers.utils.parseUnits((d.startBid + d.step).toString())
    );
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder1.address)
    ))).to.equal(d.bidder1.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder2.address)
    ))).to.equal(d.bidder2.balance - (d.startBid + d.step));
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + (d.startBid + d.step));

    await d.marketplace.connect(d.bidder3).bid(
      1,
      ethers.utils.parseUnits((d.marketplace.balance + (d.startBid + 2 * d.step)).toString())
    );
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.equal(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.marketplace.address);
    d.lastBid = d.startBid + 2 * d.step;
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder2.address)
    ))).to.equal(d.bidder2.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder3.address)
    ))).to.equal(d.bidder3.balance - d.lastBid);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.lastBid);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ))).to.equal(d.seller.balance);

    await expect(
      d.marketplace.connect(d.bidder3).completeAuction(1)
    ).to.be.revertedWith('15.4');

    await hre.timeAndMine.increaseTime('10 days');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await d.marketplace.connect(d.bidder3).completeAuction(1);

    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.be.greaterThan(0);
    expect(await d.erc721Minting.ownerOf(1)).to.equal(d.bidder3.address);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.bidder3.address)
    ))).to.equal(d.bidder3.balance - d.lastBid);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.marketplace.address)
    ))).to.equal(d.marketplace.balance);
    d.feeAmount = d.lastBid * d.fee / 100;

    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(ethers.utils.formatUnits(
      await d.paymentToken.balanceOf(d.seller.address)
    ))).to.equal(d.seller.balance + (d.lastBid - d.feeAmount));
  });

  it('Existing token auction, with single payment disabled, erc1155, payment in native', async function () {
    d.blockNumber = await ethers.provider.getBlockNumber();
    d.block = await ethers.provider.getBlock(d.blockNumber);
    d.now = d.block.timestamp;
    d.day = 3600 * 24;
    d.startTime = d.now + d.day;
    d.endTime = d.now + 10 * d.day;
    d.step = 0.5;
    d.startBid = 1;
    d.singlePaymentValue = 20;
    d.singlePaymentPercent = 75; //%

    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.zero,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      d.amount,
      '',
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc1155Minting.address);
    expect(d.result.paymentAddress).to.equal(d.zero);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(0);
    expect(Number(d.result.tokenId)).to.equal(1);
    expect(Number(d.result.amount)).to.equal(d.amount);
    expect(d.result.tokenUri).to.equal('');
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.seller.address, 1)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(d.amount);
    expect(await d.marketplace.isAuction(1)).to.be.true;

    d.result = await d.marketplace.getLotData(1);
    expect(Number(ethers.utils.formatUnits(d.result.step))).to.equal(d.step);
    expect(Number(ethers.utils.formatUnits(d.result.startBid))).to.equal(d.startBid);
    expect(Number(ethers.utils.formatUnits(d.result.lastBid))).to.equal(0);
    expect(Number(ethers.utils.formatUnits(
      d.result.singlePaymentValue
    ))).to.equal(d.singlePaymentValue);
    expect(Number(d.result.singlePaymentPercent)).to.equal(d.singlePaymentPercent * 100);
    expect(d.result.lastBidSender).to.equal(d.zero);

    d.result = await d.marketplace.getLotTimestamps(1);
    expect(Number(d.result.startTime)).to.equal(d.startTime);
    expect(Number(d.result.endTime)).to.equal(d.endTime);

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        2,
        ethers.utils.parseUnits(d.startBid.toString()),
        {value: ethers.utils.parseUnits(d.startBid.toString())}
      )
    ).to.be.revertedWith('14.1');
    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString()),
        {value: ethers.utils.parseUnits((d.startBid * 0.9).toString())}
      )
    ).to.be.revertedWith('14.5');

    await hre.timeAndMine.increaseTime('1 day');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString()),
        {value: ethers.utils.parseUnits((d.startBid * 0.9).toString())}
      )
    ).to.be.revertedWith('14.8');
    await expect(
      d.marketplace.connect(d.bidder1).buy(1)
    ).to.be.revertedWith('13.4');

    d.bidder1.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder1.address)
    ));
    d.bidder2.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder2.address)
    ));
    d.bidder3.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder3.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ));
    d.marketplace.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ));
    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid).toString())
      )
    ).to.be.revertedWith('6.1');
    await d.marketplace.connect(d.bidder1).bid(
      1,
      ethers.utils.parseUnits((d.startBid).toString()),
      {value: ethers.utils.parseUnits((d.startBid).toString())}
    );
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder1.address)
    )), 2)).to.equal(roundTo(d.bidder1.balance - d.startBid, 2));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.startBid);

    await expect(
      d.marketplace.connect(d.bidder2).bid(
        1,
        ethers.utils.parseUnits((d.startBid + d.step * 0.9).toString()),
        {value: ethers.utils.parseUnits((d.startBid + d.step * 0.9).toString())}
      )
    ).to.be.revertedWith('14.7');
    d.lastBid = d.singlePaymentValue * d.singlePaymentPercent / 100;
    await d.marketplace.connect(d.bidder2).bid(
      1,
      ethers.utils.parseUnits(d.lastBid.toString()),
      {value: ethers.utils.parseUnits(d.lastBid.toString())}
    );
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder1.address)
    )), 2)).to.equal(roundTo(d.bidder1.balance, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder2.address)
    )), 2)).to.equal(roundTo(d.bidder2.balance - d.lastBid, 2));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.lastBid);

    await d.marketplace.connect(d.bidder3).bid(
      1,
      ethers.utils.parseUnits((d.singlePaymentValue).toString()),
      {value: ethers.utils.parseUnits((d.singlePaymentValue).toString())}
    );
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(d.amount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.bidder3.address, 1)
    )).to.equal(0);
    d.lastBid = d.singlePaymentValue;
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder2.address)
    )), 2)).to.equal(roundTo(d.bidder2.balance, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder3.address)
    )), 2)).to.equal(roundTo(d.bidder3.balance - d.lastBid, 2));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.lastBid);
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ))).to.equal(d.seller.balance);

    await expect(
      d.marketplace.connect(d.bidder3).completeAuction(1)
    ).to.be.revertedWith('15.4');
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(d.amount);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.bidder3.address, 1)
    )).to.equal(0);

    await hre.timeAndMine.increaseTime('10 days');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await d.marketplace.connect(d.bidder3).completeAuction(1);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.be.greaterThan(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, 1)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.bidder3.address, 1)
    )).to.equal(d.amount);

    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance);
    d.feeAmount = d.lastBid * d.fee / 100;

    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ))).to.equal(d.seller.balance + (d.lastBid - d.feeAmount));
  });

  it('Non-existing token auction, with single payment disabled, erc1155, payment in native', async function () {
    d.blockNumber = await ethers.provider.getBlockNumber();
    d.block = await ethers.provider.getBlock(d.blockNumber);
    d.now = d.block.timestamp;
    d.day = 3600 * 24;
    d.startTime = d.now + d.day;
    d.endTime = d.now + 10 * d.day;
    d.step = 0.5;
    d.startBid = 1;
    d.singlePaymentValue = 20;
    d.singlePaymentPercent = 75; //%

    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc1155Minting.address,
      d.zero,
      ethers.utils.parseUnits(d.price.toString()),
      0,
      d.amount,
      d.tokenUri,
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    d.result = await d.marketplace.getSaleAddresses(1);
    expect(d.result.tokenAddress).to.equal(d.erc1155Minting.address);
    expect(d.result.paymentAddress).to.equal(d.zero);
    expect(d.result.sellerAddress).to.equal(d.seller.address);
    expect(d.result.buyerAddress).to.equal(d.zero);
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(0);
    expect(Number(d.result.tokenId)).to.equal(0);
    expect(Number(d.result.amount)).to.equal(d.amount);
    expect(d.result.tokenUri).to.equal(d.tokenUri);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    d.netxTokenId = Number(await d.erc1155Minting.getLastTokenId()) + 1;
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, d.netxTokenId)
    )).to.equal(0);
    expect(await d.marketplace.isAuction(1)).to.be.true;

    d.result = await d.marketplace.getLotData(1);
    expect(Number(ethers.utils.formatUnits(d.result.step))).to.equal(d.step);
    expect(Number(ethers.utils.formatUnits(d.result.startBid))).to.equal(d.startBid);
    expect(Number(ethers.utils.formatUnits(d.result.lastBid))).to.equal(0);
    expect(Number(ethers.utils.formatUnits(
      d.result.singlePaymentValue
    ))).to.equal(d.singlePaymentValue);
    expect(Number(d.result.singlePaymentPercent)).to.equal(d.singlePaymentPercent * 100);
    expect(d.result.lastBidSender).to.equal(d.zero);

    d.result = await d.marketplace.getLotTimestamps(1);
    expect(Number(d.result.startTime)).to.equal(d.startTime);
    expect(Number(d.result.endTime)).to.equal(d.endTime);

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        2,
        ethers.utils.parseUnits(d.startBid.toString()),
        {value: ethers.utils.parseUnits(d.startBid.toString())}
      )
    ).to.be.revertedWith('14.1');
    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString()),
        {value: ethers.utils.parseUnits((d.startBid * 0.9).toString())}
      )
    ).to.be.revertedWith('14.5');

    await hre.timeAndMine.increaseTime('1 day');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid * 0.9).toString()),
        {value: ethers.utils.parseUnits((d.startBid * 0.9).toString())}
      )
    ).to.be.revertedWith('14.8');
    await expect(
      d.marketplace.connect(d.bidder1).buy(1)
    ).to.be.revertedWith('13.4');

    d.bidder1.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder1.address)
    ));
    d.bidder2.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder2.address)
    ));
    d.bidder3.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder3.address)
    ));
    d.seller.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ));
    d.feeReceiver.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ));
    d.marketplace.balance = Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ));
    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid).toString())
      )
    ).to.be.revertedWith('6.1');
    await d.marketplace.connect(d.bidder1).bid(
      1,
      ethers.utils.parseUnits((d.startBid).toString()),
      {value: ethers.utils.parseUnits((d.startBid).toString())}
    );
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder1.address)
    )), 2)).to.equal(roundTo(d.bidder1.balance - d.startBid, 2));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.startBid);

    await expect(
      d.marketplace.connect(d.bidder2).bid(
        1,
        ethers.utils.parseUnits((d.startBid + d.step * 0.9).toString()),
        {value: ethers.utils.parseUnits((d.startBid + d.step * 0.9).toString())}
      )
    ).to.be.revertedWith('14.7');
    d.lastBid = d.singlePaymentValue * d.singlePaymentPercent / 100;
    await d.marketplace.connect(d.bidder2).bid(
      1,
      ethers.utils.parseUnits(d.lastBid.toString()),
      {value: ethers.utils.parseUnits(d.lastBid.toString())}
    );
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder1.address)
    )), 2)).to.equal(roundTo(d.bidder1.balance, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder2.address)
    )), 2)).to.equal(roundTo(d.bidder2.balance - d.lastBid, 2));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.lastBid);

    await d.marketplace.connect(d.bidder3).bid(
      1,
      ethers.utils.parseUnits((d.singlePaymentValue).toString()),
      {value: ethers.utils.parseUnits((d.singlePaymentValue).toString())}
    );
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, d.netxTokenId)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.bidder3.address, d.netxTokenId)
    )).to.equal(0);
    d.lastBid = d.singlePaymentValue;
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder2.address)
    )), 2)).to.equal(roundTo(d.bidder2.balance, 2));
    expect(roundTo(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.bidder3.address)
    )), 2)).to.equal(roundTo(d.bidder3.balance - d.lastBid, 2));
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance + d.lastBid);
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance);
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ))).to.equal(d.seller.balance);

    await expect(
      d.marketplace.connect(d.bidder3).completeAuction(1)
    ).to.be.revertedWith('15.4');
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, d.netxTokenId)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.bidder3.address, d.netxTokenId)
    )).to.equal(0);

    await hre.timeAndMine.increaseTime('10 days');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await d.marketplace.connect(d.bidder3).completeAuction(1);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(
      d.result.completedAt
    )).to.be.greaterThan(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.marketplace.address, d.netxTokenId)
    )).to.equal(0);
    expect(Number(
      await d.erc1155Minting.balanceOf(d.bidder3.address, d.netxTokenId)
    )).to.equal(d.amount);

    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.marketplace.address)
    ))).to.equal(d.marketplace.balance);
    d.feeAmount = d.lastBid * d.fee / 100;

    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.feeReceiver.address)
    ))).to.equal(d.feeReceiver.balance + d.feeAmount);
    expect(Number(ethers.utils.formatUnits(
      await d.provider.getBalance(d.seller.address)
    ))).to.equal(d.seller.balance + (d.lastBid - d.feeAmount));
  });

  it('Auction cancelling', async function () {
    d.blockNumber = await ethers.provider.getBlockNumber();
    d.block = await ethers.provider.getBlock(d.blockNumber);
    d.now = d.block.timestamp;
    d.day = 3600 * 24;
    d.startTime = d.now + d.day;
    d.endTime = d.now + 10 * d.day;
    d.step = 0.5;
    d.startBid = 1;
    d.singlePaymentValue = 20;
    d.singlePaymentPercent = 75; //%

    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      0,
      0,
      1,
      d.tokenUri,
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      0,
      0,
      1,
      d.tokenUri,
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    await d.marketplace.connect(d.seller).cancelSale(1);
    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.be.greaterThan(0);
    expect(Number(d.result.completedAt)).to.equal(0);
    await expect(
      d.marketplace.connect(d.seller).cancelSale(1)
    ).to.be.revertedWith('0.3');

    await hre.timeAndMine.increaseTime('11 days');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });

    await expect(
      d.marketplace.connect(d.seller).cancelSale(2)
    ).to.be.revertedWith('0.4');

    d.result = await d.marketplace.getSaleTimestamps(1);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.be.greaterThan(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    d.result = await d.marketplace.getSaleTimestamps(2);
    expect(Number(d.result.createdAt)).to.be.greaterThan(0);
    expect(Number(d.result.cancelledAt)).to.be.equal(0);
    expect(Number(d.result.completedAt)).to.equal(0);

    await expect(
      d.marketplace.connect(d.bidder1).bid(
        1,
        ethers.utils.parseUnits((d.startBid).toString())
      )
    ).to.be.revertedWith('14.3');
  });

  it('Editing sale record, fixed price', async function () {
    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      ethers.utils.parseUnits(d.price.toString()),
      1,
      1,
      '',
      []
    );
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price);
    await expect(
      d.marketplace.connect(d.buyer).setSalePrice(
        1,
        ethers.utils.parseUnits((d.price * 1.1).toString())
      )
    ).to.be.revertedWith('0.1');
    await expect(
      d.marketplace.connect(d.seller).setLotStep(
        1,
        ethers.utils.parseUnits((d.step * 1.1).toString())
      )
    ).to.be.revertedWith('9.1');
    await d.marketplace.connect(d.seller).setSalePrice(
      1,
      ethers.utils.parseUnits((d.price * 1.1).toString())
    );
    d.result = await d.marketplace.getSaleData(1);
    expect(Number(ethers.utils.formatUnits(d.result.price))).to.equal(d.price * 1.1);
  });

  it('Editing sale record, auction', async function () {
    d.blockNumber = await ethers.provider.getBlockNumber();
    d.block = await ethers.provider.getBlock(d.blockNumber);
    d.now = d.block.timestamp;
    d.day = 3600 * 24;
    d.startTime = d.now + d.day;
    d.endTime = d.now + 10 * d.day;
    d.step = 0.5;
    d.startBid = 1;
    d.singlePaymentValue = 20;
    d.singlePaymentPercent = 75; //%

    await d.marketplace.connect(d.seller).createSaleRecord(
      d.erc721Minting.address,
      d.paymentToken.address,
      0,
      1,
      1,
      '',
      [
        d.startTime,
        d.endTime,
        ethers.utils.parseUnits(d.step.toString()),
        ethers.utils.parseUnits(d.startBid.toString()),
        ethers.utils.parseUnits(d.singlePaymentValue.toString()),
        d.singlePaymentPercent * 100
      ]
    );
    await expect(
      d.marketplace.connect(d.seller).setSalePrice(
        1,
        ethers.utils.parseUnits((d.price * 1.1).toString())
      )
    ).to.be.revertedWith('7.1');
    await d.marketplace.connect(d.seller).setLotTimestamps(
        1,
        d.startTime + 10,
        d.endTime + 10
    );
    d.result = await d.marketplace.getLotTimestamps(1);
    expect(Number(d.result.startTime)).to.equal(d.startTime + 10);
    expect(Number(d.result.endTime)).to.equal(d.endTime + 10);
    await d.marketplace.connect(d.seller).setLotStep(
        1,
        11
    );
    await d.marketplace.connect(d.seller).setLotStartBid(
        1,
        22
    );
    await d.marketplace.connect(d.seller).setLotSinglePaymentData(
        1,
        33,
        44
    );

    d.result = await d.marketplace.getLotData(1);
    expect(Number(d.result.step)).to.equal(11);
    expect(Number(d.result.startBid)).to.equal(22);
    expect(Number(d.result.singlePaymentValue)).to.equal(33);
    expect(Number(d.result.singlePaymentPercent)).to.equal(44);
  });
});

function roundTo(a, b) {
  a = Number(a);
  b = Number(b);
  if (isNaN(a) || !(b > 0)) return null;
  b = 10 ** b;
  return Math.round(a * b) / b;
}