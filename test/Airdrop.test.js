const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Airdrop", function () {
  let airdrop;
  let tokenA;
  let owner;
  let user1;
  let user2;
  let user3;
  
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
  const AIRDROP_AMOUNT = ethers.parseUnits("100000", 18);
  
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy TestTokenA
    const TokenA = await ethers.getContractFactory("TestTokenA");
    tokenA = await TokenA.deploy();
    
    // Deploy Airdrop
    const Airdrop = await ethers.getContractFactory("Airdrop");
    airdrop = await Airdrop.deploy(await tokenA.getAddress());
  });
  
  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      expect(await airdrop.token()).to.equal(await tokenA.getAddress());
    });
    
    it("Should set the owner correctly", async function () {
      expect(await airdrop.owner()).to.equal(owner.address);
    });
  });
  
  describe("Registration Period", function () {
    it("Should set registration period correctly", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = currentTime + 3600; // 1 hour later
      
      await airdrop.setRegistrationPeriod(startTime, endTime);
      
      expect(await airdrop.registrationStartTime()).to.equal(startTime);
      expect(await airdrop.registrationEndTime()).to.equal(endTime);
    });
    
    it("Should fail if end time is before start time", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime + 3600;
      const endTime = currentTime + 100;
      
      await expect(
        airdrop.setRegistrationPeriod(startTime, endTime)
      ).to.be.revertedWith("Airdrop: start time must be before end time");
    });
    
    it("Should fail if end time is in the past", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime - 3600;
      const endTime = currentTime - 100;
      
      await expect(
        airdrop.setRegistrationPeriod(startTime, endTime)
      ).to.be.revertedWith("Airdrop: end time must be in the future");
    });
    
    it("Should fail if non-owner tries to set registration period", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      const startTime = currentTime + 100;
      const endTime = currentTime + 3600;
      
      await expect(
        airdrop.connect(user1).setRegistrationPeriod(startTime, endTime)
      ).to.be.reverted;
    });
  });
  
  describe("Registration", function () {
    beforeEach(async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      // Set registration period to start now and end in 1 hour
      const startTime = currentTime;
      const endTime = currentTime + 3600;
      
      await airdrop.setRegistrationPeriod(startTime, endTime);
    });
    
    it("Should allow users to register", async function () {
      await airdrop.connect(user1).register();
      
      expect(await airdrop.isRegistered(user1.address)).to.be.true;
      expect(await airdrop.getRegisteredCount()).to.equal(1);
      
      const registeredAddresses = await airdrop.getAllRegisteredAddresses();
      expect(registeredAddresses[0]).to.equal(user1.address);
    });
    
    it("Should not allow duplicate registrations", async function () {
      await airdrop.connect(user1).register();
      
      await expect(
        airdrop.connect(user1).register()
      ).to.be.revertedWith("Airdrop: already registered");
    });
    
    it("Should allow multiple users to register", async function () {
      await airdrop.connect(user1).register();
      await airdrop.connect(user2).register();
      await airdrop.connect(user3).register();
      
      expect(await airdrop.getRegisteredCount()).to.equal(3);
      expect(await airdrop.isRegistered(user1.address)).to.be.true;
      expect(await airdrop.isRegistered(user2.address)).to.be.true;
      expect(await airdrop.isRegistered(user3.address)).to.be.true;
    });
    
    it("Should not allow registration before start time", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      // Set future registration period
      const startTime = currentTime + 3600; // 1 hour later
      const endTime = currentTime + 7200; // 2 hours later
      
      await airdrop.setRegistrationPeriod(startTime, endTime);
      
      await expect(
        airdrop.connect(user1).register()
      ).to.be.revertedWith("Airdrop: registration not started");
    });
    
    it("Should not allow registration after end time", async function () {
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      await expect(
        airdrop.connect(user1).register()
      ).to.be.revertedWith("Airdrop: registration ended");
    });
  });
  
  describe("Token Minting and Distribution", function () {
    beforeEach(async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      // Set registration period
      const startTime = currentTime;
      const endTime = currentTime + 3600; // 1 hour later
      
      await airdrop.setRegistrationPeriod(startTime, endTime);
      
      // Register users
      await airdrop.connect(user1).register();
      await airdrop.connect(user2).register();
      
      // Mint tokens for airdrop
      await airdrop.mintTokensForAirdrop(AIRDROP_AMOUNT);
      
      // Simulate time passing - registration period ended
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
    });
    
    it("Should mint tokens for airdrop correctly", async function () {
      expect(await tokenA.balanceOf(await airdrop.getAddress())).to.equal(AIRDROP_AMOUNT);
      expect(await airdrop.totalAirdropAmount()).to.equal(AIRDROP_AMOUNT);
    });
    
    it("Should set airdrop amounts correctly", async function () {
      const user1Amount = ethers.parseUnits("40000", 18);
      const user2Amount = ethers.parseUnits("60000", 18);
      
      await airdrop.setAirdropAmounts(
        [user1.address, user2.address],
        [user1Amount, user2Amount]
      );
      
      expect(await airdrop.airdropAmounts(user1.address)).to.equal(user1Amount);
      expect(await airdrop.airdropAmounts(user2.address)).to.equal(user2Amount);
      expect(await airdrop.distributedAmount()).to.equal(user1Amount + user2Amount);
    });
    
    it("Should fail if total airdrop amount exceeds available tokens", async function () {
      // Set amounts that exceed the total airdrop amount
      const user1Amount = ethers.parseUnits("60000", 18);
      const user2Amount = ethers.parseUnits("60000", 18);
      
      // The total (120,000) exceeds the airdrop amount (100,000)
      await expect(
        airdrop.setAirdropAmounts(
          [user1.address, user2.address],
          [user1Amount, user2Amount]
        )
      ).to.be.revertedWith("Airdrop: insufficient tokens for distribution");
    });
    
    it("Should distribute tokens correctly", async function () {
      const user1Amount = ethers.parseUnits("40000", 18);
      const user2Amount = ethers.parseUnits("60000", 18);
      
      await airdrop.setAirdropAmounts(
        [user1.address, user2.address],
        [user1Amount, user2Amount]
      );
      
      const initialUser1Balance = await tokenA.balanceOf(user1.address);
      const initialUser2Balance = await tokenA.balanceOf(user2.address);
      
      await airdrop.distributeTokens();
      
      expect(await tokenA.balanceOf(user1.address)).to.equal(initialUser1Balance + user1Amount);
      expect(await tokenA.balanceOf(user2.address)).to.equal(initialUser2Balance + user2Amount);
      expect(await airdrop.isDistributionComplete()).to.be.true;
    });
    
    it("Should not allow distribution before registration period ends", async function () {
      // Get the latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTime = latestBlock.timestamp;
      
      // Set new registration period
      const startTime = currentTime;
      const endTime = currentTime + 3600;
      
      const newAirdrop = await (await ethers.getContractFactory("Airdrop")).deploy(await tokenA.getAddress());
      await newAirdrop.setRegistrationPeriod(startTime, endTime);
      
      await expect(
        newAirdrop.distributeTokens()
      ).to.be.revertedWith("Airdrop: registration period not ended");
    });
    
    it("Should not allow multiple distributions", async function () {
      const user1Amount = ethers.parseUnits("40000", 18);
      const user2Amount = ethers.parseUnits("60000", 18);
      
      await airdrop.setAirdropAmounts(
        [user1.address, user2.address],
        [user1Amount, user2Amount]
      );
      
      await airdrop.distributeTokens();
      
      await expect(
        airdrop.distributeTokens()
      ).to.be.revertedWith("Airdrop: distribution already complete");
    });
    
    it("Should allow owner to withdraw remaining tokens after distribution", async function () {
      const user1Amount = ethers.parseUnits("40000", 18);
      
      await airdrop.setAirdropAmounts(
        [user1.address],
        [user1Amount]
      );
      
      await airdrop.distributeTokens();
      
      const initialOwnerBalance = await tokenA.balanceOf(owner.address);
      const remainingTokens = AIRDROP_AMOUNT - user1Amount;
      
      await airdrop.withdrawRemainingTokens(owner.address);
      
      expect(await tokenA.balanceOf(owner.address)).to.equal(initialOwnerBalance + remainingTokens);
    });
    
    it("Should not allow withdrawal before distribution is complete", async function () {
      await expect(
        airdrop.withdrawRemainingTokens(owner.address)
      ).to.be.revertedWith("Airdrop: distribution not complete");
    });
  });
});
