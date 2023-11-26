// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const {ethers} = require("hardhat");
const fs = require('fs');
const path = require('path');
const d = {};
d.zero = '0x0000000000000000000000000000000000000000';
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
d.options = {};
const jsonPath = path.join(__dirname, `../deployed-contracts/${d.networkName}.json`);

async function main() {
  if (d.networkName === 'polygonMainnet') {
    const gasPrice = Number(await getGasPrice());
    d.options.gasPrice = gasPrice > 30000000000 ? gasPrice : 50000000000;
    d.options.gasLimit = 5000000;
  }
  d.signers = await ethers.getSigners();
  d.owner = d.signers[0];
  if (d.networkName === 'testnet') {
    d.parameters.marketplace.feeReceiver = d.owner.address;
  }
  const now = Math.round(Date.now() / 1000);
  const deployedContracts = require(jsonPath);

  // d.ERC721Minting = await ethers.getContractFactory("ERC721Minting");
  // d.erc721Minting = await d.ERC721Minting.deploy(
  //   d.owner.address,
  //   d.parameters.erc721.name,
  //   d.parameters.erc721.symbol,
  //   d.options
  // );
  // await d.erc721Minting.deployed();
  // if (!(deployedContracts.erc721Minting)) deployedContracts.erc721Minting = {
  //   latest: '',
  //   all: [],
  // };
  // deployedContracts.erc721Minting.latest = d.erc721Minting.address;
  // deployedContracts.erc721Minting.all.push({
  //   address: d.erc721Minting.address,
  //   timestamp: now,
  // });
  // saveToJson(deployedContracts);
  // console.log(`ERC721 minting contract deployed to ${d.erc721Minting.address}`);
  //
  // d.ERC1155Minting = await ethers.getContractFactory("ERC1155Minting");
  // d.erc1155Minting = await d.ERC1155Minting.deploy(
  //   d.owner.address,
  //   d.parameters.erc1155.uri,
  //   d.options
  // );
  // await d.erc1155Minting.deployed();
  // if (!(deployedContracts.erc1155Minting)) deployedContracts.erc1155Minting = {
  //   latest: '',
  //   all: [],
  // };
  // deployedContracts.erc1155Minting.latest = d.erc1155Minting.address;
  // deployedContracts.erc1155Minting.all.push({
  //   address: d.erc1155Minting.address,
  //   timestamp: now,
  // });
  // saveToJson(deployedContracts);
  // console.log(`ERC1155 minting contract deployed to ${d.erc1155Minting.address}`);

  d.Marketplace = await ethers.getContractFactory("Marketplace");
  d.marketplace = await d.Marketplace.deploy(
    d.owner.address,
    d.parameters.marketplace.feeReceiver,
    d.parameters.marketplace.fee * 100,
    d.options
  );
  await d.marketplace.deployed();
  if (!(deployedContracts.marketplace)) deployedContracts.marketplace = {
    latest: '',
    all: [],
  };
  deployedContracts.marketplace.latest = d.marketplace.address;
  deployedContracts.marketplace.all.push({
    address: d.marketplace.address,
    timestamp: now,
  });
  saveToJson(deployedContracts);
  console.log(`Marketplace contract deployed to ${d.marketplace.address}`);
}

async function getGasPrice () {
  const gasPriceApi = 'https://api.polygonscan.com/api?module=gastracker&action=gasoracle&apikey=F1PQ752FZMGWKUW6YG1M73ZNG4RZAVHW1T';
  const response = await axios(gasPriceApi);
  const json = response.data;
  let gasPrice = Number(json?.result?.ProposeGasPrice);
  gasPrice = gasPrice > 0 ? gasPrice : 50;
  return ethers.utils.parseUnits(gasPrice.toString(), 'gwei');
}

function saveToJson(jsonData) {
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(jsonData, null, 4)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });