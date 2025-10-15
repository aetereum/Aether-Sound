const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const {
  PrivateKey, PublicKey, AccountId,
  TokenCreateTransaction, TokenType, TokenSupplyType, TokenMintTransaction,
  Hbar, KeyList, CustomRoyaltyFee, CustomFixedFee,
} = require('@hashgraph/sdk');
const { body, validationResult } = require('express-validator');
const config = require('../config'); // Usar configuración centralizada
const logger = require('../utils/logger'); // Usar el logger centralizado

const router = express.Router();

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Wrapper para rutas asíncronas
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = (OUTPUT_DIR, getClient) => {
  // --- RUTAS DE COLECCIÓN (TOKEN) ---

  // DEPRECATED: Esta ruta crea una colección y mintea los NFTs de un álbum a la vez.
  // Es mejor separar la creación de la colección del minteo.
  router.post(
    '/collection/create-from-album',
    [body('albumId').notEmpty().withMessage('albumId es requerido.')],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { albumId } = req.body;
        const manifestPath = path.join(OUTPUT_DIR, `${path.basename(albumId)}.json`);
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

        const client = getClient();
        const operatorKey = PrivateKey.fromString(config.hedera.privateKey);

        logger.info(`Creando colección para el álbum: ${manifest.title}`);
        const tokenTx = await new TokenCreateTransaction()
            .setTokenName(manifest.title)
            .setTokenSymbol(`${manifest.artist.slice(0, 4).toUpperCase()}ALB`)
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
        logger.info(`Colección creada con Token ID: ${tokenId}`);

        const metadataBuffers = manifest.tracks.map(trackFile => {
            const metadata = {
                name: path.basename(trackFile, path.extname(trackFile)),
                description: `Pista de ${manifest.artist} del álbum ${manifest.title}`,
                image: manifest.cover || '',
                audio: `${req.protocol}://${req.get('host')}/output/${encodeURIComponent(trackFile)}`
            };
            return Buffer.from(JSON.stringify(metadata));
        });

        logger.info(`Minteando ${metadataBuffers.length} NFTs para la colección ${tokenId}...`);
        const mintTx = await new TokenMintTransaction()
            .setTokenId(tokenId)
            .setMetadata(metadataBuffers)
            .freezeWith(client)
            .sign(operatorKey);

        const mintSubmit = await mintTx.execute(client);
        const mintReceipt = await mintSubmit.getReceipt(client);
        const serials = mintReceipt.serials.map(s => s.toNumber());

        logger.info(`NFTs minteados: ${serials.join(', ')}`);

        res.json({
            success: true,
            message: `¡Álbum minteado! Colección: ${tokenId.toString()}`,
            tokenId: tokenId.toString(),
            serials,
        });
    }),
  );
  
  // --- NUEVA RUTA PARA MINTEAR NFTs EN UNA COLECCIÓN EXISTENTE ---
  router.post(
    '/nft/mint',
    [
      body('tokenId').notEmpty().withMessage('tokenId (ID de la colección) es requerido.'),
      body('metadata').isArray({ min: 1 }).withMessage('metadata debe ser un array con al menos un objeto.'),
      body('metadata.*.name').notEmpty().withMessage('Cada NFT debe tener un nombre (name).'),
      body('metadata.*.description').notEmpty().withMessage('Cada NFT debe tener una descripción (description).'),
      body('metadata.*.audioUrl').isURL().withMessage('Cada NFT debe tener una URL de audio válida (audioUrl).'),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
      const { tokenId, metadata } = req.body;

      const client = getClient();
      const operatorKey = PrivateKey.fromString(config.hedera.privateKey);

      // Convertir la metadata en buffers para la transacción
      const metadataBuffers = metadata.map(item => Buffer.from(JSON.stringify(item)));

      // Crear y ejecutar la transacción de minteo
      const mintTx = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata(metadataBuffers) // Mintear múltiples NFTs en una sola transacción
        .freezeWith(client)
        .sign(operatorKey);

      const mintSubmit = await mintTx.execute(client);
      const mintReceipt = await mintSubmit.getReceipt(client);
      const serials = mintReceipt.serials.map(s => s.toNumber());

      logger.info(`Nuevos NFTs minteados en la colección ${tokenId}: ${serials.join(', ')}`);

      res.status(201).json({
        success: true,
        message: `${serials.length} NFT(s) minteado(s) exitosamente.`,
        tokenId: tokenId,
        serials: serials,
      });
    }),
  );

  // API: Crear colección NFT con gobernanza y royalties
  router.post(
    '/collection/create',
    [
      body('name').isString().notEmpty().withMessage('El nombre (name) de la colección es requerido.'),
      body('symbol').isString().notEmpty().withMessage('El símbolo (symbol) de la colección es requerido.'),
      body('artistAccountId').optional().isString(),
      body('royalties.artistBps').optional().isInt({ min: 0, max: 10000 }),
      body('royalties.projectBps').optional().isInt({ min: 0, max: 10000 }),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
      const {
        name,
        symbol,
        artistAccountId,
        artistPublicKey,
        governance = { mode: 'project' },
        royalties = { artistBps: 0, projectBps: 0, minHbar: 0 },
      } = req.body || {};

      const client = getClient();
      const operatorKey = PrivateKey.fromString(config.hedera.privateKey);

      const projectPubKey = operatorKey.publicKey;
      let artistPubKey = null;
      if (artistPublicKey) {
        try {
          artistPubKey = PublicKey.fromString(artistPublicKey);
        } catch {
          try {
            artistPubKey = PublicKey.fromBytes(Buffer.from(artistPublicKey.replace(/^0x/i, ''), 'hex'));
          } catch {
            return res.status(400).json({ ok: false, error: 'artistPublicKey inválida' });
          }
        }
      }

      const mode = (governance?.mode || 'project').toLowerCase();
      let supplyKey = projectPubKey;
      const adminKey = projectPubKey;
      const feeScheduleKey = projectPubKey;

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

      const treasuryId = AccountId.fromString(config.hedera.accountId);
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

      return res.status(201).json({
        success: true,
        network: config.hedera.network,
        tokenId: tokenId?.toString(),
        governance: { mode, adminKey: 'project', feeScheduleKey: customFees.length > 0 ? 'project' : null },
        treasury: treasuryId.toString(),
        royalties: { artistBps, projectBps, minHbar },
      });
    }),
  );

  // NUEVO: Crear colección NFT con múltiples splits de royalties (colaboradores)
  router.post(
    '/split-nft/create',
    [
      body('name').isString().notEmpty().withMessage('El nombre (name) de la colección es requerido.'),
      body('symbol').isString().notEmpty().withMessage('El símbolo (symbol) de la colección es requerido.'),
      body('splits').isArray({ min: 1 }).withMessage('Se requiere al menos un split.'),
      body('splits.*.accountId').isString().notEmpty().withMessage('Cada split debe tener un accountId.'),
      body('splits.*.bps').isInt({ min: 1, max: 10000 }).withMessage('Cada split debe tener un valor bps (1-10000).'),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { name, symbol, minHbar = 0, splits = [] } = req.body;

        const client = getClient();
        const operatorKey = PrivateKey.fromString(config.hedera.privateKey);

        const adminKey = operatorKey.publicKey;
        const supplyKey = operatorKey.publicKey;
        const feeScheduleKey = operatorKey.publicKey;
        const treasuryId = AccountId.fromString(config.hedera.accountId);

        const customFees = [];
        const normalizedSplits = [];
        let totalBps = 0;

        for (const s of splits) {
            const bps = s.bps;
            const collector = AccountId.fromString(s.accountId);
            totalBps += bps;

            const rf = new CustomRoyaltyFee()
                .setNumerator(bps)
                .setDenominator(10000)
                .setFeeCollectorAccountId(collector);

            const fb = Number(s.minHbar ?? minHbar) || 0;
            if (fb > 0) rf.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(fb)));
            
            customFees.push(rf);
            normalizedSplits.push({ accountId: collector.toString(), bps, minHbar: fb });
        }

        if (totalBps > 10000) {
            return res.status(400).json({ success: false, error: `La suma de bps (${totalBps}) supera 10000 (100%).` });
        }

        const tx = new TokenCreateTransaction()
            .setTokenName(name)
            .setTokenSymbol(symbol.toUpperCase())
            .setTokenType(TokenType.NonFungibleUnique)
            .setSupplyType(TokenSupplyType.Infinite)
            .setTreasuryAccountId(treasuryId)
            .setAdminKey(adminKey)
            .setSupplyKey(supplyKey)
            .setFeeScheduleKey(feeScheduleKey)
            .setCustomFees(customFees)
            .setMaxTransactionFee(new Hbar(30)); // Aumentado por si hay muchos splits

        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        const tokenId = receipt.tokenId;

        logger.info(`Colección con splits creada: ${tokenId}`);

        return res.status(201).json({
            success: true,
            network: config.hedera.network,
            tokenId: tokenId?.toString(),
            treasury: treasuryId.toString(),
            splits: normalizedSplits,
        });
    }),
  );

  // ... (el resto de las rutas de hedera como /split-nft/mint, /token/associate, etc.)
  // ... (se omiten por brevedad, pero se moverían aquí)

  return router;
};
