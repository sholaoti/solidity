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
  const now = Math.round(Date.now() / 1000);
  const deployedContracts = require(jsonPath);
  if (
    !deployedContracts?.marketplace?.latest
    || !deployedContracts?.erc721Minting?.latest
    || !deployedContracts?.erc1155Minting?.latest
  ) {
    console.log('Contracts are not deployed');
    return false;
  }

  d.ERC721Minting = await ethers.getContractFactory("ERC721Minting");
  d.erc721Minting = await d.ERC721Minting.attach(deployedContracts.erc721Minting.latest);
  await d.erc721Minting.grantRole('MINTER', deployedContracts.marketplace.latest);
  console.log('Marketplace contract is set as minter for erc721');

  d.ERC1155Minting = await ethers.getContractFactory("ERC1155Minting");
  d.erc1155Minting = await d.ERC1155Minting.attach(deployedContracts.erc1155Minting.latest);
  await d.erc1155Minting.grantRole('MINTER', deployedContracts.marketplace.latest);
  console.log('Marketplace contract is set as minter for erc1155');

  d.Marketplace = await ethers.getContractFactory("Marketplace");
  d.marketplace = await d.Marketplace.attach(deployedContracts.marketplace.latest);
  await d.marketplace.setMintingContract(deployedContracts.erc721Minting.latest, true);
  console.log('ERC721 allowed as minting contract');
  await d.marketplace.setMintingContract(deployedContracts.erc1155Minting.latest, true);
  console.log('ERC1155 allowed as minting contract');
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