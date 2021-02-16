const BigNumber = require('bignumber.js');
const Idle = artifacts.require("Idle");
const GovernorAlpha = artifacts.require("GovernorAlpha");
const Vester = artifacts.require("Vester");
const VesterFactory = artifacts.require("VesterFactory");

const {
  creator, rebalancerManager, feeAddress, gstAddress,
  cDAI, iDAI, aDAI, CHAI, DAI, yxDAI, idleDAIV4, idleDAISafeV4,
  cUSDC, iUSDC, aUSDC, USDC, yxUSDC, idleUSDCV4, idleUSDCSafeV4,
  cUSDT, iUSDT, aUSDT, USDT, idleUSDTV4, idleUSDTSafeV4,
  aTUSD, TUSD, idleTUSDV4,
  aSUSD, SUSD, idleSUSDV4,
  cWBTC, iWBTC, aWBTC, WBTC, idleWBTCV4,
  COMP, IDLE,
  timelock, idleMultisig, proxyAdmin, allIdleTokens
} = require('./addresses.js');

const BNify = s => new BigNumber(String(s));

module.exports = async function (deployer, network, accounts) {
  if (network === 'test' || network == 'coverage') {
    return;
  }
  const advanceTime = async (timestamp) => {
    if (network === 'live') {
      return;
    }
    return await new Promise((resolve, reject) => {
      const payload = {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: 12345
      };
      if (timestamp) {
        payload.params = [timestamp];
      }
      web3.currentProvider.send(payload, (err, res) => {
        if (err) {
          console.log('advance time err', err);
          return reject(err);
        }
        // console.log('advance time ok', res);
        return resolve({ok: true, res});
      });
    })
  };
  const advanceBlocks = async n => {
    for (var i = 0; i < n; i++) {
      await advanceTime();
    }
  };

  // ###############
  const idle = await Idle.at('0x875773784Af8135eA0ef43b5a374AaD105c5D39e');
  const gov = await GovernorAlpha.at('0x2256b25CFC8E35c3135664FD03E77595042fe31B');
  const vesterFactory = await VesterFactory.at('0xbF875f2C6e4Cc1688dfe4ECf79583193B6089972');
  const timelockAddress = '0xD6dABBc2b275114a2366555d6C481EF08FDC2556';
  const ecosystemFund = '0xb0aA1f98523Ec15932dd5fAAC5d86e57115571C7';
  const ONE = BNify('1e18');

  console.log('##################################');

  const executeProposal = async ({targets, values, signatures, calldatas, description, from}) => {
    await gov.propose(targets, values, signatures, calldatas, description,
      {from}
    );
    console.log('proposed');
    // need 1 block to pass before being able to vote but less than 10
    await advanceBlocks(2);

    await gov.castVote(BNify('1'), true, {from: founder});
    console.log('voted');

    if (network === 'live') {
      return;
    }

    // Need to advance 3d in blocs + 1
    await advanceBlocks(17281);

    await gov.queue(BNify('1'), {from: creator});
    console.log('queued');

    const currTime2 = BNify((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp);
    // BNify('172800') == timelockDelay
    await advanceTime(currTime2.plus(BNify('172800')).plus(BNify('100')));
    await advanceBlocks(1);

    await gov.execute(BNify('1'), {from: creator});
    console.log('executed');
    await advanceBlocks(2);
  };

  // ########### PARAMS HERE ###########
  const committeeMultisig = '0xFb3bD022D5DAcF95eE28a6B07825D4Ff9C5b3814';
  // WARNING: Use this for all idleTokens except IdleWETH
  const proxyAdmin = '0x7740792812A00510b50022D84e5c4AC390e01417';
  // Use this instead for IdleWETH
  // const proxyAdminEth = '0xc2ff102E62027DE1205a7EDd4C8a8F58C1E5e3e8';

  // for setting new implementation:
  // first deploy the new impl contract
  // then exec proposal which setImpl in all idleTokens needed
  const newIdleContract = '0x375d170B98dA0e5394edF3aB2ba1e9360F9C29C6';
  let proposer = committeeMultisig;
  // Format: #Title \n Description
  const description = '#IIP-4 Treasury committee and aave v2 fix \n Description';
  // ########### PARAMS HERE ###########


  if (network !== 'live') {
    // Simulate proposal in fork
    proposer = '0x3675D2A334f17bCD4689533b7Af263D48D96eC72';
    const founderVesting = await vesterFactory.vestingContracts(founder);
    const vesterFounder = await Vester.at(founderVesting);
    console.log(txt, BNify(await idle.balanceOf(vesterFounder.address)).div(ONE).toString())
    await idle.delegate(founder, {from: founder});
    console.log('delegates founder to founder');
    await vesterFounder.setDelegate(founder, {from: founder});
    console.log('delegates vesterFounder to founder');
  }

  if (!newIdleContract || !proxyAdmin || !proposer || !committeeMultisig || !idle.address) {
    console.log('IDLE: Undefined address');
    return;
  }

  const targets = allIdleTokens.map(a => proxyAdmin); // targets
  const values = allIdleTokens.map(a => BNify('0')); // values
  const signatures = allIdleTokens.map(a => 'upgrade(address,address)'); // signatures
  const calldatas = allIdleTokens.map(
    a => web3.eth.abi.encodeParameters(['address', 'address'], [a, newIdleContract])
  ); // calldatas

  // Add one action to withdraw 5000 Idle from ecosystem fund
  targets.push(timelockAddress);
  values.push(BNify('0'));
  signatures.push('transfer(address,address,uint256)');
  calldatas.push(
    web3.eth.abi.encodeParameters(
      ['address', 'address', 'uint256'],
      [idle.address, committeeMultisig, BNify('5000').mul(ONE)]
    )
  );

  // TODO if idleWETH add proxyAdminEth

  await executeProposal({targets, values, signatures, calldatas, description, from: proposer});
};
