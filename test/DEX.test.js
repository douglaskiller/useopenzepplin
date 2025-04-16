const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
  let dex;
  let tokenA;
  let tokenB;
  let owner;
  let user1;
  let user2;
  
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
  const LIQUIDITY_AMOUNT_A = ethers.parseUnits("1000", 18);
  const LIQUIDITY_AMOUNT_B = ethers.parseUnits("2000", 18);
  
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy test tokens
    const TokenA = await ethers.getContractFactory("TestTokenA");
    tokenA = await TokenA.deploy();
    
    const TokenB = await ethers.getContractFactory("TestTokenB");
    tokenB = await TokenB.deploy();
    
    // Deploy DEX
    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
    
    // Transfer tokens to users for testing
    await tokenA.transfer(user1.address, LIQUIDITY_AMOUNT_A);
    await tokenB.transfer(user1.address, LIQUIDITY_AMOUNT_B);
    
    await tokenA.transfer(user2.address, LIQUIDITY_AMOUNT_A);
    await tokenB.transfer(user2.address, LIQUIDITY_AMOUNT_B);
    
    // Approve DEX to spend tokens
    await tokenA.connect(owner).approve(await dex.getAddress(), INITIAL_SUPPLY);
    await tokenB.connect(owner).approve(await dex.getAddress(), INITIAL_SUPPLY);
    
    await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT_A);
    await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT_B);
    
    await tokenA.connect(user2).approve(await dex.getAddress(), LIQUIDITY_AMOUNT_A);
    await tokenB.connect(user2).approve(await dex.getAddress(), LIQUIDITY_AMOUNT_B);
  });
  
  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await dex.tokenA()).to.equal(await tokenA.getAddress());
      expect(await dex.tokenB()).to.equal(await tokenB.getAddress());
    });
    
    it("Should have the correct LP token name and symbol", async function () {
      const expectedName = `LP-${await tokenA.symbol()}-${await tokenB.symbol()}`;
      const expectedSymbol = `LP-${await tokenA.symbol()}-${await tokenB.symbol()}`;
      
      expect(await dex.name()).to.equal(expectedName);
      expect(await dex.symbol()).to.equal(expectedSymbol);
    });
  });
  
  describe("Adding Liquidity", function () {
    it("Should add initial liquidity correctly", async function () {
      // Add initial liquidity
      const tx = await dex.connect(owner).addLiquidity(
        LIQUIDITY_AMOUNT_A,
        LIQUIDITY_AMOUNT_B,
        0,
        0,
        owner.address
      );
      
      // Check reserves
      const [reserveA, reserveB] = await dex.getReserves();
      expect(reserveA).to.equal(LIQUIDITY_AMOUNT_A);
      expect(reserveB).to.equal(LIQUIDITY_AMOUNT_B);
      
      // Check LP tokens - just verify it's greater than zero
      expect(await dex.balanceOf(owner.address)).to.be.gt(0);
      
      // Check event
      await expect(tx)
        .to.emit(dex, "LiquidityAdded")
        .withArgs(owner.address, LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B, await dex.balanceOf(owner.address));
    });
    
    it("Should add additional liquidity correctly", async function () {
      // Add initial liquidity
      await dex.connect(owner).addLiquidity(
        LIQUIDITY_AMOUNT_A,
        LIQUIDITY_AMOUNT_B,
        0,
        0,
        owner.address
      );
      
      const initialLPBalance = await dex.balanceOf(owner.address);
      
      // Add more liquidity (half of initial)
      const additionalAmountA = LIQUIDITY_AMOUNT_A / 2n;
      const additionalAmountB = LIQUIDITY_AMOUNT_B / 2n;
      
      await dex.connect(user1).addLiquidity(
        additionalAmountA,
        additionalAmountB,
        0,
        0,
        user1.address
      );
      
      // Check reserves
      const [reserveA, reserveB] = await dex.getReserves();
      expect(reserveA).to.equal(LIQUIDITY_AMOUNT_A + additionalAmountA);
      expect(reserveB).to.equal(LIQUIDITY_AMOUNT_B + additionalAmountB);
      
      // Check LP tokens - just verify it's greater than zero
      expect(await dex.balanceOf(user1.address)).to.be.gt(0);
    });
    
    it("Should fail when adding liquidity with insufficient token approval", async function () {
      // Remove approval
      await tokenA.connect(owner).approve(await dex.getAddress(), 0);
      
      // Try to add liquidity
      await expect(
        dex.connect(owner).addLiquidity(
          LIQUIDITY_AMOUNT_A,
          LIQUIDITY_AMOUNT_B,
          0,
          0,
          owner.address
        )
      ).to.be.reverted;
    });
  });
  
  describe("Removing Liquidity", function () {
    beforeEach(async function () {
      // Add initial liquidity
      await dex.connect(owner).addLiquidity(
        LIQUIDITY_AMOUNT_A,
        LIQUIDITY_AMOUNT_B,
        0,
        0,
        owner.address
      );
    });
    
    it("Should remove liquidity correctly", async function () {
      // Get LP token balance
      const lpBalance = await dex.balanceOf(owner.address);
      
      // Get initial token balances
      const initialTokenABalance = await tokenA.balanceOf(owner.address);
      const initialTokenBBalance = await tokenB.balanceOf(owner.address);
      
      // Remove all liquidity
      const tx = await dex.connect(owner).removeLiquidity(
        lpBalance,
        0,
        0,
        owner.address
      );
      
      // Check LP tokens burned
      expect(await dex.balanceOf(owner.address)).to.equal(0);
      
      // Check tokens returned
      const finalTokenABalance = await tokenA.balanceOf(owner.address);
      const finalTokenBBalance = await tokenB.balanceOf(owner.address);
      
      // Just verify tokens were returned
      expect(finalTokenABalance).to.be.gt(initialTokenABalance);
      expect(finalTokenBBalance).to.be.gt(initialTokenBBalance);
      
      // Check event
      await expect(tx)
        .to.emit(dex, "LiquidityRemoved")
        .withArgs(owner.address, finalTokenABalance - initialTokenABalance, finalTokenBBalance - initialTokenBBalance, lpBalance);
    });
    
    it("Should remove partial liquidity correctly", async function () {
      // Get LP token balance
      const lpBalance = await dex.balanceOf(owner.address);
      const halfLpBalance = lpBalance / 2n;
      
      // Get initial token balances
      const initialTokenABalance = await tokenA.balanceOf(owner.address);
      const initialTokenBBalance = await tokenB.balanceOf(owner.address);
      
      // Remove half of liquidity
      await dex.connect(owner).removeLiquidity(
        halfLpBalance,
        0,
        0,
        owner.address
      );
      
      // Check LP tokens burned
      expect(await dex.balanceOf(owner.address)).to.equal(lpBalance - halfLpBalance);
      
      // Check tokens returned
      const finalTokenABalance = await tokenA.balanceOf(owner.address);
      const finalTokenBBalance = await tokenB.balanceOf(owner.address);
      
      // Just verify tokens were returned
      expect(finalTokenABalance).to.be.gt(initialTokenABalance);
      expect(finalTokenBBalance).to.be.gt(initialTokenBBalance);
    });
    
    it("Should fail when removing more liquidity than owned", async function () {
      // Get LP token balance
      const lpBalance = await dex.balanceOf(owner.address);
      
      // Try to remove more liquidity than owned
      await expect(
        dex.connect(owner).removeLiquidity(
          lpBalance + 1n,
          0,
          0,
          owner.address
        )
      ).to.be.reverted;
    });
    
    it("Should fail when removing liquidity with minimum amount constraints", async function () {
      // Get LP token balance
      const lpBalance = await dex.balanceOf(owner.address);
      
      // Try to remove liquidity with high minimum constraints
      await expect(
        dex.connect(owner).removeLiquidity(
          lpBalance,
          LIQUIDITY_AMOUNT_A * 2n, // More than possible
          0,
          owner.address
        )
      ).to.be.reverted;
      
      await expect(
        dex.connect(owner).removeLiquidity(
          lpBalance,
          0,
          LIQUIDITY_AMOUNT_B * 2n, // More than possible
          owner.address
        )
      ).to.be.reverted;
    });
  });
  
  describe("Multiple Users", function () {
    it("Should handle multiple users adding and removing liquidity", async function () {
      // User 1 adds liquidity
      await dex.connect(user1).addLiquidity(
        LIQUIDITY_AMOUNT_A,
        LIQUIDITY_AMOUNT_B,
        0,
        0,
        user1.address
      );
      
      const user1LpBalance = await dex.balanceOf(user1.address);
      
      // User 2 adds the same amount of liquidity
      await dex.connect(user2).addLiquidity(
        LIQUIDITY_AMOUNT_A,
        LIQUIDITY_AMOUNT_B,
        0,
        0,
        user2.address
      );
      
      const user2LpBalance = await dex.balanceOf(user2.address);
      
      // Both users should have LP tokens
      expect(user1LpBalance).to.be.gt(0);
      expect(user2LpBalance).to.be.gt(0);
      
      // User 1 removes all liquidity
      const user1InitialTokenABalance = await tokenA.balanceOf(user1.address);
      const user1InitialTokenBBalance = await tokenB.balanceOf(user1.address);
      
      await dex.connect(user1).removeLiquidity(
        user1LpBalance,
        0,
        0,
        user1.address
      );
      
      // Check User 1's tokens returned
      const user1FinalTokenABalance = await tokenA.balanceOf(user1.address);
      const user1FinalTokenBBalance = await tokenB.balanceOf(user1.address);
      
      // Just verify tokens were returned
      expect(user1FinalTokenABalance).to.be.gt(user1InitialTokenABalance);
      expect(user1FinalTokenBBalance).to.be.gt(user1InitialTokenBBalance);
      
      // User 2 should still have their LP tokens
      expect(await dex.balanceOf(user2.address)).to.equal(user2LpBalance);
      
      // User 2 removes all liquidity
      const user2InitialTokenABalance = await tokenA.balanceOf(user2.address);
      const user2InitialTokenBBalance = await tokenB.balanceOf(user2.address);
      
      await dex.connect(user2).removeLiquidity(
        user2LpBalance,
        0,
        0,
        user2.address
      );
      
      // Check User 2's tokens returned
      const user2FinalTokenABalance = await tokenA.balanceOf(user2.address);
      const user2FinalTokenBBalance = await tokenB.balanceOf(user2.address);
      
      // Just verify tokens were returned
      expect(user2FinalTokenABalance).to.be.gt(user2InitialTokenABalance);
      expect(user2FinalTokenBBalance).to.be.gt(user2InitialTokenBBalance);
    });
  });
});
