// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Faucet is Ownable {
    ERC20 public immutable token;
    uint256 public dailyLimit;
    uint256 public constant DAY_IN_SECONDS = 86400;
    uint256 public totalDistributed;
    mapping(address => uint256) public lastWithdrawal;
    mapping(address => uint256) public dailyWithdrawn;
    mapping(address => uint256) public dailyTotal;
    address[] public userSet;

    error AlreadyWithdrawnToday();
    error DailyLimitExceeded();
    error InvalidResetTime();

    event TokensWithdrawn(address indexed user, uint256 amount);
    event TokensFunded(address indexed sender, uint256 amount);
    event DailyReset();

    constructor(address _tokenAddress, uint256 _dailyLimit) Ownable(msg.sender) {
        token = ERC20(_tokenAddress);
        dailyLimit = _dailyLimit;
    }

    function fundFaucet(uint256 amount) external onlyOwner {
        token.transferFrom(msg.sender, address(this), amount);
        emit TokensFunded(msg.sender, amount);
    }

    function withdraw() external {
        uint256 currentTime = block.timestamp;
        address user = msg.sender;

        // Reset daily withdrawal if 24 hours have passed
        if (lastWithdrawal[user] > 0 && currentTime - lastWithdrawal[user] >= DAY_IN_SECONDS) {
            dailyWithdrawn[user] = 0;
        }

        if (dailyWithdrawn[user] >= dailyLimit) {
            revert DailyLimitExceeded();
        }

        uint256 available = dailyLimit - dailyWithdrawn[user];

        dailyTotal[user] += available;
        totalDistributed += available;
        dailyWithdrawn[user] = dailyLimit;
        lastWithdrawal[user] = currentTime;

        bool userExists = false;
        for (uint256 i = 0; i < userSet.length; i++) {
            if (userSet[i] == user) {
                userExists = true;
                break;
            }
        }
        if (!userExists) {
            userSet.push(user);
        }

        token.transfer(user, available);
        emit TokensWithdrawn(user, available);
    }

    function resetDailyTotals() external onlyOwner {
        if (block.timestamp % DAY_IN_SECONDS != 0) revert InvalidResetTime();
        
        for (uint256 i = 0; i < userSet.length; i++) {
            dailyWithdrawn[userSet[i]] = 0;
        }
        emit DailyReset();
    }

    function getTotalDistributed() external view returns (uint256) {
        return totalDistributed;
    }

    function getDailyTotal(address user) external view returns (uint256) {
        return dailyTotal[user];
    }

    receive() external payable {}
}
