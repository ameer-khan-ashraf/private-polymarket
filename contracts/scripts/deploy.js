const hre = require("hardhat");

async function main() {
  console.log("Deploying PrivateMarket contract...");

  const PrivateMarket = await hre.ethers.getContractFactory("PrivateMarket");
  const privateMarket = await PrivateMarket.deploy();

  await privateMarket.waitForDeployment();

  const address = await privateMarket.getAddress();

  console.log(`PrivateMarket deployed to: ${address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}`);

  // Wait for block confirmations before verification
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await privateMarket.deploymentTransaction().wait(6);

    console.log("Verifying contract via Etherscan V2 API...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
