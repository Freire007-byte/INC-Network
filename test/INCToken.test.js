const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("INCToken", function () {
  let token, owner, eco, team, liq, trs, ido, user;
  const TOTAL  = ethers.parseUnits("100000000", 18);
  const E40    = ethers.parseUnits("40000000",  18);
  const E20    = ethers.parseUnits("20000000",  18);
  const E10    = ethers.parseUnits("10000000",  18);

  beforeEach(async () => {
    [owner, eco, team, liq, trs, ido, user] = await ethers.getSigners();
    const F = await ethers.getContractFactory("INCToken");
    token = await F.deploy(eco.address, team.address, liq.address, trs.address, ido.address);
    await token.waitForDeployment();
  });

  // ── Supply & Distribution ──────────────────────────────────
  it("total supply = 100,000,000 INC", async () => {
    expect(await token.totalSupply()).to.equal(TOTAL);
  });

  it("nome e símbolo corretos", async () => {
    expect(await token.name()).to.equal("INC Network Token");
    expect(await token.symbol()).to.equal("INC");
  });

  it("ecosystem recebe 40%", async () => {
    expect(await token.balanceOf(eco.address)).to.equal(E40);
  });

  it("team recebe 20%", async () => {
    expect(await token.balanceOf(team.address)).to.equal(E20);
  });

  it("liquidity recebe 20%", async () => {
    expect(await token.balanceOf(liq.address)).to.equal(E20);
  });

  it("treasury recebe 10%", async () => {
    expect(await token.balanceOf(trs.address)).to.equal(E10);
  });

  it("ido recebe 10%", async () => {
    expect(await token.balanceOf(ido.address)).to.equal(E10);
  });

  // ── Transferência ──────────────────────────────────────────
  it("transferência ERC-20 padrão funciona", async () => {
    const amt = ethers.parseUnits("1000", 18);
    await token.connect(eco).transfer(user.address, amt);
    expect(await token.balanceOf(user.address)).to.equal(amt);
  });

  // ── Burn ───────────────────────────────────────────────────
  it("holder pode queimar seus tokens", async () => {
    const amt = ethers.parseUnits("500000", 18);
    await token.connect(eco).burn(amt);
    expect(await token.totalSupply()).to.equal(TOTAL - amt);
  });

  it("emite evento TokensBurned ao queimar", async () => {
    const amt = ethers.parseUnits("1000", 18);
    await expect(token.connect(eco).burn(amt))
      .to.emit(token, "TokensBurned")
      .withArgs(eco.address, amt);
  });

  // ── Pause ──────────────────────────────────────────────────
  it("owner pode pausar e despausa", async () => {
    await token.connect(owner).pause();
    const amt = ethers.parseUnits("100", 18);
    await expect(token.connect(eco).transfer(user.address, amt))
      .to.be.revertedWithCustomError(token, "EnforcedPause");
    await token.connect(owner).unpause();
    await token.connect(eco).transfer(user.address, amt);
    expect(await token.balanceOf(user.address)).to.equal(amt);
  });

  it("não-owner não pode pausar", async () => {
    await expect(token.connect(user).pause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  // ── Ownable2Step ────────────────────────────────────────────
  it("transferência de ownership exige aceitação", async () => {
    await token.connect(owner).transferOwnership(user.address);
    expect(await token.owner()).to.equal(owner.address);
    await token.connect(user).acceptOwnership();
    expect(await token.owner()).to.equal(user.address);
  });

  // ── Deploy guards ───────────────────────────────────────────
  it("rejeita deploy com zero address", async () => {
    const F = await ethers.getContractFactory("INCToken");
    await expect(F.deploy(
      ethers.ZeroAddress, team.address, liq.address, trs.address, ido.address
    )).to.be.revertedWith("ecosystem: zero");
  });

  // ── Supply cap ──────────────────────────────────────────────
  it("não há mint após deploy — supply é fixo", async () => {
    expect(await token.totalSupply()).to.equal(TOTAL);
    // INCToken não expõe mint público
    expect(token.mint).to.equal(undefined);
  });
});
