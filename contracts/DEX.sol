// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title DEX
 * @dev A simple decentralized exchange that allows users to:
 * 1. Add liquidity (token pairs) and receive LP tokens
 * 2. Remove liquidity using LP tokens
 */
contract DEX is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // Pair of tokens in the liquidity pool
    address public immutable tokenA;
    address public immutable tokenB;

    // Minimum liquidity to prevent division by zero
    uint256 private constant MINIMUM_LIQUIDITY = 10**3;
    
    // Events
    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);

    /**
     * @dev Constructor to initialize the DEX with a pair of tokens
     * @param _tokenA Address of the first token
     * @param _tokenB Address of the second token
     */
    constructor(address _tokenA, address _tokenB) 
        ERC20(
            string.concat(
                "LP-",
                IERC20Metadata(_tokenA).symbol(),
                "-",
                IERC20Metadata(_tokenB).symbol()
            ),
            string.concat(
                "LP-",
                IERC20Metadata(_tokenA).symbol(),
                "-",
                IERC20Metadata(_tokenB).symbol()
            )
        )
        Ownable(msg.sender)
    {
        require(_tokenA != address(0), "DEX: INVALID_TOKEN_A");
        require(_tokenB != address(0), "DEX: INVALID_TOKEN_B");
        require(_tokenA != _tokenB, "DEX: IDENTICAL_ADDRESSES");
        
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /**
     * @dev Returns the reserves of tokenA and tokenB
     * @return reserveA The reserve of tokenA
     * @return reserveB The reserve of tokenB
     */
    function getReserves() public view returns (uint256 reserveA, uint256 reserveB) {
        reserveA = IERC20(tokenA).balanceOf(address(this));
        reserveB = IERC20(tokenB).balanceOf(address(this));
    }

    /**
     * @dev Adds liquidity to the pool
     * @param amountADesired The amount of tokenA to add
     * @param amountBDesired The amount of tokenB to add
     * @param amountAMin The minimum amount of tokenA to add
     * @param amountBMin The minimum amount of tokenB to add
     * @param to The address that will receive the LP tokens
     * @return amountA The actual amount of tokenA added
     * @return amountB The actual amount of tokenB added
     * @return liquidity The amount of LP tokens minted
     */
    function addLiquidity(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _calculateLiquidityAmounts(
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        
        // Transfer tokens to the contract
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        
        // Calculate liquidity to mint
        liquidity = _mintLiquidity(to);
        
        emit LiquidityAdded(msg.sender, amountA, amountB, liquidity);
    }

    /**
     * @dev Removes liquidity from the pool
     * @param liquidity The amount of LP tokens to burn
     * @param amountAMin The minimum amount of tokenA to receive
     * @param amountBMin The minimum amount of tokenB to receive
     * @param to The address that will receive the tokens
     * @return amountA The amount of tokenA received
     * @return amountB The amount of tokenB received
     */
    function removeLiquidity(
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to
    ) external returns (uint256 amountA, uint256 amountB) {
        // Get reserves before burning LP tokens
        (uint256 reserveA, uint256 reserveB) = getReserves();
        uint256 totalSupply = totalSupply();
        
        // Calculate token amounts to return
        amountA = (liquidity * reserveA) / totalSupply;
        amountB = (liquidity * reserveB) / totalSupply;
        
        require(amountA >= amountAMin, "DEX: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "DEX: INSUFFICIENT_B_AMOUNT");
        
        // Burn LP tokens
        _burn(msg.sender, liquidity);
        
        // Transfer tokens to the user
        if (amountA > 0) {
            IERC20(tokenA).safeTransfer(to, amountA);
        }
        
        if (amountB > 0) {
            IERC20(tokenB).safeTransfer(to, amountB);
        }
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidity);
    }

    /**
     * @dev Calculates the optimal amounts of tokens to add as liquidity
     * @param amountADesired The desired amount of tokenA
     * @param amountBDesired The desired amount of tokenB
     * @param amountAMin The minimum amount of tokenA
     * @param amountBMin The minimum amount of tokenB
     * @return amountA The optimal amount of tokenA
     * @return amountB The optimal amount of tokenB
     */
    function _calculateLiquidityAmounts(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal view returns (uint256 amountA, uint256 amountB) {
        (uint256 reserveA, uint256 reserveB) = getReserves();
        
        if (reserveA == 0 && reserveB == 0) {
            // First liquidity provision
            return (amountADesired, amountBDesired);
        }
        
        // Calculate optimal amounts based on the current ratio
        uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
        
        if (amountBOptimal <= amountBDesired) {
            require(amountBOptimal >= amountBMin, "DEX: INSUFFICIENT_B_AMOUNT");
            return (amountADesired, amountBOptimal);
        } else {
            uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
            require(amountAOptimal <= amountADesired, "DEX: EXCESSIVE_A_AMOUNT");
            require(amountAOptimal >= amountAMin, "DEX: INSUFFICIENT_A_AMOUNT");
            return (amountAOptimal, amountBDesired);
        }
    }

    /**
     * @dev Mints LP tokens based on the current reserves and token amounts
     * @param to The address that will receive the LP tokens
     * @return liquidity The amount of LP tokens minted
     */
    function _mintLiquidity(address to) internal returns (uint256 liquidity) {
        (uint256 reserveA, uint256 reserveB) = getReserves();
        uint256 totalSupply = totalSupply();
        
        if (totalSupply == 0) {
            // First liquidity provision
            liquidity = Math.sqrt(reserveA * reserveB) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY); // Burn address
        } else {
            // For subsequent liquidity provisions, calculate based on the proportion
            // of new tokens to existing reserves
            uint256 liquidityA = (reserveA * totalSupply) / (reserveA + 1);
            uint256 liquidityB = (reserveB * totalSupply) / (reserveB + 1);
            
            // Use the smaller value to ensure fairness
            liquidity = Math.min(liquidityA, liquidityB);
        }
        
        require(liquidity > 0, "DEX: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
    }
}
