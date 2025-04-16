// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TestTokenA.sol";

/**
 * @title Airdrop
 * @dev A contract for managing token airdrops with registration period
 */
contract Airdrop is Ownable {
    // The token being airdropped
    TestTokenA public immutable token;
    
    // Airdrop period
    uint256 public registrationStartTime;
    uint256 public registrationEndTime;
    
    // Airdrop state
    bool public isDistributionComplete;
    uint256 public totalAirdropAmount;
    uint256 public distributedAmount;
    
    // Mapping of registered addresses
    mapping(address => bool) public isRegistered;
    address[] public registeredAddresses;
    
    // Mapping of airdrop amounts
    mapping(address => uint256) public airdropAmounts;
    
    // Events
    event RegistrationPeriodSet(uint256 startTime, uint256 endTime);
    event UserRegistered(address indexed user);
    event AirdropAmountSet(address indexed user, uint256 amount);
    event TokensDistributed(address indexed user, uint256 amount);
    event TokensMinted(uint256 amount);
    
    /**
     * @dev Constructor
     * @param _token The address of the TestTokenA token
     */
    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Airdrop: token address cannot be zero");
        token = TestTokenA(_token);
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
     * @dev Mint tokens for the airdrop
     * @param amount The amount of tokens to mint
     */
    function mintTokensForAirdrop(uint256 amount) external onlyOwner {
        token.mint(address(this), amount);
        totalAirdropAmount += amount;
        
        emit TokensMinted(amount);
    }
    
    /**
     * @dev Set airdrop amounts for registered users
     * @param users Array of user addresses
     * @param amounts Array of token amounts
     */
    function setAirdropAmounts(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(block.timestamp > registrationEndTime, "Airdrop: registration period not ended");
        require(users.length == amounts.length, "Airdrop: arrays length mismatch");
        require(!isDistributionComplete, "Airdrop: distribution already complete");
        
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            require(isRegistered[users[i]], "Airdrop: user not registered");
            airdropAmounts[users[i]] = amounts[i];
            totalAmount += amounts[i];
            
            emit AirdropAmountSet(users[i], amounts[i]);
        }
        
        require(distributedAmount + totalAmount <= totalAirdropAmount, "Airdrop: insufficient tokens for distribution");
        distributedAmount += totalAmount;
    }
    
    /**
     * @dev Distribute tokens to registered users
     */
    function distributeTokens() external onlyOwner {
        require(block.timestamp > registrationEndTime, "Airdrop: registration period not ended");
        require(!isDistributionComplete, "Airdrop: distribution already complete");
        
        for (uint256 i = 0; i < registeredAddresses.length; i++) {
            address user = registeredAddresses[i];
            uint256 amount = airdropAmounts[user];
            
            if (amount > 0) {
                token.transfer(user, amount);
                emit TokensDistributed(user, amount);
            }
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
     * @dev Withdraw any remaining tokens after distribution
     * @param to Address to send the tokens to
     */
    function withdrawRemainingTokens(address to) external onlyOwner {
        require(isDistributionComplete, "Airdrop: distribution not complete");
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.transfer(to, balance);
        }
    }
}
