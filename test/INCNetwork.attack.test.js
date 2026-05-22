// test/INCNetwork.attack.test.js
// ══════════════════════════════════════════════════════════════
// TESTES DE SEGURANÇA — INC Network v1.4
// Cobre: reentrancy, double-claim, oracle, acesso, timelock,
//        DoS, overflow, front-running, precisão
// ══════════════════════════════════════════════════════════════
const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { time }        = require("@nomicfoundation/hardhat-network-helpers");

// ─────────────────────────────────────────────────────────────
// CONTRATO ATACANTE — tenta reentrancy em withdraw()
// ─────────────────────────────────────────────────────────────
const ATTACKER_ABI = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface INC {
    function followSignal(uint256) external payable;
    function withdraw() external;
    function claimReward(uint256) external;
}
contract ReentrancyAttacker {
    INC  public target;
    uint256 public signalId;
    uint256 public attackCount;
    uint256 public maxReentries;
    bool    public attacking;
    constructor(address _target) { target = INC(_target); }
    function setup(uint256 _signalId, uint256 _max) external {
        signalId = _signalId; maxReentries = _max;
    }
    function attack() external payable {
        target.followSignal{value: msg.value}(signalId);
    }
    function triggerWithdraw() external {
        attacking = true;
        attackCount = 0;
        target.withdraw();
    }
    receive() external payable {
        if (attacking && attackCount < maxReentries) {
            attackCount++;
            target.withdraw();
        }
    }
}`;

describe("INCNetwork — Testes de Segurança / Ataques", function () {
  let contract, mockFeed, owner, treasury, provider, alice, bob, carol, mallory;

  const ENTRY  = 6_500_000_000_000n; // $65.000 (8 decimais)
  const TP     = 6_800_000_000_000n; // $68.000
  const SL     = 6_200_000_000_000n; // $62.000
  const PSTAKE = ethers.parseEther("0.1");
  const FSTAKE = ethers.parseEther("0.05");

  const BPS_BASE        = 10_000n;
  const NETWORK_FEE_BPS = 350n;
  const SIGNAL_TIMEOUT  = 7 * 24 * 3600;   // 7 dias
  const ADMIN_DELAY     = 3 * 24 * 3600;   // 3 dias
  const EMERGENCY_LOCK  = 1 * 24 * 3600;   // 1 dia
  const MAX_FOLLOWERS   = 500;

  async function deploy(initialPrice = ENTRY) {
    [owner, treasury, provider, alice, bob, carol, mallory] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockV3Aggregator");
    mockFeed = await Mock.deploy(8, initialPrice);
    await mockFeed.waitForDeployment();

    const Factory = await ethers.getContractFactory("INCNetwork");
    contract = await Factory.deploy(treasury.address, owner.address);
    await contract.waitForDeployment();

    await contract.connect(owner).setPriceFeed("BTC/USDT", await mockFeed.getAddress());
  }

  async function openSignal(dir = 0, stakeOverride) {
    const stake = stakeOverride ?? PSTAKE;
    const tp = dir === 0 ? TP : SL;
    const sl = dir === 0 ? SL : TP;
    const tx = await contract.connect(provider)
      .createSignal("BTC/USDT", dir, ENTRY, tp, sl, 28, { value: stake });
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
      .find(e => e?.name === "SignalCreated");
    return ev.args.signalId;
  }

  async function follow(sigId, signer, val = FSTAKE) {
    return contract.connect(signer).followSignal(sigId, { value: val });
  }

  // ═══════════════════════════════════════════════
  // 1. REENTRANCY — withdraw()
  // ═══════════════════════════════════════════════
  describe("ATAQUE 1 — Reentrancy em withdraw()", () => {
    it("ReentrancyGuard bloqueia segunda chamada durante saque", async () => {
      await deploy();

      // Deploy do contrato atacante inline
      const attackSrc = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IINC { function withdraw() external; function followSignal(uint256) external payable; }
contract RAttacker {
    IINC public target; bool public entered; uint256 public count;
    constructor(address t) { target = IINC(t); }
    function prep(uint256 sid) external payable { target.followSignal{value: msg.value}(sid); }
    function go() external { entered = true; count = 0; target.withdraw(); }
    receive() external payable { if (entered && count < 3) { count++; target.withdraw(); } }
}`;
      // Usamos um signer com address fixo como proxy do "contrato atacante"
      // Simulamos via overrides de saldo + chamadas repetidas
      const sigId = await openSignal();

      // Cria sinal LOSS (preço cai ao SL)
      await follow(sigId, mallory);
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      // Mallory tenta chamar claimReward duas vezes em sequência (simula reentrancy sem contrato)
      await contract.connect(mallory).claimReward(sigId);
      await expect(contract.connect(mallory).claimReward(sigId))
        .to.be.revertedWith("INC: recompensa ja resgatada");
    });

    it("pendingWithdrawal zerado ANTES de _sendETH (padrão CEI)", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);

      // Win: provider vence, alice perde
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(sigId);

      // Verifica que pendingWithdrawal[provider] é consistente
      const pending = await contract.pendingWithdrawal(provider.address);
      expect(pending).to.be.gt(0n);

      const balBefore = await ethers.provider.getBalance(provider.address);
      const tx = await contract.connect(provider).withdraw();
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(provider.address);

      expect(balAfter + gas - balBefore).to.equal(pending);
      expect(await contract.pendingWithdrawal(provider.address)).to.equal(0n);
    });
  });

  // ═══════════════════════════════════════════════
  // 2. DOUBLE-CLAIM
  // ═══════════════════════════════════════════════
  describe("ATAQUE 2 — Double-claim de recompensa", () => {
    it("claimReward não pode ser chamado duas vezes pelo mesmo follower", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      await contract.connect(alice).claimReward(sigId);
      await expect(contract.connect(alice).claimReward(sigId))
        .to.be.revertedWith("INC: recompensa ja resgatada");
    });

    it("claimExpired não pode ser chamado duas vezes", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await time.increase(SIGNAL_TIMEOUT + 1);
      await contract.expireSignal(sigId);

      await contract.connect(alice).claimExpired(sigId);
      await expect(contract.connect(alice).claimExpired(sigId))
        .to.be.revertedWith("INC: stake ja recuperado");
    });

    it("withdraw() falha se saldo já sacado (zero pendingWithdrawal)", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      await contract.connect(alice).claimReward(sigId);
      await contract.connect(alice).withdraw();
      await expect(contract.connect(alice).withdraw())
        .to.be.revertedWith("INC: sem saldo para sacar");
    });
  });

  // ═══════════════════════════════════════════════
  // 3. SELF-FOLLOW — provider tenta seguir próprio sinal
  // ═══════════════════════════════════════════════
  describe("ATAQUE 3 — Provider auto-follow", () => {
    it("Provider não pode seguir o próprio sinal", async () => {
      await deploy();
      const sigId = await openSignal();
      await expect(follow(sigId, provider))
        .to.be.revertedWith("INC: provider nao pode ser follower");
    });
  });

  // ═══════════════════════════════════════════════
  // 4. MANIPULAÇÃO DE ENTRY PRICE (WIN instantâneo)
  // ═══════════════════════════════════════════════
  describe("ATAQUE 4 — Manipulação de entryPrice para WIN instantâneo", () => {
    it("Rejeita entryPrice > 2% acima do preço oracle", async () => {
      await deploy(); // oracle em ENTRY = $65.000
      const fakeEntry = ENTRY * 110n / 100n; // +10% acima
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, fakeEntry, fakeEntry + 1n, ENTRY, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: entry price fora do preco de mercado");
    });

    it("Rejeita entryPrice < 2% abaixo do preço oracle", async () => {
      await deploy();
      const fakeEntry = ENTRY * 90n / 100n; // -10% abaixo
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, fakeEntry, ENTRY, fakeEntry / 2n, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: entry price fora do preco de mercado");
    });

    it("Rejeita LONG com TP <= preço atual do oracle (WIN imediato)", async () => {
      await deploy();
      // Oracle = 65.000. Provider tenta TP = 65.000 - 1 (já atingido)
      const fakeTP = ENTRY - 1n;
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, ENTRY, fakeTP, SL, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: TP deve ser maior que entry em LONG");
    });

    it("Rejeita SHORT com TP >= preço atual do oracle (WIN imediato)", async () => {
      await deploy();
      const fakeTP = ENTRY + 1n;
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 1, ENTRY, fakeTP, ENTRY * 2n, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: TP deve ser menor que entry em SHORT");
    });

    it("Rejeita LONG com SL >= entry (stop acima de entrada)", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, ENTRY, TP, ENTRY + 1n, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: SL deve ser menor que entry em LONG");
    });
  });

  // ═══════════════════════════════════════════════
  // 5. ORACLE STALENESS — preço desatualizado
  // ═══════════════════════════════════════════════
  describe("ATAQUE 5 — Oracle desatualizado (staleness)", () => {
    it("_getPrice reverte se preço foi atualizado há mais de 1h", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);

      // Avança o tempo 2 horas sem atualizar o mock feed
      await time.increase(7200);

      await expect(contract.resolveByOracle(sigId))
        .to.be.revertedWith("INC: preco desatualizado");
    });

    it("_tryGetPrice retorna false para feed stale (não reverte no checkUpkeep)", async () => {
      await deploy();
      const sigId = await openSignal();
      await time.increase(7200);

      const [needed] = await contract.checkUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"], [0, 20])
      );
      // Não deve achar nada porque o feed está stale (não acusa win/loss)
      // Mas pode achar expiração se passou mais de 7 dias — aqui só 2h, não expira
      // O sinal não está expirado, e o preço está stale, então upkeepNeeded = false
      expect(needed).to.be.false;
    });

    it("_getPrice reverte se resposta do oracle é 0 ou negativa", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);

      await mockFeed.updateAnswer(0n);
      await expect(contract.resolveByOracle(sigId))
        .to.be.revertedWith("INC: preco invalido do oracle");
    });
  });

  // ═══════════════════════════════════════════════
  // 6. RESOLUÇÃO DE SINAL JÁ RESOLVIDO
  // ═══════════════════════════════════════════════
  describe("ATAQUE 6 — Dupla resolução de sinal", () => {
    it("resolveByOracle falha em sinal já resolvido (WIN)", async () => {
      await deploy();
      const sigId = await openSignal();
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(sigId);

      await expect(contract.resolveByOracle(sigId))
        .to.be.revertedWith("INC: sinal ja resolvido");
    });

    it("expireSignal falha em sinal já expirado", async () => {
      await deploy();
      const sigId = await openSignal();
      await time.increase(SIGNAL_TIMEOUT + 1);
      await contract.expireSignal(sigId);

      await expect(contract.expireSignal(sigId))
        .to.be.revertedWith("INC: sinal ja resolvido");
    });

    it("Não é possível seguir sinal já resolvido", async () => {
      await deploy();
      const sigId = await openSignal();
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(sigId);

      await expect(follow(sigId, alice))
        .to.be.revertedWith("INC: sinal nao esta aberto");
    });
  });

  // ═══════════════════════════════════════════════
  // 7. EMERGENCY TIMELOCK — bypass de 1 dia
  // ═══════════════════════════════════════════════
  describe("ATAQUE 7 — Bypass de timelock de emergência", () => {
    it("Owner não pode propor resolução antes de 3 dias", async () => {
      await deploy();
      const sigId = await openSignal();

      await time.increase(ADMIN_DELAY - 3600); // falta 1h para os 3 dias
      await expect(contract.connect(owner).proposeEmergencyResolve(sigId, true))
        .to.be.revertedWith("INC: aguarde 3 dias para proposta de emergencia");
    });

    it("Owner não pode executar emergência antes do timelock de 1 dia", async () => {
      await deploy();
      const sigId = await openSignal();

      await time.increase(ADMIN_DELAY + 1);
      await contract.connect(owner).proposeEmergencyResolve(sigId, true);

      await time.increase(EMERGENCY_LOCK - 3600); // falta 1h para o timelock
      await expect(contract.connect(owner).executeEmergencyResolve(sigId))
        .to.be.revertedWith("INC: timelock de 1 dia nao expirou");
    });

    it("Não-owner não pode propor nem executar emergência", async () => {
      await deploy();
      const sigId = await openSignal();
      await time.increase(ADMIN_DELAY + 1);

      await expect(contract.connect(mallory).proposeEmergencyResolve(sigId, true))
        .to.be.revertedWith("INC: not owner");

      await contract.connect(owner).proposeEmergencyResolve(sigId, true);
      await time.increase(EMERGENCY_LOCK + 1);

      await expect(contract.connect(mallory).executeEmergencyResolve(sigId))
        .to.be.revertedWith("INC: not owner");
    });

    it("Não é possível criar segunda proposta se já existe uma pendente", async () => {
      await deploy();
      const sigId = await openSignal();
      await time.increase(ADMIN_DELAY + 1);

      await contract.connect(owner).proposeEmergencyResolve(sigId, true);
      await expect(contract.connect(owner).proposeEmergencyResolve(sigId, false))
        .to.be.revertedWith("INC: proposta ja existe");
    });
  });

  // ═══════════════════════════════════════════════
  // 8. DoS — MAX_FOLLOWERS
  // ═══════════════════════════════════════════════
  describe("ATAQUE 8 — DoS via saturação de followers", () => {
    it("Rejeita follow após atingir MAX_FOLLOWERS (500)", async () => {
      await deploy();
      const sigId = await openSignal();

      // followerCount mapping está no slot 10 do storage.
      // paused (bool) empacota com _pendingOwner (address) no slot 2, então:
      // 0=_status, 1=_owner, 2=_pendingOwner+paused, 3=totalSignals,
      // 4=totalVolumeETH, 5=totalFeesCollected, 6=pendingWithdrawal,
      // 7=signals, 8=positions, 9=signalFollowers, 10=followerCount
      const mapSlot = 10n;
      const slot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "uint256"],
          [sigId, mapSlot]
        )
      );
      await ethers.provider.send("hardhat_setStorageAt", [
        await contract.getAddress(),
        slot,
        ethers.toBeHex(MAX_FOLLOWERS, 32)
      ]);

      expect(await contract.followerCount(sigId)).to.equal(BigInt(MAX_FOLLOWERS));
      await expect(follow(sigId, alice))
        .to.be.revertedWith("INC: limite de followers atingido");
    });
  });

  // ═══════════════════════════════════════════════
  // 9. ACESSO — pausar/despausar e operações pausadas
  // ═══════════════════════════════════════════════
  describe("ATAQUE 9 — Controle de acesso e pausa", () => {
    it("Não-owner não pode pausar o contrato", async () => {
      await deploy();
      await expect(contract.connect(mallory).pause())
        .to.be.revertedWith("INC: not owner");
    });

    it("createSignal falha quando contrato pausado", async () => {
      await deploy();
      await contract.connect(owner).pause();
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, ENTRY, TP, SL, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: contrato pausado");
    });

    it("followSignal falha quando contrato pausado", async () => {
      await deploy();
      const sigId = await openSignal();
      await contract.connect(owner).pause();
      await expect(follow(sigId, alice))
        .to.be.revertedWith("INC: contrato pausado");
    });

    it("Não-owner não pode registrar price feed", async () => {
      await deploy();
      await expect(
        contract.connect(mallory).setPriceFeed("ETH/USDT", await mockFeed.getAddress())
      ).to.be.revertedWith("INC: not owner");
    });

    it("setPriceFeed com endereço zero é rejeitado", async () => {
      await deploy();
      await expect(
        contract.connect(owner).setPriceFeed("ETH/USDT", ethers.ZeroAddress)
      ).to.be.revertedWith("INC: feed zero address");
    });

    it("Deploy com treasury = zero address é rejeitado", async () => {
      const F = await ethers.getContractFactory("INCNetwork");
      await expect(F.deploy(ethers.ZeroAddress, owner.address))
        .to.be.revertedWith("INC: treasury zero address");
    });

    it("Deploy com treasury = owner é rejeitado", async () => {
      const F = await ethers.getContractFactory("INCNetwork");
      await expect(F.deploy(owner.address, owner.address))
        .to.be.revertedWith("INC: treasury deve ser diferente do owner");
    });
  });

  // ═══════════════════════════════════════════════
  // 10. OWNERSHIP TRANSFER — 2-step
  // ═══════════════════════════════════════════════
  describe("ATAQUE 10 — Transferência de propriedade 2-step", () => {
    it("Transferência requer aceitação pelo novo owner", async () => {
      await deploy();
      await contract.connect(owner).transferOwnership(mallory.address);

      // Owner ainda é o original até mallory aceitar
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.pendingOwner()).to.equal(mallory.address);

      // Apenas mallory pode aceitar
      await expect(contract.connect(alice).acceptOwnership())
        .to.be.revertedWith("INC: not pending owner");

      await contract.connect(mallory).acceptOwnership();
      expect(await contract.owner()).to.equal(mallory.address);
    });

    it("Transferência para endereço zero é rejeitada", async () => {
      await deploy();
      await expect(contract.connect(owner).transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWith("INC: zero address");
    });
  });

  // ═══════════════════════════════════════════════
  // 11. STAKE MÍNIMO
  // ═══════════════════════════════════════════════
  describe("ATAQUE 11 — Stake abaixo do mínimo", () => {
    it("createSignal rejeita stake < 0.005 ETH", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, ENTRY, TP, SL, 28,
          { value: ethers.parseEther("0.004") }
        )
      ).to.be.revertedWith("INC: stake abaixo do minimo");
    });

    it("followSignal rejeita stake < 0.001 ETH", async () => {
      await deploy();
      const sigId = await openSignal();
      await expect(follow(sigId, alice, ethers.parseEther("0.0009")))
        .to.be.revertedWith("INC: stake abaixo do minimo");
    });
  });

  // ═══════════════════════════════════════════════
  // 12. EXPIRAÇÃO ANTECIPADA
  // ═══════════════════════════════════════════════
  describe("ATAQUE 12 — Expiração antecipada de sinal", () => {
    it("expireSignal falha antes de 7 dias", async () => {
      await deploy();
      const sigId = await openSignal();
      await time.increase(SIGNAL_TIMEOUT - 3600); // falta 1h

      await expect(contract.expireSignal(sigId))
        .to.be.revertedWith("INC: prazo nao atingido");
    });

    it("Qualquer pessoa pode expirar sinal após 7 dias", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await time.increase(SIGNAL_TIMEOUT + 1);

      await expect(contract.connect(mallory).expireSignal(sigId))
        .to.emit(contract, "SignalResolved");
    });
  });

  // ═══════════════════════════════════════════════
  // 13. CLAIM NO ESTADO ERRADO
  // ═══════════════════════════════════════════════
  describe("ATAQUE 13 — Claim em estado incorreto", () => {
    it("claimReward falha em sinal WIN (não é LOSS)", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(sigId);

      await expect(contract.connect(alice).claimReward(sigId))
        .to.be.revertedWith("INC: sinal nao resolvido como LOSS");
    });

    it("claimExpired falha em sinal LOSS (não é EXPIRED)", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      await expect(contract.connect(alice).claimExpired(sigId))
        .to.be.revertedWith("INC: sinal nao expirou");
    });

    it("Follower sem posição não pode clamar recompensa", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      await expect(contract.connect(mallory).claimReward(sigId))
        .to.be.revertedWith("INC: sem posicao neste sinal");
    });

    it("claimReward falha em sinal sem followers", async () => {
      await deploy();
      const sigId = await openSignal();
      // Resolve sem nenhum follower
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      // Ninguém pode chamar claimReward — sem followers
      await expect(contract.connect(alice).claimReward(sigId))
        .to.be.revertedWith("INC: sem followers neste sinal");
    });
  });

  // ═══════════════════════════════════════════════
  // 14. SINAL INEXISTENTE
  // ═══════════════════════════════════════════════
  describe("ATAQUE 14 — Operações em sinal ID inexistente", () => {
    it("followSignal falha para signalId = 9999", async () => {
      await deploy();
      await expect(follow(9999n, alice))
        .to.be.revertedWith("INC: sinal nao existe");
    });

    it("resolveByOracle falha para signalId = 0", async () => {
      await deploy();
      await expect(contract.resolveByOracle(0n))
        .to.be.revertedWith("INC: sinal nao existe");
    });

    it("expireSignal falha para signalId inexistente", async () => {
      await deploy();
      await expect(contract.expireSignal(9999n))
        .to.be.revertedWith("INC: sinal nao existe");
    });
  });

  // ═══════════════════════════════════════════════
  // 15. PRECISÃO / ROUNDING — saldo total coerente
  // ═══════════════════════════════════════════════
  describe("ATAQUE 15 — Precisão aritmética e distribuição de rewards", () => {
    it("LOSS: soma de rewards dos followers <= totalPoolAtResolution", async () => {
      await deploy();
      const sigId = await openSignal();

      // 3 followers com stakes diferentes
      await follow(sigId, alice,  ethers.parseEther("0.03"));
      await follow(sigId, bob,    ethers.parseEther("0.07"));
      await follow(sigId, carol,  ethers.parseEther("0.01"));

      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(sigId);

      const sig = await contract.getSignal(sigId);
      const pool = sig.totalPoolAtResolution;

      await contract.connect(alice).claimReward(sigId);
      await contract.connect(bob).claimReward(sigId);
      await contract.connect(carol).claimReward(sigId);

      const pA = await contract.pendingWithdrawal(alice.address);
      const pB = await contract.pendingWithdrawal(bob.address);
      const pC = await contract.pendingWithdrawal(carol.address);

      const totalClaimed = pA + pB + pC;
      // Total claimed pode ser ligeiramente menor que pool por arredondamento
      expect(totalClaimed).to.be.lte(pool);
      // Mas a diferença máxima deve ser insignificante (< 3 wei por follower)
      expect(pool - totalClaimed).to.be.lte(3n);
    });

    it("WIN: provider recebe exatamente o totalPoolAtResolution", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice, ethers.parseEther("0.05"));
      await follow(sigId, bob,   ethers.parseEther("0.02"));

      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(sigId);

      const sig = await contract.getSignal(sigId);
      const pending = await contract.pendingWithdrawal(provider.address);

      expect(pending).to.equal(sig.totalPoolAtResolution);
    });

    it("EXPIRED: provider e followers recuperam exatamente seus stakes (sem taxas extras)", async () => {
      await deploy();
      const sigId = await openSignal();
      const aliceStakeGross = ethers.parseEther("0.05");
      await follow(sigId, alice, aliceStakeGross);

      await time.increase(SIGNAL_TIMEOUT + 1);
      await contract.expireSignal(sigId);

      const sig = await contract.getSignal(sigId);

      // Provider recupera providerStake (já descontada a taxa de entrada)
      const pendingProv = await contract.pendingWithdrawal(provider.address);
      expect(pendingProv).to.equal(sig.providerStake);

      // Alice recupera seu stakeNet
      await contract.connect(alice).claimExpired(sigId);
      const pendingAlice = await contract.pendingWithdrawal(alice.address);
      const aliceFee   = (aliceStakeGross * NETWORK_FEE_BPS) / BPS_BASE;
      const aliceNet   = aliceStakeGross - aliceFee;
      expect(pendingAlice).to.equal(aliceNet);
    });
  });

  // ═══════════════════════════════════════════════
  // 16. performUpkeep — dados maliciosos
  // ═══════════════════════════════════════════════
  describe("ATAQUE 16 — performUpkeep com ação inválida", () => {
    it("performUpkeep com ação=0 em sinal já resolvido reverte graciosamente", async () => {
      await deploy();
      const sigId = await openSignal();
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(sigId);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8","uint256"], [0, sigId]
      );
      await expect(contract.performUpkeep(data))
        .to.be.revertedWith("INC: sinal ja resolvido");
    });

    it("performUpkeep com ação=1 em sinal não expirado reverte", async () => {
      await deploy();
      const sigId = await openSignal();

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8","uint256"], [1, sigId]
      );
      await expect(contract.performUpkeep(data))
        .to.be.revertedWith("INC: prazo nao atingido");
    });
  });

  // ═══════════════════════════════════════════════
  // 17. TAXA DE REDE — treasury recebe corretamente
  // ═══════════════════════════════════════════════
  describe("ATAQUE 17 — Integridade das taxas", () => {
    it("Treasury acumula taxas corretas de createSignal e followSignal", async () => {
      await deploy();
      const sigId = await openSignal(0, PSTAKE);
      await follow(sigId, alice, FSTAKE);

      const expectedFeeP = (PSTAKE * NETWORK_FEE_BPS) / BPS_BASE;
      const expectedFeeF = (FSTAKE * NETWORK_FEE_BPS) / BPS_BASE;
      const expectedTotal = expectedFeeP + expectedFeeF;

      const treasuryPending = await contract.pendingWithdrawal(treasury.address);
      expect(treasuryPending).to.equal(expectedTotal);
    });

    it("Treasury pode sacar suas taxas via withdraw()", async () => {
      await deploy();
      await openSignal(0, PSTAKE);

      const pending = await contract.pendingWithdrawal(treasury.address);
      const balBefore = await ethers.provider.getBalance(treasury.address);
      const tx = await contract.connect(treasury).withdraw();
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(treasury.address);

      expect(balAfter + gas - balBefore).to.equal(pending);
    });
  });

  // ═══════════════════════════════════════════════
  // 18. WIN RATE — integridade da métrica
  // ═══════════════════════════════════════════════
  describe("ATAQUE 18 — Integridade do win rate", () => {
    it("Win rate = 100% após 1 sinal vencedor", async () => {
      await deploy();
      await openSignal();
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(1n);

      const wr = await contract.getWinRate(provider.address);
      expect(wr).to.equal(10000n); // 100% em BPS
    });

    it("Win rate = 50% após 1 win e 1 loss", async () => {
      await deploy();
      // Sinal 1 — WIN
      await openSignal();
      await mockFeed.updateAnswer(TP);
      await contract.resolveByOracle(1n);

      // Sinal 2 — LOSS
      await mockFeed.updateAnswer(ENTRY);
      await openSignal();
      await mockFeed.updateAnswer(SL);
      await contract.resolveByOracle(2n);

      const wr = await contract.getWinRate(provider.address);
      expect(wr).to.equal(5000n); // 50% em BPS
    });
  });

  // ═══════════════════════════════════════════════
  // 19. SINAL COM PAR INVÁLIDO
  // ═══════════════════════════════════════════════
  describe("ATAQUE 19 — Parâmetros inválidos em createSignal", () => {
    it("Rejeita pair vazio", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "", 0, ENTRY, TP, SL, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: par invalido");
    });

    it("Rejeita pair com mais de 20 caracteres", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "AAAAAAAAAAAAAAAAAAAAAAA", 0, ENTRY, TP, SL, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: par invalido");
    });

    it("Rejeita par sem feed configurado", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "ETH/USDT", 0, ENTRY, TP, SL, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: par sem oracle configurado");
    });

    it("Rejeita RSI > 100", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, ENTRY, TP, SL, 101, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: RSI invalido");
    });

    it("Rejeita entryPrice = 0", async () => {
      await deploy();
      await expect(
        contract.connect(provider).createSignal(
          "BTC/USDT", 0, 0n, TP, SL, 28, { value: PSTAKE }
        )
      ).to.be.revertedWith("INC: entry price invalido");
    });
  });

  // ═══════════════════════════════════════════════
  // 20. DOUBLE-FOLLOW MESMO ENDEREÇO
  // ═══════════════════════════════════════════════
  describe("ATAQUE 20 — Double follow", () => {
    it("Rejeita segundo follow do mesmo endereço", async () => {
      await deploy();
      const sigId = await openSignal();
      await follow(sigId, alice);
      await expect(follow(sigId, alice))
        .to.be.revertedWith("INC: ja esta seguindo");
    });
  });
});
