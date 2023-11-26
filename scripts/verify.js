const {ethers} = require("hardhat");
const d = {};
d.name = 'Token';
d.symbol = 'TN';
d.decimals = 8;
d.totalSupply = 1000000;
d.parameters = {
  marketplace: {
    feeReceiver: '',
    fee: 10, // %
  },
  erc721: {
    name: 'ERC721 test minting',
    symbol: 'ERC721',
  },
  erc1155: {
    uri: '',
  }
};
d.networkName = hre.network.name;

async function main() {
  d.signers = await ethers.getSigners();
  d.owner = d.signers[0];
  d.zero = '0x0000000000000000000000000000000000000000';
  if (d.networkName === 'testnet') {
    d.parameters.marketplace.feeReceiver = d.owner.address;
  }
  const contractAddress = '0x178eE86fEe287EE77b24af007ce52E7848F8c959';

  await hre.run("verify:verify", {
    address: contractAddress,
    constructorArguments: [
      // ERC721Minting
      // d.owner.address,
      // d.parameters.erc721.name,
      // d.parameters.erc721.symbol

      // ERC1155Minting
      // d.owner.address,
      // d.parameters.erc1155.uri

      // Marketplace
      d.owner.address,
      d.parameters.marketplace.feeReceiver,
      d.parameters.marketplace.fee * 100
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });