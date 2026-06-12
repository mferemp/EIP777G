import { ethers } from "hardhat";
import { EIP777G } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying EIP777G with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // ERC-1820 Registry address (same on all networks)
  const ERC1820_REGISTRY = "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24";

  // Configuration
  const name = "EIP777G Token";
  const symbol = "EIP777G";
  const granularity = 1n; // Fully partitionable
  
  // Default operators - contracts authorized for ALL holders by default
  // Empty array = no default operators (holders must explicitly authorize)
  const defaultOperators: string[] = [];

  // Admin gets all roles
  const admin = deployer.address;

  // Deploy
  const EIP777GFactory = await ethers.getContractFactory("EIP777G");
  
  console.log("\nDeploying contract...");
  const contract = await EIP777GFactory.deploy(
    name,
    symbol,
    defaultOperators,
    granularity,
    ERC1820_REGISTRY,
    admin
  ) as EIP777G;

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n✅ EIP777G deployed to:", contractAddress);
  console.log("Transaction hash:", contract.deploymentTransaction()?.hash);

  // Verify ERC-1820 registration
  console.log("\nRegistering ERC-1820 interfaces...");
  try {
    await contract.registerERC1820Implementers(ERC1820_REGISTRY);
    console.log("✅ ERC-1820 interfaces registered");
  } catch (e) {
    console.log("⚠️  ERC-1820 registration failed (may need manual registration):", e);
  }

  // Grant initial operator role to deployer for testing
  console.log("\nGranting OPERATOR_ROLE to deployer...");
  await contract.grantOperatorRole(deployer.address);
  console.log("✅ OPERATOR_ROLE granted");

  // Verify deployment
  console.log("\n=== Deployment Verification ===");
  console.log("Name:", await contract.name());
  console.log("Symbol:", await contract.symbol());
  console.log("Granularity:", (await contract.granularity()).toString());
  console.log("Total Supply:", (await contract.totalSupply()).toString());
  console.log("Deployer Balance:", (await contract.balanceOf(deployer.address)).toString());
  console.log("Registry:", await contract.getRegistry());
  console.log("Ingress Severed:", await contract.isIngressSevered());
  console.log("Default Operators:", (await contract.defaultOperators()).length);

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    contractAddress,
    deployer: deployer.address,
    name,
    symbol,
    granularity: granularity.toString(),
    defaultOperators,
    admin,
    erc1820Registry: ERC1820_REGISTRY,
    timestamp: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash,
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const deploymentFile = path.join(deploymentsDir, `deployment-${deploymentInfo.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", deploymentFile);

  console.log("\n=== Next Steps ===");
  console.log("1. Verify on Etherscan: npx hardhat verify --network <network> " + contractAddress + " \"" + name + "\" \"" + symbol + "\" [] " + granularity + " " + ERC1820_REGISTRY + " " + admin);
  console.log("2. Run tests: npm test");
  console.log("3. Interact via scripts or dashboard");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });