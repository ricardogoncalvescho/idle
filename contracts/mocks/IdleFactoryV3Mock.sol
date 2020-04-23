/**
 * @title: Idle Factory contract
 * @summary: Used for deploying and keeping track of IdleTokens instances
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.16;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./IdleTokenV3Mock.sol";

contract IdleFactoryV3Mock is Ownable {
  // tokenAddr (eg. DAI add) => idleTokenAddr (eg. idleDAI)
  mapping (address => address) public underlyingToIdleTokenMap;
  // array of underlying token addresses (eg. [DAIAddr, USDCAddr])
  address[] public tokensSupported;

  /**
   * Used to deploy new instances of IdleTokens, only callable by owner
   * Ownership of IdleToken is then transferred to msg.sender. Same for Pauser role.
   * NOTE: underlyingToIdleTokenMap[_token] can be overwritten if a new IdleToken instance is deployed
   *       to substitute the previous one for the same underlying token
   *
   * @param _name : IdleToken name
   * @param _symbol : IdleToken symbol
   * @param _decimals : IdleToken decimals
   * @param _token : underlying token address
   * @param _cToken : cToken address
   * @param _iToken : iToken address
   * @param _rebalancer : Idle Rebalancer address
   * @param _idleCompound : Idle Compound address
   * @param _idleFulcrum : Idle Fulcrum address
   *
   * @return : newly deployed IdleToken address
   */
  function newIdleToken(
    string calldata _name, // eg. IdleDAI
    string calldata _symbol, // eg. IDLEDAI
    uint8 _decimals, // eg. 18
    address _token,
    address _cToken,
    address _iToken,
    address _rebalancer,
    address _priceCalculator,
    address _idleCompound,
    address _idleFulcrum
  ) external onlyOwner returns(address) {
    require(
      _token != address(0) && _cToken != address(0) &&
      _iToken != address(0) && _rebalancer != address(0) &&
      _priceCalculator != address(0) && _idleCompound != address(0) &&
      _idleFulcrum != address(0), 'some addr is 0');

    IdleTokenV3Mock idleToken = new IdleTokenV3Mock(
      _name, // eg. IdleDAI
      _symbol, // eg. IDLEDAI
      _decimals, // eg. 18
      _token,
      _cToken,
      _iToken,
      _rebalancer,
      _priceCalculator,
      _idleCompound,
      _idleFulcrum
    );
    if (underlyingToIdleTokenMap[_token] == address(0)) {
      tokensSupported.push(_token);
    }
    underlyingToIdleTokenMap[_token] = address(idleToken);

    return address(idleToken);
  }

  /**
  * Used to transfer ownership and the ability to pause from IdleFactory to owner
  *
  * @param _idleToken : idleToken address who needs to change owner and pauser
  */
  function setTokenOwnershipAndPauser(address _idleToken) external onlyOwner {
    require(_idleToken != address(0), '_idleToken addr is 0');

    IdleTokenV3Mock idleToken = IdleTokenV3Mock(_idleToken);
    idleToken.transferOwnership(msg.sender);
    idleToken.addPauser(msg.sender);
    idleToken.renouncePauser();
  }
}
