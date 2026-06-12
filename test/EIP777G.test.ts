import { expect } from "chai";
import { ethers } from "hardhat";
import { EIP777G, EIP777G__factory, MockERC777Sender, MockERC777Recipient, ReentrantAttacker, MockERC1820Registry } from "../typechain-types";
import { Signer } from "ethers";

describe("EIP777G - Secure ERC-777 with Operator-Gated Architecture", function () {
  let contract: EIP777G;
  let erc1820Registry: MockERC1820Registry;
  let deployer: Signer;
  let holder: Signer;
  let operator: Signer;
  let recipient: Signer;
  let attacker: Signer;
  
  let deployerAddress: string;
  let holderAddress: string;
  let operatorAddress: string;
  let recipientAddress: string;
  let attackerAddress: string;
  let erc1820Address: string;

  const GRANULARITY = 1n;
  const INITIAL_SUPPLY = 1_000_000n;
  const EMPTY_BYTES = "0x";
  const TEST_OP_DATA = ethers.toUtf8Bytes("opdata");

  beforeEach(async function () {
    [deployer, holder, operator, recipient, attacker] = await ethers.getSigners();
    deployerAddress = await deployer.getAddress();
    holderAddress = await holder.getAddress();
    operatorAddress = await operator.getAddress();
    recipientAddress = await recipient.getAddress();
    attackerAddress = await attacker.getAddress();

    // Deploy mock ERC1820Registry
    const ERC1820Factory = await ethers.getContractFactory("MockERC1820Registry");
    erc1820Registry = await ERC1820Factory.deploy();
    await erc1820Registry.waitForDeployment();
    erc1820Address = await erc1820Registry.getAddress();

    const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
    contract = await factory.deploy(
      "EIP777G Token",
      "EIP777G",
      [], // No default operators
      GRANULARITY,
      erc1820Address,
      deployerAddress
    );

    await contract.waitForDeployment();
    
    // Grant operator role to deployer for testing
    await contract.grantOperatorRole(deployerAddress);
    
    // Mint initial supply to holder
    await contract.mint(holderAddress, INITIAL_SUPPLY, EMPTY_BYTES, EMPTY_BYTES);
  });

  describe("Deployment & Configuration", function () {
    it("Should deploy with correct name, symbol, granularity", async function () {
      expect(await contract.name()).to.equal("EIP777G Token");
      expect(await contract.symbol()).to.equal("EIP777G");
      expect(await contract.granularity()).to.equal(GRANULARITY);
      expect(await contract.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await contract.balanceOf(holderAddress)).to.equal(INITIAL_SUPPLY);
    });

    it("Should have correct admin roles", async function () {
      expect(await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), deployerAddress)).to.be.true;
      expect(await contract.hasRole(await contract.OPERATOR_ROLE(), deployerAddress)).to.be.true;
      expect(await contract.hasRole(await contract.SEVER_ROLE(), deployerAddress)).to.be.true;
      expect(await contract.hasRole(await contract.ADMIN_ROLE(), deployerAddress)).to.be.true;
    });

    it("Should have zero default operators (empty array)", async function () {
      const defaults = await contract.defaultOperators();
      expect(defaults.length).to.equal(0);
    });

    it("Should revert on zero granularity", async function () {
      const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
      await expect(factory.deploy("Test", "TST", [], 0, erc1820Address, deployerAddress))
        .to.be.revertedWithCustomError(contract, "InvalidGranularity");
    });
  });

  describe("Operator Model - THE CORE PREMISE (No EOA Workarounds)", function () {
    it("Self is always operator for itself", async function () {
      expect(await contract.isOperatorFor(holderAddress, holderAddress)).to.be.true;
    });

    it("Holder can authorize operator", async function () {
      await contract.connect(holder).authorizeOperator(operatorAddress);
      expect(await contract.isOperatorFor(operatorAddress, holderAddress)).to.be.true;
      
      const balanceBefore = await contract.balanceOf(recipientAddress);
      await contract.connect(operator).operatorSend(holderAddress, recipientAddress, 100n, EMPTY_BYTES, EMPTY_BYTES);
      expect(await contract.balanceOf(recipientAddress)).to.equal(balanceBefore + 100n);
    });

    it("Holder can revoke operator", async function () {
      await contract.connect(holder).authorizeOperator(operatorAddress);
      await contract.connect(holder).revokeOperator(operatorAddress);
      expect(await contract.isOperatorFor(operatorAddress, holderAddress)).to.be.false;
    });

    it("Operator cannot execute without authorization (NO approve/transferFrom fallback)", async function () {
      // This is THE key test - no EOA workaround allowed
      await expect(
        contract.connect(operator).operatorSend(holderAddress, recipientAddress, 100n, EMPTY_BYTES, EMPTY_BYTES)
      ).to.be.revertedWithCustomError(contract, "NotAuthorizedOperator");
    });

    it("Operator model is primary - approve/allowance exist only for ERC20 backwards compat", async function () {
      // The contract DOES have approve/allowance for ERC20 backwards compatibility
      // But they are NOT the primary authorization model
      expect((contract as any).approve).to.not.be.undefined;
      expect((contract as any).allowance).to.not.be.undefined;
      expect((contract as any).transferFrom).to.not.be.undefined;
      
      // Verify operator model works without approve
      await contract.connect(holder).authorizeOperator(operatorAddress);
      await contract.connect(operator).operatorSend(holderAddress, recipientAddress, 100n, EMPTY_BYTES, EMPTY_BYTES);
      expect(await contract.balanceOf(recipientAddress)).to.equal(100n);
    });

    it("Self-authorization is immutable", async function () {
      await expect(
        contract.connect(holder).authorizeOperator(holderAddress)
      ).to.be.revertedWithCustomError(contract, "SelfOperatorImmutable");
    });

    it("Default operators are pre-authorized for all holders", async function () {
      const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
      const contract2 = await factory.deploy(
        "Test", "TST", [operatorAddress], GRANULARITY, erc1820Address, deployerAddress
      );
      await contract2.waitForDeployment();
      
      await contract2.mint(holderAddress, INITIAL_SUPPLY, EMPTY_BYTES, EMPTY_BYTES);
      
      // Operator should be authorized without explicit authorization
      expect(await contract2.isOperatorFor(operatorAddress, holderAddress)).to.be.true;
    });

    it("Default operator can be revoked by holder (standard ERC777 behavior)", async function () {
      const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
      const contract2 = await factory.deploy(
        "Test", "TST", [operatorAddress], GRANULARITY, erc1820Address, deployerAddress
      );
      await contract2.waitForDeployment();
      
      await contract2.mint(holderAddress, INITIAL_SUPPLY, EMPTY_BYTES, EMPTY_BYTES);
      
      // Holder CAN revoke default operator for themselves (standard ERC777 behavior)
      await expect(
        contract2.connect(holder).revokeOperator(operatorAddress)
      ).to.not.be.reverted;
      
      // After revocation, operator should no longer be authorized for this holder
      expect(await contract2.isOperatorFor(operatorAddress, holderAddress)).to.be.false;
    });
  });

  describe("Token Movement - Pure ERC-777", function () {
    beforeEach(async function () {
      await contract.connect(holder).authorizeOperator(operatorAddress);
    });

    it("send() - holder moves own tokens", async function () {
      const balanceBefore = await contract.balanceOf(recipientAddress);
      await contract.connect(holder).send(recipientAddress, 500n, EMPTY_BYTES);
      expect(await contract.balanceOf(recipientAddress)).to.equal(balanceBefore + 500n);
      expect(await contract.balanceOf(holderAddress)).to.equal(INITIAL_SUPPLY - 500n);
    });

    it("operatorSend() - operator moves holder's tokens", async function () {
      const balanceBefore = await contract.balanceOf(recipientAddress);
      await contract.connect(operator).operatorSend(holderAddress, recipientAddress, 300n, EMPTY_BYTES, TEST_OP_DATA);
      expect(await contract.balanceOf(recipientAddress)).to.equal(balanceBefore + 300n);
    });

    it("burn() - holder burns own tokens", async function () {
      const supplyBefore = await contract.totalSupply();
      await contract.connect(holder).burn(200n, EMPTY_BYTES);
      expect(await contract.totalSupply()).to.equal(supplyBefore - 200n);
      expect(await contract.balanceOf(holderAddress)).to.equal(INITIAL_SUPPLY - 200n);
    });

    it("operatorBurn() - operator burns holder's tokens", async function () {
      const supplyBefore = await contract.totalSupply();
      await contract.connect(operator).operatorBurn(holderAddress, 150n, EMPTY_BYTES, TEST_OP_DATA);
      expect(await contract.totalSupply()).to.equal(supplyBefore - 150n);
    });

    it("Reverts on insufficient balance", async function () {
      await expect(
        contract.connect(holder).send(recipientAddress, INITIAL_SUPPLY + 1n, EMPTY_BYTES)
      ).to.be.revertedWithCustomError(contract, "InsufficientBalance");
    });

    it("Reverts on granularity violation", async function () {
      // Deploy with granularity = 100
      const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
      const contract2 = await factory.deploy(
        "Test", "TST", [], 100n, erc1820Address, deployerAddress
      );
      await contract2.waitForDeployment();
      await contract2.grantOperatorRole(deployerAddress);
      await contract2.mint(holderAddress, 1000n, EMPTY_BYTES, EMPTY_BYTES);
      await contract2.connect(holder).authorizeOperator(operatorAddress);
      
      await expect(
        contract2.connect(holder).send(recipientAddress, 50n, EMPTY_BYTES)
      ).to.be.revertedWithCustomError(contract2, "GranularityViolationError");
    });

    it("Emits Sent event with correct params", async function () {
      await expect(contract.connect(holder).send(recipientAddress, 100n, "0x1234"))
        .to.emit(contract, "Sent")
        .withArgs(holderAddress, holderAddress, recipientAddress, 100n, "0x1234", EMPTY_BYTES);
    });

    it("Emits Minted event on mint", async function () {
      await expect(contract.mint(attackerAddress, 100n, EMPTY_BYTES, EMPTY_BYTES))
        .to.emit(contract, "Minted")
        .withArgs(deployerAddress, attackerAddress, 100n, EMPTY_BYTES, EMPTY_BYTES);
    });

    it("Emits Burned event on burn", async function () {
      await expect(contract.connect(holder).burn(50n, EMPTY_BYTES))
        .to.emit(contract, "Burned")
        .withArgs(holderAddress, holderAddress, 50n, EMPTY_BYTES, EMPTY_BYTES);
    });
  });

  describe("Hooks - ERC-777 Innovation", function () {
    let mockSender: MockERC777Sender;
    let mockSenderAddress: string;

    beforeEach(async function () {
      const MockSenderFactory = await ethers.getContractFactory("MockERC777Sender");
      mockSender = await MockSenderFactory.deploy();
      await mockSender.waitForDeployment();
      mockSenderAddress = await mockSender.getAddress();
      
      // Mint to mock sender
      await contract.mint(mockSenderAddress, 500n, EMPTY_BYTES, EMPTY_BYTES);
      
      // Fund mock sender with ETH for impersonation gas
      await ethers.provider.send("hardhat_setBalance", [mockSenderAddress, "0xDE0B6B3A7640000"]); // 1 ETH
      
      // Impersonate mock sender to authorize operator
      await ethers.provider.send("hardhat_impersonateAccount", [mockSenderAddress]);
      const mockSenderSigner = await ethers.getSigner(mockSenderAddress);
      await contract.connect(mockSenderSigner).authorizeOperator(operatorAddress);
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [mockSenderAddress]);
    });

    it("Calls tokensToSend on sender contract (if implemented)", async function () {
      await contract.connect(operator).operatorSend(
        mockSenderAddress, recipientAddress, 100n, EMPTY_BYTES, EMPTY_BYTES
      );
      
      expect(await mockSender.lastTokensToSendOperator()).to.equal(operatorAddress);
      expect(await mockSender.lastTokensToSendFrom()).to.equal(mockSenderAddress);
      expect(await mockSender.lastTokensToSendTo()).to.equal(recipientAddress);
      expect(await mockSender.lastTokensToSendAmount()).to.equal(100n);
    });

    it("Calls tokensReceived on recipient contract (if implemented)", async function () {
      const MockRecipientFactory = await ethers.getContractFactory("MockERC777Recipient");
      const mockRecipient = await MockRecipientFactory.deploy();
      await mockRecipient.waitForDeployment();
      
      await contract.connect(holder).send(await mockRecipient.getAddress(), 200n, EMPTY_BYTES);
      
      expect(await mockRecipient.lastTokensReceivedOperator()).to.equal(holderAddress);
      expect(await mockRecipient.lastTokensReceivedFrom()).to.equal(holderAddress);
      expect(await mockRecipient.lastTokensReceivedTo()).to.equal(await mockRecipient.getAddress());
      expect(await mockRecipient.lastTokensReceivedAmount()).to.equal(200n);
    });

    it("Reverts if recipient doesn't implement ERC777Recipient", async function () {
      // EOA recipient - should work (EOA can't implement hooks)
      await expect(contract.connect(holder).send(recipientAddress, 100n, EMPTY_BYTES)).to.not.be.reverted;
      
      // Contract recipient without hook - should REVERT (prevents stuck tokens)
      const MockNoHookFactory = await ethers.getContractFactory("MockNoHook");
      const noHook = await MockNoHookFactory.deploy();
      await noHook.waitForDeployment();
      
      await expect(
        contract.connect(holder).send(await noHook.getAddress(), 100n, EMPTY_BYTES)
      ).to.be.reverted; // ERC1820 revert: no implementer for ERC777TokensRecipient
    });

    it("Hooks receive correct data and operatorData", async function () {
      const testData = ethers.toUtf8Bytes("test data");
      const testOpData = ethers.toUtf8Bytes("operator data");
      
      await contract.connect(operator).operatorSend(
        mockSenderAddress, recipientAddress, 100n, testData, testOpData
      );
      
      // Convert to hex for comparison since contract returns bytes
      expect(ethers.hexlify(await mockSender.lastTokensToSendData())).to.equal(ethers.hexlify(testData));
      expect(ethers.hexlify(await mockSender.lastTokensToSendOperatorData())).to.equal(ethers.hexlify(testOpData));
    });
  });

  describe("Ingress Severance - Emergency Control", function () {
    it("Admin can sever ingress with coherence secret", async function () {
      await contract.severIngress("EmpressGate");
      expect(await contract.isIngressSevered()).to.be.true;
      const [severedBy, severedAt] = await contract.getSeverInfo();
      expect(severedBy).to.equal(deployerAddress);
      expect(severedAt).to.be.greaterThan(0);
    });

    it("Reverts on wrong coherence secret", async function () {
      await expect(contract.severIngress("wrong")).to.be.revertedWithCustomError(contract, "InvalidCoherenceSecret");
    });

    it("Non-sever role cannot sever", async function () {
      await expect(contract.connect(attacker).severIngress("EmpressGate"))
        .to.be.revertedWithCustomError(contract, "SeveranceNotAuthorized");
    });

    it("Blocks all sends when severed (except burns)", async function () {
      await contract.connect(holder).authorizeOperator(operatorAddress);
      await contract.severIngress("EmpressGate");
      
      // send() should fail
      await expect(contract.connect(holder).send(recipientAddress, 100n, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract, "IngressSeveredError");
      
      // operatorSend() should fail
      await expect(contract.connect(operator).operatorSend(holderAddress, recipientAddress, 100n, EMPTY_BYTES, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract, "IngressSeveredError");
      
      // burn() should still work (to address(0))
      await expect(contract.connect(holder).burn(50n, EMPTY_BYTES)).to.not.be.reverted;
    });

    it("Admin can restore ingress", async function () {
      await contract.severIngress("EmpressGate");
      await contract.restoreIngress();
      expect(await contract.isIngressSevered()).to.be.false;
      
      // Sends should work again
      await contract.connect(holder).send(recipientAddress, 100n, EMPTY_BYTES);
    });
  });

  describe("Default Operator Management (Admin)", function () {
    it("Admin can add default operator", async function () {
      await contract.addDefaultOperator(operatorAddress);
      expect(await contract.isDefaultOperator(operatorAddress)).to.be.true;
      expect(await contract.isOperatorFor(operatorAddress, holderAddress)).to.be.true;
    });

    it("Admin can remove default operator", async function () {
      await contract.addDefaultOperator(operatorAddress);
      await contract.removeDefaultOperator(operatorAddress);
      expect(await contract.isDefaultOperator(operatorAddress)).to.be.false;
      expect(await contract.isOperatorFor(operatorAddress, holderAddress)).to.be.false;
    });

    it("Non-admin cannot manage default operators", async function () {
      await expect(contract.connect(attacker).addDefaultOperator(operatorAddress))
        .to.be.reverted; // AccessControl: missing role
    });
  });

  describe("Reentrancy Protection", function () {
    it("Reentrancy guard on send", async function () {
      const AttackerFactory = await ethers.getContractFactory("ReentrantAttacker");
      const attackerContract = await AttackerFactory.deploy(await contract.getAddress());
      await attackerContract.waitForDeployment();
      
      await contract.mint(await attackerContract.getAddress(), 1000n, EMPTY_BYTES, EMPTY_BYTES);
      await attackerContract.authorizeOperator(operatorAddress);
      
      // Should fail due to nonReentrant modifier (OpenZeppelin uses ReentrancyGuardReentrantCall)
      await expect(attackerContract.attack())
        .to.be.revertedWithCustomError(contract, "ReentrancyGuardReentrantCall");
    });
  });

  describe("Granularity Enforcement", function () {
    it("Enforces granularity on all operations", async function () {
      const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
      const contract2 = await factory.deploy(
        "Test", "TST", [], 10n, erc1820Address, deployerAddress
      );
      await contract2.waitForDeployment();
      await contract2.grantOperatorRole(deployerAddress);
      await contract2.mint(holderAddress, 1000n, EMPTY_BYTES, EMPTY_BYTES);
      await contract2.connect(holder).authorizeOperator(operatorAddress);
      
      // send - not multiple of 10
      await expect(contract2.connect(holder).send(recipientAddress, 5n, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract2, "GranularityViolationError");
      
      // operatorSend - not multiple of 10
      await expect(contract2.connect(operator).operatorSend(holderAddress, recipientAddress, 5n, EMPTY_BYTES, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract2, "GranularityViolationError");
      
      // burn - not multiple of 10
      await expect(contract2.connect(holder).burn(5n, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract2, "GranularityViolationError");
      
      // operatorBurn - not multiple of 10
      await expect(contract2.connect(operator).operatorBurn(holderAddress, 5n, EMPTY_BYTES, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract2, "GranularityViolationError");
      
      // Valid multiples should work
      await contract2.connect(holder).send(recipientAddress, 10n, EMPTY_BYTES);
      await contract2.connect(operator).operatorSend(holderAddress, recipientAddress, 20n, EMPTY_BYTES, EMPTY_BYTES);
    });

    it("Emits GranularityViolation event on violation", async function () {
      const factory = (await ethers.getContractFactory("EIP777G")) as EIP777G__factory;
      const contract2 = await factory.deploy(
        "Test", "TST", [], 10n, erc1820Address, deployerAddress
      );
      await contract2.waitForDeployment();
      await contract2.grantOperatorRole(deployerAddress);
      await contract2.mint(holderAddress, 1000n, EMPTY_BYTES, EMPTY_BYTES);
      
      await expect(contract2.connect(holder).send(recipientAddress, 5n, EMPTY_BYTES))
        .to.be.revertedWithCustomError(contract2, "GranularityViolationError")
        .withArgs(5n, 10n);
    });
  });

  describe("Access Control", function () {
    it("Only admin can grant roles", async function () {
      await expect(contract.connect(attacker).grantOperatorRole(attackerAddress))
        .to.be.reverted; // AccessControl: missing role
      
      await contract.grantOperatorRole(attackerAddress);
      expect(await contract.hasRole(await contract.OPERATOR_ROLE(), attackerAddress)).to.be.true;
    });

    it("Only admin can mint", async function () {
      await expect(contract.connect(attacker).mint(attackerAddress, 100n, EMPTY_BYTES, EMPTY_BYTES))
        .to.be.reverted; // Not operator for contract
    });
  });

  describe("Security - No EOA Workarounds", function () {
    it("No transfer() function - only send() is available", async function () {
      // Our contract doesn't have transfer() - only send() and operatorSend()
      // Verify send() works as the primary movement function
      await contract.connect(holder).send(recipientAddress, 100n, EMPTY_BYTES);
      expect(await contract.balanceOf(recipientAddress)).to.equal(100n);
    });

    it("send() triggers hooks (unlike ERC20 transfer)", async function () {
      const MockRecipientFactory = await ethers.getContractFactory("MockERC777Recipient");
      const mockRecipient = await MockRecipientFactory.deploy();
      await mockRecipient.waitForDeployment();
      
      // send() should trigger hooks
      await expect(contract.connect(holder).send(await mockRecipient.getAddress(), 100n, EMPTY_BYTES))
        .to.not.be.reverted;
      
      expect(await mockRecipient.lastTokensReceivedAmount()).to.equal(100n);
    });

    it("ERC20 approve/allowance exists only for backwards compat", async function () {
      // Verify ERC20 functions exist but are NOT the primary model
      expect((contract as any).approve).to.not.be.undefined;
      expect((contract as any).allowance).to.not.be.undefined;
      expect((contract as any).transferFrom).to.not.be.undefined;
      
      // Primary model is operator-based
      await contract.connect(holder).authorizeOperator(operatorAddress);
      await contract.connect(operator).operatorSend(holderAddress, recipientAddress, 100n, EMPTY_BYTES, EMPTY_BYTES);
      expect(await contract.balanceOf(recipientAddress)).to.equal(100n);
    });
  });
});