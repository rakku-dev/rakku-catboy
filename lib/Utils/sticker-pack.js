// Rakku: pembuat Sticker Pack (cover + stickers[]) untuk sock.sendMessage(jid, { cover, stickers, name, publisher, description }).
import { Boom } from '@hapi/boom';
import { zip } from 'fflate';
import { promises as fs } from 'fs';
import { proto } from '../../WAProto/index.js';
import { sha256 } from './crypto.js';
import { generateMessageIDV2, unixTimestampSeconds } from './generics.js';
import { encryptedStream, getStream, toBuffer } from './messages-media.js';
const CONCURRENCY_LIMIT = 8;
const MAX_STICKERS = 60;
const isWebP = (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
const isAnimatedWebP = (b) => {
    if (!isWebP(b)) return false;
    let o = 12;
    while (o < b.length - 8) {
        const fourCC = b.toString('ascii', o, o + 4);
        const size = b.readUInt32LE(o + 4);
        if (fourCC === 'VP8X' && (b[o + 8] & 0x02)) return true;
        if (fourCC === 'ANIM' || fourCC === 'ANMF') return true;
        o += 8 + size + (size % 2);
    }
    return false;
};
const loadSharp = async () => {
    const mod = await import('sharp').catch(() => undefined);
    const sharp = mod?.default;
    if (!sharp) throw new Boom('Sticker pack butuh paket "sharp" (npm i sharp)', { statusCode: 400 });
    return sharp;
};
const toWebP = async (sharp, buffer) => isWebP(buffer)
    ? buffer
    : sharp(buffer).resize(512, 512, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
const uploadEncrypted = async (buffer, type, options, mediaKey) => {
    const enc = await encryptedStream(buffer, type, { logger: options.logger, opts: options.options, mediaKey });
    try {
        const res = await options.upload(enc.encFilePath, {
            fileEncSha256B64: enc.fileEncSha256.toString('base64'),
            mediaType: type,
            timeoutMs: options.mediaUploadTimeoutMs
        });
        return { enc, res };
    }
    finally {
        fs.unlink(enc.encFilePath).catch(() => options.logger?.warn('failed to remove tmp file'));
    }
};
export const prepareStickerPackMessage = async (message, options) => {
    const { cover, stickers = [], name = '📦 Sticker Pack', publisher = 'Rakku', description = '' } = message;
    if (!Array.isArray(stickers) || stickers.length === 0)
        throw new Boom('Sticker pack must contain at least one sticker', { statusCode: 400 });
    if (stickers.length > MAX_STICKERS)
        throw new Boom(`Sticker pack exceeds the maximum of ${MAX_STICKERS} stickers`, { statusCode: 400 });
    if (!cover)
        throw new Boom('Sticker pack must contain a cover', { statusCode: 400 });
    const logger = options.logger;
    const sharp = await loadSharp();
    const packId = generateMessageIDV2();
    const files = {};
    const meta = new Array(stickers.length);
    for (let i = 0; i < stickers.length; i += CONCURRENCY_LIMIT) {
        const end = Math.min(i + CONCURRENCY_LIMIT, stickers.length);
        const jobs = [];
        for (let idx = i; idx < end; idx++) {
            jobs.push((async () => {
                const st = stickers[idx];
                const { stream } = await getStream(st.data, options.options);
                const raw = await toBuffer(stream);
                const webp = await toWebP(sharp, raw);
                if (webp.length > 1024 * 1024)
                    throw new Boom(`Sticker at index ${idx} exceeds the 1MB size limit`, { statusCode: 400 });
                const fileName = `${sha256(webp).toString('base64').replace(/[/+=]/g, '-')}.webp`;
                files[fileName] = [new Uint8Array(webp), { level: 0 }];
                meta[idx] = {
                    fileName,
                    mimetype: 'image/webp',
                    isAnimated: isAnimatedWebP(webp),
                    emojis: st.emojis || ['✨'],
                    accessibilityLabel: st.accessibilityLabel || '‎'
                };
            })());
        }
        await Promise.all(jobs);
    }
    const { stream: coverStream } = await getStream(cover, options.options);
    const coverRaw = await toBuffer(coverStream);
    const trayIconFileName = `${packId}.webp`;
    files[trayIconFileName] = [new Uint8Array(await toWebP(sharp, coverRaw)), { level: 0 }];
    const zipBuffer = await new Promise((resolve, reject) => zip(files, (err, data) => err ? reject(err) : resolve(Buffer.from(data))));
    const { enc: packEnc, res: packRes } = await uploadEncrypted(zipBuffer, 'sticker-pack', options);
    const obj = {
        name,
        publisher,
        stickerPackId: packId,
        packDescription: description,
        stickerPackOrigin: proto.Message.StickerPackMessage.StickerPackOrigin.USER_CREATED,
        stickerPackSize: zipBuffer.length,
        stickers: meta,
        fileSha256: packEnc.fileSha256,
        fileEncSha256: packEnc.fileEncSha256,
        mediaKey: packEnc.mediaKey,
        directPath: packRes.directPath,
        fileLength: packEnc.fileLength,
        mediaKeyTimestamp: unixTimestampSeconds(),
        trayIconFileName
    };
    // Thumbnail (opsional): kalau gagal, pack tetap terkirim tanpa thumbnail.
    try {
        const thumb = await sharp(coverRaw).resize(252, 252).jpeg().toBuffer();
        const { enc, res } = await uploadEncrypted(thumb, 'thumbnail-sticker-pack', options, packEnc.mediaKey);
        Object.assign(obj, {
            thumbnailDirectPath: res.directPath,
            thumbnailSha256: enc.fileSha256,
            thumbnailEncSha256: enc.fileEncSha256,
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: sha256(thumb).toString('base64')
        });
    }
    catch (e) {
        logger?.warn(`Sticker pack thumbnail failed: ${e}`);
    }
    return proto.Message.StickerPackMessage.fromObject(obj);
};
