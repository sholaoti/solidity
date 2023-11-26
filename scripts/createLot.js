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

  d.Marketplace = await ethers.getContractFactory("Marketplace");
  d.marketplace = await d.Marketplace.attach(deployedContracts.marketplace.latest);

  await d.marketplace.createSaleRecord(
    deployedContracts.erc721Minting.latest,
    d.zero,
    ethers.utils.parseUnits('0.01'),
    0,
    1,
    'tokenURI',
    [
      now + 120,
      now + 3600,
      ethers.utils.parseUnits('0.01'),
      ethers.utils.parseUnits('0.01'),
      0,
      0
    ]
  );
  console.log('Lot is created');
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