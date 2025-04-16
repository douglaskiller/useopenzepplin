const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy TestTokenA
  const TestTokenA = await ethers.getContractFactory("TestTokenA");
  const tokenA = await TestTokenA.deploy();
  await tokenA.waitForDeployment();
  console.log(`TestTokenA deployed to: ${await tokenA.getAddress()}`);

  // Deploy TestTokenB
  const TestTokenB = await ethers.getContractFactory("TestTokenB");
  const tokenB = await TestTokenB.deploy();
  await tokenB.waitForDeployment();
  console.log(`TestTokenB deployed to: ${await tokenB.getAddress()}`);

  // Deploy DEX
  const DEX = await ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
  await dex.waitForDeployment();
  console.log(`DEX deployed to: ${await dex.getAddress()}`);

  // Deploy AirdorpV2
  const AirdropV2 = await ethers.getContractFactory("AirdropV2");
  const airdrop = await AirdropV2.deploy(await tokenA.getAddress());
  await airdrop.waitForDeployment();
  console.log(`AirdorpV2 deployed to: ${await airdrop.getAddress()}`);

  console.log("Deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
