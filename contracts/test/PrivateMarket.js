const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PrivateMarket", function () {
  async function deployFixture() {
    const [creator, alice, bob, carol] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PrivateMarket");
    const market = await factory.deploy();
    await market.waitForDeployment();
    return { market, creator, alice, bob, carol };
  }

  async function createMarket(market, signer, offsetSeconds = 3600) {
    const resolutionTime = (await time.latest()) + offsetSeconds;
    await market.connect(signer).createMarket(resolutionTime);
    return { marketId: 0n, resolutionTime };
  }

  it("creates a market with expected metadata", async function () {
    const { market, creator } = await deployFixture();
    const { marketId, resolutionTime } = await createMarket(market, creator);

    const onChain = await market.getMarket(marketId);
    expect(onChain.creator).to.equal(creator.address);
    expect(onChain.marketId).to.equal(marketId);
    expect(onChain.resolutionTime).to.equal(resolutionTime);
    expect(onChain.resolved).to.equal(false);
  });

  it("allows adding to same side bet and updates pool correctly", async function () {
    const { market, creator, alice } = await deployFixture();
    const { marketId } = await createMarket(market, creator);

    await market.connect(alice).placeBet(marketId, true, {
      value: ethers.parseEther("1.0"),
    });
    await market.connect(alice).placeBet(marketId, true, {
      value: ethers.parseEther("0.5"),
    });

    const userBet = await market.getUserBet(marketId, alice.address);
    const onChain = await market.getMarket(marketId);

    expect(userBet.amount).to.equal(ethers.parseEther("1.5"));
    expect(userBet.isYes).to.equal(true);
    expect(onChain.totalYesBets).to.equal(ethers.parseEther("1.5"));
    expect(onChain.totalNoBets).to.equal(0n);
  });

  it("rejects side switching after first bet (regression test)", async function () {
    const { market, creator, alice } = await deployFixture();
    const { marketId } = await createMarket(market, creator);

    await market.connect(alice).placeBet(marketId, true, {
      value: ethers.parseEther("1.0"),
    });

    await expect(
      market.connect(alice).placeBet(marketId, false, {
        value: ethers.parseEther("1.0"),
      })
    ).to.be.revertedWithCustomError(market, "CannotSwitchBetSide");
  });

  it("only creator can resolve, and only after resolution time", async function () {
    const { market, creator, alice } = await deployFixture();
    const { marketId, resolutionTime } = await createMarket(market, creator, 300);

    await expect(
      market.connect(alice).resolveMarket(marketId, true)
    ).to.be.revertedWithCustomError(market, "NotMarketCreator");

    await expect(
      market.connect(creator).resolveMarket(marketId, true)
    ).to.be.revertedWithCustomError(market, "BettingClosed");

    await time.increaseTo(resolutionTime);
    await market.connect(creator).resolveMarket(marketId, true);

    const onChain = await market.getMarket(marketId);
    expect(onChain.resolved).to.equal(true);
    expect(onChain.outcome).to.equal(true);
  });

  it("splits losing pool proportionally for winners", async function () {
    const { market, creator, alice, bob, carol } = await deployFixture();
    const { marketId, resolutionTime } = await createMarket(market, creator, 300);

    await market.connect(alice).placeBet(marketId, true, {
      value: ethers.parseEther("1.0"),
    });
    await market.connect(bob).placeBet(marketId, true, {
      value: ethers.parseEther("1.0"),
    });
    await market.connect(carol).placeBet(marketId, false, {
      value: ethers.parseEther("2.0"),
    });

    await time.increaseTo(resolutionTime);
    await market.connect(creator).resolveMarket(marketId, true);

    expect(await market.calculatePayout(marketId, alice.address)).to.equal(
      ethers.parseEther("2.0")
    );
    expect(await market.calculatePayout(marketId, bob.address)).to.equal(
      ethers.parseEther("2.0")
    );
    expect(await market.calculatePayout(marketId, carol.address)).to.equal(0n);

    expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(
      ethers.parseEther("4.0")
    );

    await market.connect(alice).claimWinnings(marketId);
    expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(
      ethers.parseEther("2.0")
    );
    await market.connect(bob).claimWinnings(marketId);
    expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(
      0n
    );
  });

  it("refunds winners when losing pool is zero", async function () {
    const { market, creator, alice } = await deployFixture();
    const { marketId, resolutionTime } = await createMarket(market, creator, 300);

    await market.connect(alice).placeBet(marketId, true, {
      value: ethers.parseEther("3.0"),
    });

    await time.increaseTo(resolutionTime);
    await market.connect(creator).resolveMarket(marketId, true);

    expect(await market.calculatePayout(marketId, alice.address)).to.equal(
      ethers.parseEther("3.0")
    );

    await market.connect(alice).claimWinnings(marketId);
    expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(
      0n
    );
  });

  it("prevents losing side from claiming", async function () {
    const { market, creator, alice, bob } = await deployFixture();
    const { marketId, resolutionTime } = await createMarket(market, creator, 300);

    await market.connect(alice).placeBet(marketId, true, {
      value: ethers.parseEther("1.0"),
    });
    await market.connect(bob).placeBet(marketId, false, {
      value: ethers.parseEther("1.0"),
    });

    await time.increaseTo(resolutionTime);
    await market.connect(creator).resolveMarket(marketId, true);

    await expect(
      market.connect(bob).claimWinnings(marketId)
    ).to.be.revertedWithCustomError(market, "LoserCannotClaim");
  });
});
