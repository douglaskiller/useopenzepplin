const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Faucet Contract", function () {
    let faucet;
    let owner;
    let user1;
    let user2;
    let token;
    const DAY_IN_SECONDS = 86400;
    const DAILY_LIMIT = 100;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        const TokenFactory = await ethers.getContractFactory("TestTokenA");
        token = await TokenFactory.deploy();
        await token.waitForDeployment();
        
        const FaucetFactory = await ethers.getContractFactory("Faucet");
        faucet = await FaucetFactory.deploy(await token.getAddress(), DAILY_LIMIT);
        await faucet.waitForDeployment();
        
        // Transfer initial tokens to faucet and users
        await token.transfer(faucet.target, ethers.parseEther("1000"));
        await token.transfer(user1.address, ethers.parseEther("1000"));
        await token.transfer(user2.address, ethers.parseEther("1000"));
    });

    describe("Funding", function () {
        it("Should allow owner to fund faucet", async function () {
            const amount = ethers.parseEther("500");
            await token.connect(owner).approve(faucet.target, amount);
            await faucet.connect(owner).fundFaucet(amount);
            
            const balance = await token.balanceOf(faucet.target);
            expect(balance).to.equal(ethers.parseEther("1500"));
        });
    });

    describe("Withdrawals", function () {
        it("Should allow first withdrawal", async function () {
            const initialBalance = await token.balanceOf(user1.address);
            await faucet.connect(user1).withdraw();
            
            const newBalance = await token.balanceOf(user1.address);
            expect(newBalance).to.equal(initialBalance + BigInt(DAILY_LIMIT));
        });

        it("Should prevent second withdrawal within 24h", async function () {
            await faucet.connect(user1).withdraw();
            await expect(faucet.connect(user1).withdraw())
                .to.be.revertedWithCustomError(faucet, "DailyLimitExceeded");
        });

        it("Should allow withdrawal after 24h", async function () {
            // First withdrawal
            await faucet.connect(user1).withdraw();
            
            // Fast forward exactly 24 hours
            await time.increase(DAY_IN_SECONDS);
            
            // Second withdrawal
            const initialBalance = await token.balanceOf(user1.address);
            await faucet.connect(user1).withdraw();
            
            // Verify balance increased by daily limit
            const newBalance = await token.balanceOf(user1.address);
            expect(newBalance).to.equal(initialBalance + BigInt(DAILY_LIMIT));
        });
    });

    describe("Multi-user functionality", function () {
        it("Should allow multiple users to withdraw", async function () {
            await faucet.connect(user1).withdraw();
            await faucet.connect(user2).withdraw();
            
            const balance1 = await token.balanceOf(user1.address);
            const balance2 = await token.balanceOf(user2.address);
            expect(balance1).to.equal(ethers.parseEther("1000") + BigInt(DAILY_LIMIT));
            expect(balance2).to.equal(ethers.parseEther("1000") + BigInt(DAILY_LIMIT));
        });
    });

    describe("Tracking", function () {
        it("Should track total distributions", async function () {
            await faucet.connect(user1).withdraw();
            await faucet.connect(user2).withdraw();
            
            const total = await faucet.getTotalDistributed();
            expect(total).to.equal(BigInt(DAILY_LIMIT) * 2n);
        });
    });
});
