const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { Client, PrivateKey, PublicKey, AccountId, TokenId, TokenCreateTransaction, TokenType, TokenSupplyType, TokenMintTransaction, TokenAssociateTransaction, TransferTransaction, Hbar, AccountInfoQuery, AccountBalanceQuery, KeyList, CustomRoyaltyFee, CustomFixedFee, Transaction, AccountCreateTransaction, TokenNftInfoQuery, NftId } = require('@hashgraph/sdk');

const router = express.Router();

module.exports = (OUTPUT_DIR, getClient, slugify) => {

  // API: Mint en Hedera (IMPLEMENTACIÓN REAL)
  router.post('/mint', async (req, res) => {
    try {
      const { albumId } = req.body;
      if (!albumId) return res.status(400).json({ ok: false, error: 'albumId requerido' });

      const manifestPath = path.join(OUTPUT_DIR, `${path.basename(albumId)}.json`);
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

      const client = getClient();
      const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);

      // 1. Crear la colección de NFTs para el álbum
      const tokenTx = await new TokenCreateTransaction()
        .setTokenName(manifest.title)
        .setTokenSymbol(manifest.artist.slice(0, 4).toUpperCase() + 'ALB')
        .setTokenType(TokenType.NonFungibleUnique)
        .setDecimals(0)
        .setInitialSupply(0)
        .setTreasuryAccountId(client.operatorAccountId)
        .setSupplyKey(operatorKey.publicKey)
        .setAdminKey(operatorKey.publicKey)
        .freezeWith(client)
        .sign(operatorKey);

      const tokenSubmit = await tokenTx.execute(client);
      const tokenReceipt = await tokenSubmit.getReceipt(client);
      const tokenId = tokenReceipt.tokenId;

      // 2. Mintear un NFT por cada pista del álbum
      const serials = [];
      for (const trackFile of manifest.tracks) {
        const metadata = {
          name: path.basename(trackFile, path.extname(trackFile)),
          description: `Pista de ${manifest.artist} del álbum ${manifest.title}`,
          image: manifest.cover || '', // Asumiendo que hay una URL de carátula
          audio: `${req.protocol}://${req.get('host')}/output/${encodeURIComponent(trackFile)}`
        };
        const mintTx = await new TokenMintTransaction()
          .setTokenId(tokenId)
          .setMetadata([Buffer.from(JSON.stringify(metadata))])
          .freezeWith(client)
          .sign(operatorKey);
        const mintSubmit = await mintTx.execute(client);
        const mintReceipt = await mintSubmit.getReceipt(client);
        serials.push(...mintReceipt.serials.map(s => s.toNumber()));
      }

      // 3. Guardar el resultado
      const collectionManifest = { ...manifest, hederaTokenId: tokenId.toString(), trackSerials: serials };
      const collectionPath = path.join(OUTPUT_DIR, `collection-${albumId}.json`);
      await fs.writeFile(collectionPath, JSON.stringify(collectionManifest, null, 2), 'utf8');

      res.json({
        ok: true,
        message: `Álbum minteado! Colección: ${tokenId.toString()}. NFTs: ${serials.join(', ')}`,
        tokenId: tokenId.toString(),
        serials,
      });

    } catch (e) {
      console.error('Hedera mint error:', e);
      res.status(500).json({ ok: false, error: 'Fallo al mintear en Hedera: ' + (e?.message || e) });
    }
  });

  // API: Crear colección NFT con gobernanza y royalties
  router.post('/token/create', async (req, res) => {
    try {
      const {
        name,
        symbol,
        artistAccountId,
        artistPublicKey,
        treasuryAccountId,
        governance = { mode: 'project' },
        royalties = { artistBps: 0, projectBps: 0, minHbar: 0 },
      } = req.body || {};

      const client = getClient();
      const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);

      const projectPubKey = operatorKey.publicKey;
      let artistPubKey = null;
      if (artistPublicKey) {
        try { artistPubKey = PublicKey.fromString(artistPublicKey); } catch (_) {
          try { artistPubKey = PublicKey.fromBytes(Buffer.from(artistPublicKey.replace(/^0x/i, ''), 'hex')); } catch (e) {
            return res.status(400).json({ ok: false, error: 'artistPublicKey inválida' });
          }
        }
      }

      const mode = (governance?.mode || 'project').toLowerCase();
      let supplyKey = projectPubKey;
      let adminKey = projectPubKey;
      let feeScheduleKey = projectPubKey;

      if (mode === 'artist') {
        if (!artistPubKey) {
          supplyKey = projectPubKey;
        } else {
          supplyKey = artistPubKey;
        }
      } else if (mode === '1of2' || mode === '2of2') {
        if (!artistPubKey) {
          supplyKey = projectPubKey;
        } else {
          const kl = new KeyList([projectPubKey, artistPubKey]);
          kl.setThreshold(mode === '1of2' ? 1 : 2);
          supplyKey = kl;
        }
      }

      let treasuryId = client.operatorAccountId;
      if (treasuryAccountId && treasuryAccountId !== client.operatorAccountId.toString()) {
        console.warn('Solicitud de tesorería distinta al operador; usando operador como treasury');
      }

      const customFees = [];
      const artistBps = Number(royalties?.artistBps) || 0;
      const projectBps = Number(royalties?.projectBps) || 0; // bps = basis points (1% = 100bps)
      const minHbar = Number(royalties?.minHbar) || 0;
      if (artistBps > 0 && artistAccountId) {
        const rf = new CustomRoyaltyFee()
          .setNumerator(artistBps)
          .setDenominator(10000)
          .setFeeCollectorAccountId(AccountId.fromString(artistAccountId));
        if (minHbar > 0) rf.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(minHbar)));
        customFees.push(rf);
      }
      if (projectBps > 0) {
        const rf2 = new CustomRoyaltyFee()
          .setNumerator(projectBps)
          .setDenominator(10000) // bps
          .setFeeCollectorAccountId(client.operatorAccountId);
        if (minHbar > 0) rf2.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(minHbar)));
        customFees.push(rf2);
      }

      if (!name || !symbol) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: name y symbol' });

      const tx = new TokenCreateTransaction()
        .setTokenName(String(name).slice(0, 100))
        .setTokenSymbol(String(symbol).slice(0, 6).toUpperCase())
        .setDecimals(0)
        .setInitialSupply(0)
        .setTokenType(TokenType.NonFungibleUnique)
        .setSupplyType(TokenSupplyType.Infinite)

        .setTreasuryAccountId(treasuryId)
        .setAdminKey(adminKey)
        .setSupplyKey(supplyKey)
        .setMaxTransactionFee(new Hbar(20));

      if (customFees.length > 0) {
        tx.setFeeScheduleKey(feeScheduleKey).setCustomFees(customFees);
      }

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);
      const tokenId = receipt.tokenId;

      return res.json({
        ok: true, network: process.env.HEDERA_NETWORK || 'testnet',
        tokenId: tokenId?.toString(),
        governance: { mode, adminKey: 'project', feeScheduleKey: customFees.length > 0 ? 'project' : null },
        treasury: treasuryId.toString(),
        royalties: { artistBps, projectBps, minHbar },
        notes: treasuryAccountId && treasuryAccountId !== client.operatorAccountId.toString() ? 'Se ignoró treasuryAccountId distinto al operador por falta de firma' : undefined,
      });
    } catch (e) {
      console.error('Hedera token/create error:', e?.message || e);
      res.status(500).json({ ok: false, error: 'Fallo al crear token: ' + (e?.message || e) });
    }
  });

  // NUEVO: Crear colección NFT con múltiples splits de royalties (colaboradores)
  router.post('/split-nft/create', async (req, res) => {
    try {
      const {
        name,
        symbol,
        treasuryAccountId,
        minHbar = 0,
        splits = [], // [{ accountId: string, bps: number, minHbar?: number }]
      } = req.body || {};

      const client = getClient();
      const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
      if (!name || !symbol) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: name y symbol' });
      if (!Array.isArray(splits) || splits.length === 0) return res.status(400).json({ ok: false, error: 'Debes proporcionar al menos un split en "splits"' });

      // Claves básicas
      const adminKey = operatorKey.publicKey;
      const supplyKey = operatorKey.publicKey;
      const feeScheduleKey = operatorKey.publicKey;

      // Tesorería
      let treasuryId = client.operatorAccountId;
      if (treasuryAccountId && treasuryAccountId !== client.operatorAccountId.toString()) {
        console.warn('Solicitud de tesorería distinta al operador; usando operador como treasury');
      }

      // Construir CustomRoyaltyFee por split
      const customFees = [];
      const normalizedSplits = [];
      let totalBps = 0;
      for (const s of splits) {
        const bps = Number(s?.bps) || 0;
        const acct = s?.accountId;
        if (!acct || bps <= 0) continue;
        let collector;
        try { collector = AccountId.fromString(String(acct)); } catch (_) {
          return res.status(400).json({ ok: false, error: `accountId inválido en split: ${acct}` });
        }
        // Verificar que el collector exista en la red para evitar errores INVALID_CUSTOM_FEE_COLLECTOR
        try {
          await new AccountInfoQuery().setAccountId(collector).execute(client);
        } catch (err) {
          return res.status(400).json({ ok: false, error: `Fee collector no existe o es inválido: ${collector.toString()}` });
        }
        if (bps > 10000) return res.status(400).json({ ok: false, error: `bps inválido (>10000) para collector ${collector.toString()}` });
        totalBps += bps;
        const rf = new CustomRoyaltyFee()
          .setNumerator(bps)
          .setDenominator(10000)
          .setFeeCollectorAccountId(collector);
        const fb = Number(s?.minHbar ?? minHbar) || 0;
        if (fb > 0) rf.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(fb)));
        customFees.push(rf);
        normalizedSplits.push({ accountId: collector.toString(), bps, minHbar: fb || 0 });
      }

      if (customFees.length === 0) return res.status(400).json({ ok: false, error: 'Ningún split válido (revisa accountId/bps)' });
      if (totalBps > 10000) return res.status(400).json({ ok: false, error: `La suma de bps (${totalBps}) supera 10000 (100%).` });

      const tx = new TokenCreateTransaction()
        .setTokenName(String(name).slice(0, 100))
        .setTokenSymbol(String(symbol).slice(0, 6).toUpperCase())
        .setDecimals(0)
        .setInitialSupply(0)
        .setTokenType(TokenType.NonFungibleUnique)
        .setSupplyType(TokenSupplyType.Infinite)
        .setTreasuryAccountId(treasuryId)
        .setAdminKey(adminKey)
        .setSupplyKey(supplyKey)
        .setMaxTransactionFee(new Hbar(20));

      if (customFees.length > 0) {
        tx.setFeeScheduleKey(feeScheduleKey).setCustomFees(customFees);
      }

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);
      const tokenId = receipt.tokenId;

      return res.json({ ok: true,
        network: process.env.HEDERA_NETWORK || 'testnet',
        tokenId: tokenId?.toString(),
        treasury: treasuryId.toString(),
        splits: normalizedSplits,
      });
    } catch (e) {
      console.error('Hedera split-nft/create error:', e?.message || e);
      res.status(500).json({ ok: false, error: 'Fallo en split-nft/create: ' + (e?.message || e) });
    }
  });

  // ... (el resto de las rutas de hedera como /split-nft/mint, /token/associate, etc.)
  // ... (se omiten por brevedad, pero se moverían aquí)

  return router;
};