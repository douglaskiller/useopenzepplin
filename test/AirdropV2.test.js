const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AirdropV2", function () {
  let airdropV2;
  let tokenA;
  let tokenB;
  let owner;
  let user1;
  let user2;
  let user3;
  
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
  const AIRDROP_AMOUNT = ethers.parseUnits("100000", 18);
  const AMOUNT_PER_USER = ethers.parseUnits("1000", 18);
  
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy test tokens
    const TokenA = await ethers.getContractFactory("TestTokenA");
    tokenA = await TokenA.deploy();
    
    const TokenB = await ethers.getContractFactory("TestTokenB");
    tokenB = await TokenB.deploy();
    
    // Deploy AirdropV2 with TokenA
    const AirdropV2 = await ethers.getContractFactory("AirdropV2");
    airdropV2 = await AirdropV2.deploy(await tokenA.getAddress());
    
    // Approve tokens for airdrop
    await tokenA.approve(await airdropV2.getAddress(), AIRDROP_AMOUNT);
  });
  
  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      expect(await airdropV2.token()).to.equal(await tokenA.getAddress());
    });
    
    it("Should set the owner correctly", async function () {
      expect(await airdropV2.owner()).to.equal(owner.address);
    });
    
    it("Should deploy with any ERC20 token", async function () {
      const AirdropV2 = await ethers.getContractFactory("AirdropV2");
      const airdropWithTokenB = await AirdropV2.deploy(await tokenB.getAddress());
      
      expect(await airdropWithTokenB.token()).to.equal(await tokenB.getAddress());
    });
  });
  
  describe("Registration Period", function () {
    it("Should set registration period correctly", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = currentTime + 3600; // 1 hour later
      
      await airdropV2.setRegistrationPeriod(startTime, endTime);
      
      expect(await airdropV2.registrationStartTime()).to.equal(startTime);
      expect(await airdropV2.registrationEndTime()).to.equal(endTime);
    });
    
    it("Should fail if end time is before start time", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime + 3600;
      const endTime = currentTime + 100;
      
      await expect(
        airdropV2.setRegistrationPeriod(startTime, endTime)
      ).to.be.revertedWith("Airdrop: start time must be before end time");
    });
    
    it("Should fail if end time is in the past", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime - 3600;
      const endTime = currentTime - 100;
      
      await expect(
        airdropV2.setRegistrationPeriod(startTime, endTime)
      ).to.be.revertedWith("Airdrop: end time must be in the future");
    });
    
    it("Should fail if non-owner tries to set registration period", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = currentTime + 3600;
      
      await expect(
        airdropV2.connect(user1).setRegistrationPeriod(startTime, endTime)
      ).to.be.reverted;
    });
  });
  
  describe("Token Management", function () {
    it("Should add tokens to airdrop correctly", async function () {
      await airdropV2.addTokensToAirdrop(AIRDROP_AMOUNT);
      
      expect(await tokenA.balanceOf(await airdropV2.getAddress())).to.equal(AIRDROP_AMOUNT);
      expect(await airdropV2.totalAirdropAmount()).to.equal(AIRDROP_AMOUNT);
    });
    
    it("Should fail if adding zero tokens", async function () {
      await expect(
        airdropV2.addTokensToAirdrop(0)
      ).to.be.revertedWith("Airdrop: amount must be greater than zero");
    });
    
    it("Should fail if non-owner tries to add tokens", async function () {
      await expect(
        airdropV2.connect(user1).addTokensToAirdrop(AIRDROP_AMOUNT)
      ).to.be.reverted;
    });
  });
  
  describe("Registration and Distribution", function () {
    beforeEach(async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      // Set registration period to start now and end in 1 hour
      const startTime = currentTime;
      const endTime = currentTime + 3600;
      
      await airdropV2.setRegistrationPeriod(startTime, endTime);
      
      // Add tokens to airdrop
      await airdropV2.addTokensToAirdrop(AIRDROP_AMOUNT);
    });
    
    it("Should allow users to register", async function () {
      await airdropV2.connect(user1).register();
      
      expect(await airdropV2.isRegistered(user1.address)).to.be.true;
      expect(await airdropV2.getRegisteredCount()).to.equal(1);
      
      const registeredAddresses = await airdropV2.getAllRegisteredAddresses();
      expect(registeredAddresses[0]).to.equal(user1.address);
    });
    
    it("Should not allow duplicate registrations", async function () {
      await airdropV2.connect(user1).register();
      
      await expect(
        airdropV2.connect(user1).register()
      ).to.be.revertedWith("Airdrop: already registered");
    });
    
    it("Should allow multiple users to register", async function () {
      await airdropV2.connect(user1).register();
      await airdropV2.connect(user2).register();
      await airdropV2.connect(user3).register();
      
      expect(await airdropV2.getRegisteredCount()).to.equal(3);
      expect(await airdropV2.isRegistered(user1.address)).to.be.true;
      expect(await airdropV2.isRegistered(user2.address)).to.be.true;
      expect(await airdropV2.isRegistered(user3.address)).to.be.true;
    });
    
    it("Should set uniform amount correctly", async function () {
      // Register users
      await airdropV2.connect(user1).register();
      await airdropV2.connect(user2).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      // Set uniform amount
      await airdropV2.setUniformAmount(AMOUNT_PER_USER);
      
      expect(await airdropV2.amountPerUser()).to.equal(AMOUNT_PER_USER);
      expect(await airdropV2.isAmountSet()).to.be.true;
      
      // Check distributed amount (2 users * amount per user)
      expect(await airdropV2.distributedAmount()).to.equal(AMOUNT_PER_USER * 2n);
    });
    
    it("Should fail if setting amount before registration period ends", async function () {
      await airdropV2.connect(user1).register();
      
      await expect(
        airdropV2.setUniformAmount(AMOUNT_PER_USER)
      ).to.be.revertedWith("Airdrop: registration period not ended");
    });
    
    it("Should fail if setting amount with no registered users", async function () {
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      await expect(
        airdropV2.setUniformAmount(AMOUNT_PER_USER)
      ).to.be.revertedWith("Airdrop: no registered users");
    });
    
    it("Should fail if total amount exceeds available tokens", async function () {
      // Register many users
      await airdropV2.connect(user1).register();
      await airdropV2.connect(user2).register();
      await airdropV2.connect(user3).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      // Try to set a very high amount per user
      const highAmount = AIRDROP_AMOUNT / 2n + 1n; // More than available per user
      
      await expect(
        airdropV2.setUniformAmount(highAmount)
      ).to.be.revertedWith("Airdrop: insufficient tokens for distribution");
    });
    
    it("Should distribute tokens correctly", async function () {
      // Register users
      await airdropV2.connect(user1).register();
      await airdropV2.connect(user2).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      // Set uniform amount
      await airdropV2.setUniformAmount(AMOUNT_PER_USER);
      
      // Get initial balances
      const initialUser1Balance = await tokenA.balanceOf(user1.address);
      const initialUser2Balance = await tokenA.balanceOf(user2.address);
      
      // Distribute tokens
      await airdropV2.distributeTokens();
      
      // Check final balances
      expect(await tokenA.balanceOf(user1.address)).to.equal(initialUser1Balance + AMOUNT_PER_USER);
      expect(await tokenA.balanceOf(user2.address)).to.equal(initialUser2Balance + AMOUNT_PER_USER);
      expect(await airdropV2.isDistributionComplete()).to.be.true;
    });
    
    it("Should fail if distributing before setting amount", async function () {
      // Register users
      await airdropV2.connect(user1).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      await expect(
        airdropV2.distributeTokens()
      ).to.be.revertedWith("Airdrop: amount not set");
    });
    
    it("Should fail if distributing before registration period ends", async function () {
      // Register users
      await airdropV2.connect(user1).register();
      
      // Try to distribute without waiting for registration period to end
      await expect(
        airdropV2.distributeTokens()
      ).to.be.revertedWith("Airdrop: registration period not ended");
    });
    
    it("Should not allow multiple distributions", async function () {
      // Register users
      await airdropV2.connect(user1).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      // Set uniform amount
      await airdropV2.setUniformAmount(AMOUNT_PER_USER);
      
      // Distribute tokens
      await airdropV2.distributeTokens();
      
      // Try to distribute again
      await expect(
        airdropV2.distributeTokens()
      ).to.be.revertedWith("Airdrop: distribution already complete");
    });
    
    it("Should calculate total tokens needed correctly", async function () {
      // Register users
      await airdropV2.connect(user1).register();
      await airdropV2.connect(user2).register();
      await airdropV2.connect(user3).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      // Before setting amount
      expect(await airdropV2.calculateTotalTokensNeeded()).to.equal(0);
      
      // Set uniform amount
      await airdropV2.setUniformAmount(AMOUNT_PER_USER);
      
      // After setting amount
      expect(await airdropV2.calculateTotalTokensNeeded()).to.equal(AMOUNT_PER_USER * 3n);
    });
    
    it("Should allow owner to withdraw remaining tokens after distribution", async function () {
      // Register only one user
      await airdropV2.connect(user1).register();
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      // Set uniform amount
      await airdropV2.setUniformAmount(AMOUNT_PER_USER);
      
      // Distribute tokens
      await airdropV2.distributeTokens();
      
      // Get initial owner balance
      const initialOwnerBalance = await tokenA.balanceOf(owner.address);
      
      // Calculate remaining tokens
      const remainingTokens = AIRDROP_AMOUNT - AMOUNT_PER_USER;
      
      // Withdraw remaining tokens
      await airdropV2.withdrawRemainingTokens(owner.address);
      
      // Check owner balance
      expect(await tokenA.balanceOf(owner.address)).to.equal(initialOwnerBalance + remainingTokens);
    });
    
    it("Should not allow withdrawal before distribution is complete", async function () {
      await expect(
        airdropV2.withdrawRemainingTokens(owner.address)
      ).to.be.revertedWith("Airdrop: distribution not complete");
    });
  });
});
