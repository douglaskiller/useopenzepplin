// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AirdropV2
 * @dev A contract for managing airdrops of any ERC20 token with registration period
 */
contract AirdropV2 is Ownable {
    using SafeERC20 for IERC20;
    
    // The token being airdropped
    IERC20 public immutable token;
    
    // Airdrop period
    uint256 public registrationStartTime;
    uint256 public registrationEndTime;
    
    // Airdrop state
    bool public isDistributionComplete;
    uint256 public totalAirdropAmount;
    uint256 public distributedAmount;
    
    // Uniform amount per user
    uint256 public amountPerUser;
    bool public isAmountSet;
    
    // Mapping of registered addresses
    mapping(address => bool) public isRegistered;
    address[] public registeredAddresses;
    
    // Events
    event RegistrationPeriodSet(uint256 startTime, uint256 endTime);
    event UserRegistered(address indexed user);
    event TokensAdded(uint256 amount);
    event UniformAmountSet(uint256 amount);
    event TokensDistributed(address indexed user, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _token The address of the ERC20 token to be airdropped
     */
    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Airdrop: token address cannot be zero");
        token = IERC20(_token);
    }
    
    /**
     * @dev Set the registration period for the airdrop
     * @param _startTime The start time of the registration period
     * @param _endTime The end time of the registration period
     */
    function setRegistrationPeriod(uint256 _startTime, uint256 _endTime) external onlyOwner {
        require(_startTime < _endTime, "Airdrop: start time must be before end time");
        require(_endTime > block.timestamp, "Airdrop: end time must be in the future");
        require(registeredAddresses.length == 0, "Airdrop: cannot change period after registrations");
        
        registrationStartTime = _startTime;
        registrationEndTime = _endTime;
        
        emit RegistrationPeriodSet(_startTime, _endTime);
    }
    
    /**
     * @dev Register for the airdrop
     */
    function register() external {
        require(block.timestamp >= registrationStartTime, "Airdrop: registration not started");
        require(block.timestamp <= registrationEndTime, "Airdrop: registration ended");
        require(!isRegistered[msg.sender], "Airdrop: already registered");
        
        isRegistered[msg.sender] = true;
        registeredAddresses.push(msg.sender);
        
        emit UserRegistered(msg.sender);
    }
    
    /**
     * @dev Add tokens to the airdrop
     * @param amount The amount of tokens to add
     */
    function addTokensToAirdrop(uint256 amount) external onlyOwner {
        require(amount > 0, "Airdrop: amount must be greater than zero");
        
        // Transfer tokens from owner to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        totalAirdropAmount += amount;
        
        emit TokensAdded(amount);
    }
    
    /**
     * @dev Set uniform airdrop amount per user
     * @param amount The amount of tokens each registered user will receive
     */
    function setUniformAmount(uint256 amount) external onlyOwner {
        require(block.timestamp > registrationEndTime, "Airdrop: registration period not ended");
        require(!isDistributionComplete, "Airdrop: distribution already complete");
        require(!isAmountSet, "Airdrop: amount already set");
        require(registeredAddresses.length > 0, "Airdrop: no registered users");
        
        uint256 totalRequired = amount * registeredAddresses.length;
        require(totalRequired <= totalAirdropAmount, "Airdrop: insufficient tokens for distribution");
        
        amountPerUser = amount;
        isAmountSet = true;
        distributedAmount = totalRequired;
        
        emit UniformAmountSet(amount);
    }
    
    /**
     * @dev Distribute tokens to registered users
     */
    function distributeTokens() external onlyOwner {
        require(block.timestamp > registrationEndTime, "Airdrop: registration period not ended");
        require(!isDistributionComplete, "Airdrop: distribution already complete");
        require(isAmountSet, "Airdrop: amount not set");
        
        for (uint256 i = 0; i < registeredAddresses.length; i++) {
            address user = registeredAddresses[i];
            token.safeTransfer(user, amountPerUser);
            emit TokensDistributed(user, amountPerUser);
        }
        
        isDistributionComplete = true;
    }
    
    /**
     * @dev Get the number of registered users
     * @return The number of registered users
     */
    function getRegisteredCount() external view returns (uint256) {
        return registeredAddresses.length;
    }
    
    /**
     * @dev Get all registered addresses
     * @return Array of registered addresses
     */
    function getAllRegisteredAddresses() external view returns (address[] memory) {
        return registeredAddresses;
    }
    
    /**
     * @dev Calculate the total tokens needed for distribution
     * @return The total tokens needed
     */
    function calculateTotalTokensNeeded() external view returns (uint256) {
        if (!isAmountSet || registeredAddresses.length == 0) {
            return 0;
        }
        return amountPerUser * registeredAddresses.length;
    }
    
    /**
     * @dev Withdraw any remaining tokens after distribution
     * @param to Address to send the tokens to
     */
    function withdrawRemainingTokens(address to) external onlyOwner {
        require(isDistributionComplete, "Airdrop: distribution not complete");
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.safeTransfer(to, balance);
        }
    }
}
