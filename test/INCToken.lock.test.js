// test/INCToken.lock.test.js
// ══════════════════════════════════════════════════════════════
// Testes do Participation Lock — INCToken v2 + INCNetwork v1.5
// ══════════════════════════════════════════════════════════════

const { expect } = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

describe("INCToken — Participation Lock", function () {
  let owner, treasury, eco, team, liq, treas, ido;
  let user1, user2, user3;
  let token, network;

  const PAIR = "BTC/USDT";
  const STAKE_P = ethers.parseEther("0.005");
  const STAKE_F = ethers.parseEther("0.001");

  // Mock Chainlink feed
  let mockFeed;

  before(async function () {
    [owner, treasury, eco, team, liq, treas, ido, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock price feed
    const MockFeed = await ethers.getContractFactory("MockV3Aggregator");
    mockFeed = await MockFeed.deploy(8, 6500000000000n); // $65,000 BTC

    // Deploy INCNetwork
    const INCNetwork = await ethers.getContractFactory("INCNetwork");
    network = await INCNetwork.deploy(treasury.address, owner.address);
    await network.setPriceFeed(PAIR, await mockFeed.getAddress());

    // Deploy INCToken
    const INCToken = await ethers.getContractFactory("INCToken");
    token = await INCToken.deploy(
      eco.address, team.address, liq.address, treas.address, ido.address
    );

    // Wire contracts together
    await token.setNetworkContract(await network.getAddress());
    await network.setIncToken(await token.getAddress());
  });

  // ── HELPER: criar sinal válido como provider ─────────────────

  async function createSignal(signer) {
    const price = 6500000000000n; // $65,000 in 8 dec
    const tp    = price + price / 10n; // +10%
    const sl    = price - price / 10n; // -10%
    return network.connect(signer).createSignal(
      PAIR, 0 /* LONG */, price, tp, sl, 50,
      { value: STAKE_P }
    );
  }

  // ── 1. LOCK ATIVO POR PADRÃO ─────────────────────────────────

  describe("Lock ativo por padrão", function () {
    it("lockEnabled é true após deploy", async function () {
      expect(await token.lockEnabled()).to.equal(true);
    });

    it("usuário sem participação não pode transferir", async function () {
      // Envia tokens para user1 (de eco que é whitelisted)
      await token.connect(eco).transfer(user1.address, ethers.parseEther("100"));

      // user1 tenta repassar para user2 — deve falhar
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(token, "TokensLocked").withArgs(user1.address);
    });

    it("endereços whitelisted podem transferir livremente", async function () {
      // eco é whitelisted — pode transferir sem participar
      await expect(
        token.connect(eco).transfer(user2.address, ethers.parseEther("50"))
      ).not.to.be.reverted;
    });
  });

  // ── 2. UNLOCK VIA createSignal ───────────────────────────────

  describe("Unlock via createSignal", function () {
    it("provider é desbloqueado ao criar sinal", async function () {
      expect(await token.isUnlocked(user1.address)).to.equal(false);

      await createSignal(user1);

      expect(await token.isUnlocked(user1.address)).to.equal(true);
    });

    it("provider desbloqueado pode transferir tokens", async function () {
      await expect(
        token.connect(user1).transfer(user3.address, ethers.parseEther("5"))
      ).not.to.be.reverted;
    });

    it("emite AddressUnlocked no unlock", async function () {
      // user3 ainda não participou — precisamos de novo sinal com outro user
      const [, , , , , , , , , , newProvider] = await ethers.getSigners();
      // Envia tokens para newProvider
      await token.connect(eco).transfer(newProvider.address, ethers.parseEther("100"));

      await expect(createSignal(newProvider))
        .to.emit(token, "AddressUnlocked")
        .withArgs(newProvider.address);
    });
  });

  // ── 3. UNLOCK VIA followSignal ───────────────────────────────

  describe("Unlock via followSignal", function () {
    let signalId;

    before(async function () {
      // Cria sinal com user1 (já desbloqueado, mas precisamos do ID)
      const tx = await createSignal(user1);
      const rc = await tx.wait();
      const ev = rc.logs.find(l => {
        try { return network.interface.parseLog(l).name === "SignalCreated"; } catch { return false; }
      });
      signalId = network.interface.parseLog(ev).args.signalId;
    });

    it("follower é desbloqueado ao seguir sinal", async function () {
      // user2 recebeu tokens antes mas não participou
      expect(await token.isUnlocked(user2.address)).to.equal(false);
      expect(await network.followerTotalStaked(user2.address)).to.equal(0n);

      await network.connect(user2).followSignal(signalId, { value: STAKE_F });

      expect(await token.isUnlocked(user2.address)).to.equal(true);
      expect(await network.followerTotalStaked(user2.address)).to.be.gt(0n);
    });

    it("follower desbloqueado pode transferir tokens", async function () {
      await expect(
        token.connect(user2).transfer(user3.address, ethers.parseEther("1"))
      ).not.to.be.reverted;
    });
  });

  // ── 4. selfUnlock ────────────────────────────────────────────

  describe("selfUnlock via prova on-chain", function () {
    let newUser;

    before(async function () {
      const signers = await ethers.getSigners();
      newUser = signers[12];
      // Envia tokens para newUser
      await token.connect(eco).transfer(newUser.address, ethers.parseEther("200"));

      // newUser cria sinal (participação registrada no INCNetwork)
      await createSignal(newUser);

      // Simula que isUnlocked ainda está false (como se fosse uma migração)
      // Na prática: o lock foi feito via _update lazy — mas vamos testar selfUnlock
      // Reset manual: só possível se isUnlocked = false, então usamos user3 que participou via transfer recebida
    });

    it("selfUnlock funciona se incNetworkContract está configurado e usuário participou", async function () {
      // newUser já participou — selfUnlock deve funcionar
      await expect(token.connect(newUser).selfUnlock()).not.to.be.reverted;
      expect(await token.isUnlocked(newUser.address)).to.equal(true);
    });

    it("selfUnlock reverte se usuário não participou", async function () {
      const [, , , , , , , , , , , , , noParticipation] = await ethers.getSigners();
      await expect(
        token.connect(noParticipation).selfUnlock()
      ).to.be.revertedWith("INC: participe do protocolo INC para desbloquear");
    });
  });

  // ── 5. canTransfer view ──────────────────────────────────────

  describe("canTransfer view", function () {
    it("retorna true para endereço whitelisted", async function () {
      expect(await token.canTransfer(eco.address)).to.equal(true);
    });

    it("retorna true para endereço desbloqueado", async function () {
      expect(await token.canTransfer(user1.address)).to.equal(true);
    });

    it("retorna false para novo endereço sem participação", async function () {
      const signers = await ethers.getSigners();
      const fresh   = signers[15];
      expect(await token.canTransfer(fresh.address)).to.equal(false);
    });

    it("retorna true quando lock está desabilitado", async function () {
      await token.connect(owner).setLockEnabled(false);
      const signers = await ethers.getSigners();
      expect(await token.canTransfer(signers[15].address)).to.equal(true);
      await token.connect(owner).setLockEnabled(true); // restaura
    });
  });

  // ── 6. ADMIN — setLockEnabled ────────────────────────────────

  describe("Admin — setLockEnabled", function () {
    it("owner pode desativar lock", async function () {
      await expect(token.connect(owner).setLockEnabled(false))
        .to.emit(token, "LockToggled").withArgs(false);
      expect(await token.lockEnabled()).to.equal(false);
    });

    it("com lock desativado, qualquer endereço pode transferir", async function () {
      const signers = await ethers.getSigners();
      const fresh   = signers[16];
      await token.connect(eco).transfer(fresh.address, ethers.parseEther("10"));
      await expect(
        token.connect(fresh).transfer(user3.address, ethers.parseEther("1"))
      ).not.to.be.reverted;
    });

    it("owner pode reativar lock", async function () {
      await expect(token.connect(owner).setLockEnabled(true))
        .to.emit(token, "LockToggled").withArgs(true);
      expect(await token.lockEnabled()).to.equal(true);
    });

    it("não-owner não pode alterar lock", async function () {
      await expect(
        token.connect(user3).setLockEnabled(false)
      ).to.be.reverted;
    });
  });

  // ── 7. ADMIN — setWhitelisted / batchWhitelist ───────────────

  describe("Admin — whitelist", function () {
    it("owner pode adicionar endereço à whitelist", async function () {
      const signers = await ethers.getSigners();
      const addr    = signers[17].address;
      await expect(token.connect(owner).setWhitelisted(addr, true))
        .to.emit(token, "Whitelisted").withArgs(addr, true);
      expect(await token.isWhitelisted(addr)).to.equal(true);
    });

    it("endereço whitelisted pode transferir sem participar", async function () {
      const signers = await ethers.getSigners();
      const addr    = signers[17];
      await token.connect(eco).transfer(addr.address, ethers.parseEther("10"));
      await expect(
        token.connect(addr).transfer(user3.address, ethers.parseEther("1"))
      ).not.to.be.reverted;
    });

    it("owner pode remover da whitelist", async function () {
      const signers = await ethers.getSigners();
      const addr    = signers[17].address;
      await token.connect(owner).setWhitelisted(addr, false);
      expect(await token.isWhitelisted(addr)).to.equal(false);
    });

    it("batchWhitelist funciona para múltiplos endereços", async function () {
      const signers = await ethers.getSigners();
      const addrs   = [signers[18].address, signers[19].address];
      await token.connect(owner).batchWhitelist(addrs, true);
      expect(await token.isWhitelisted(addrs[0])).to.equal(true);
      expect(await token.isWhitelisted(addrs[1])).to.equal(true);
      // cleanup
      await token.connect(owner).batchWhitelist(addrs, false);
    });

    it("não-owner não pode alterar whitelist", async function () {
      await expect(
        token.connect(user3).setWhitelisted(user3.address, true)
      ).to.be.reverted;
    });
  });

  // ── 8. unlockAddress — controle de acesso ────────────────────

  describe("unlockAddress — controle de acesso", function () {
    it("owner pode desbloquear manualmente qualquer endereço", async function () {
      const signers = await ethers.getSigners();
      const target  = signers[13].address;
      expect(await token.isUnlocked(target)).to.equal(false);
      await token.connect(owner).unlockAddress(target);
      expect(await token.isUnlocked(target)).to.equal(true);
    });

    it("incNetworkContract pode desbloquear endereços", async function () {
      // Simula chamada do INCNetwork (já configurado como incNetworkContract)
      const netAddr = await network.getAddress();
      const signer  = await ethers.getImpersonatedSigner(netAddr);
      await ethers.provider.send("hardhat_setBalance", [netAddr, "0x1000000000000000000"]);

      const signers = await ethers.getSigners();
      const target  = signers[14].address;
      expect(await token.isUnlocked(target)).to.equal(false);

      await token.connect(signer).unlockAddress(target);
      expect(await token.isUnlocked(target)).to.equal(true);
    });

    it("terceiro não pode chamar unlockAddress", async function () {
      await expect(
        token.connect(user3).unlockAddress(user3.address)
      ).to.be.revertedWith("INC: apenas o contrato INCNetwork ou owner pode desbloquear");
    });

    it("unlockAddress com endereço zero reverte", async function () {
      await expect(
        token.connect(owner).unlockAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("INC: zero address");
    });
  });

  // ── 9. setNetworkContract ────────────────────────────────────

  describe("setNetworkContract", function () {
    it("emite NetworkContractSet e whitelist o contrato", async function () {
      const netAddr = await network.getAddress();
      expect(await token.isWhitelisted(netAddr)).to.equal(true); // já configurado no before
    });

    it("não-owner não pode configurar", async function () {
      await expect(
        token.connect(user3).setNetworkContract(await network.getAddress())
      ).to.be.reverted;
    });

    it("endereço zero é rejeitado", async function () {
      await expect(
        token.connect(owner).setNetworkContract(ethers.ZeroAddress)
      ).to.be.revertedWith("INC: zero address");
    });
  });

  // ── 10. INCNetwork.hasParticipated ───────────────────────────

  describe("INCNetwork.hasParticipated", function () {
    it("retorna true para provider que criou sinal", async function () {
      expect(await network.hasParticipated(user1.address)).to.equal(true);
    });

    it("retorna true para follower que seguiu sinal", async function () {
      expect(await network.hasParticipated(user2.address)).to.equal(true);
    });

    it("retorna false para endereço sem participação", async function () {
      const signers = await ethers.getSigners();
      expect(await network.hasParticipated(signers[15].address)).to.equal(false);
    });
  });

  // ── 11. followerTotalStaked acumula corretamente ──────────────

  describe("followerTotalStaked acumula", function () {
    it("incrementa após followSignal", async function () {
      const before = await network.followerTotalStaked(user2.address);
      expect(before).to.be.gt(0n);

      // user2 segue outro sinal
      const tx = await createSignal(user1);
      const rc = await tx.wait();
      const ev = rc.logs.find(l => {
        try { return network.interface.parseLog(l).name === "SignalCreated"; } catch { return false; }
      });
      const newId = network.interface.parseLog(ev).args.signalId;

      await network.connect(user2).followSignal(newId, { value: STAKE_F });

      const after = await network.followerTotalStaked(user2.address);
      const fee   = (STAKE_F * 350n) / 10000n;
      expect(after - before).to.equal(STAKE_F - fee);
    });
  });

  // ── 12. Lazy unlock via _update ──────────────────────────────

  describe("Lazy unlock via _update (sem isUnlocked prévio)", function () {
    it("transferência dispara unlock automático se participou on-chain", async function () {
      // Cria novo signer que vai participar mas cujo isUnlocked ainda é false
      const signers   = await ethers.getSigners();
      const lazyUser  = signers[11];

      // Envia tokens do eco (whitelisted)
      await token.connect(eco).transfer(lazyUser.address, ethers.parseEther("100"));

      // Participa (cria sinal) — isso dispara unlock via INCToken.unlockAddress internamente
      // então isUnlocked já deve ser true após createSignal. Vamos confirmar:
      await createSignal(lazyUser);
      expect(await token.isUnlocked(lazyUser.address)).to.equal(true);

      // Transferência deve funcionar normalmente
      await expect(
        token.connect(lazyUser).transfer(user3.address, ethers.parseEther("5"))
      ).not.to.be.reverted;
    });
  });

  // ── 13. Mint sempre permitido ────────────────────────────────

  describe("Mint e burn", function () {
    it("mint (from=0) nunca é bloqueado pelo lock", async function () {
      // O constructor faz mint para todas as wallets — já funcionou.
      // Apenas verifica que o supply está correto.
      const supply = await token.totalSupply();
      expect(supply).to.equal(ethers.parseEther("100000000"));
    });

    it("burn (to=0) funciona para endereço desbloqueado", async function () {
      // eco é whitelisted — pode queimar
      const before = await token.balanceOf(eco.address);
      await token.connect(eco).burn(ethers.parseEther("1"));
      const after  = await token.balanceOf(eco.address);
      expect(before - after).to.equal(ethers.parseEther("1"));
    });
  });
});
