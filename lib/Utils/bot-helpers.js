// Rakku helpers: fungsi kecil siap pakai untuk bot (ringan, tanpa dependency baru).
// Semua fungsi memakai API bawaan socket, tidak mengubah perilaku Baileys.
// Nama yang sudah ada di socket (mis. dibuat oleh bot kamu) tidak akan ditimpa.
import { isJidGroup, isLidUser, isPnUser, jidNormalizedUser } from '../WABinary/index.js';

const toJid = (v) => {
    if (!v || typeof v !== 'string') return '';
    return jidNormalizedUser(v.includes('@') ? v : `${v}@s.whatsapp.net`);
};
const userPart = (jid) => String(jid || '').split('@')[0].split(':')[0];

export const attachBotHelpers = (sock) => {
    const define = (name, fn) => {
        if (!(name in sock)) sock[name] = fn;
    };

    /** Nomor (PN jid) dari PN atau LID. undefined kalau belum diketahui. */
    define('toPn', async (jid) => {
        const j = toJid(jid);
        if (!j) return undefined;
        if (isPnUser(j)) return j;
        return (await sock.findUserId(j)).phoneNumber;
    });

    /** LID dari PN atau LID. undefined kalau belum diketahui. */
    define('toLid', async (jid) => {
        const j = toJid(jid);
        if (!j) return undefined;
        if (isLidUser(j)) return j;
        return (await sock.findUserId(j)).lid;
    });

    /** Apakah dua JID adalah orang yang sama (PN / LID / akhiran device diabaikan). */
    define('isSameUser', async (a, b) => {
        const ja = toJid(a);
        const jb = toJid(b);
        if (!ja || !jb) return false;
        if (userPart(ja) === userPart(jb)) return true;
        const [ia, ib] = await Promise.all([sock.findUserId(ja), sock.findUserId(jb)]);
        const setA = new Set([ia.phoneNumber, ia.lid, ja].filter(Boolean).map(userPart));
        return [ib.phoneNumber, ib.lid, jb].filter(Boolean).some((x) => setA.has(userPart(x)));
    });

    /** Daftar admin grup: [{ id, pn, lid, admin }] */
    define('getGroupAdmins', async (groupJid) => {
        if (!isJidGroup(groupJid)) return [];
        const meta = await sock.groupMetadata(groupJid);
        return (meta?.participants || [])
            .filter((p) => p.admin)
            .map((p) => ({
                id: p.id,
                pn: p.phoneNumber || (isPnUser(p.id) ? p.id : undefined),
                lid: p.lid || (isLidUser(p.id) ? p.id : undefined),
                admin: p.admin
            }));
    });

    /** Apakah user admin di grup itu? */
    define('isGroupAdmin', async (groupJid, user) => {
        const admins = await sock.getGroupAdmins(groupJid);
        if (!admins.length) return false;
        const me = await sock.findUserId(toJid(user));
        const mine = new Set([toJid(user), me.phoneNumber, me.lid].filter(Boolean).map(userPart));
        return admins.some((a) => [a.id, a.pn, a.lid].filter(Boolean).some((x) => mine.has(userPart(x))));
    });

    /** Apakah bot sendiri admin di grup itu? */
    define('isBotAdmin', async (groupJid) => {
        const ids = [sock.user?.id, sock.user?.lid].filter(Boolean);
        for (const id of ids) {
            if (await sock.isGroupAdmin(groupJid, id)) return true;
        }
        return false;
    });

    /** Balas pesan: sock.reply(jid, 'teks', quotedMsg, { ...opsi }) */
    define('reply', (jid, text, quoted, options = {}) =>
        sock.sendMessage(jid, { text: String(text), ...options }, { quoted }));

    /** Kirim teks dengan mention. Kalau `mentions` kosong, diambil dari pola @nomor di teks. */
    define('sendMention', (jid, text, mentions, quoted, options = {}) => {
        const list = (mentions && mentions.length
            ? mentions
            : [...String(text).matchAll(/@(\d{5,16})/g)].map((m) => `${m[1]}@s.whatsapp.net`)).map(toJid);
        return sock.sendMessage(jid, { text: String(text), mentions: list, ...options }, quoted ? { quoted } : {});
    });

    /** Beri reaksi emoji: sock.react(jid, msgOrKey, '👍') */
    define('react', (jid, msgOrKey, emoji) =>
        sock.sendMessage(jid, { react: { text: emoji, key: msgOrKey?.key || msgOrKey } }));

    /** Hapus pesan: sock.deleteMessage(jid, msgOrKey) */
    define('deleteMessage', (jid, msgOrKey) =>
        sock.sendMessage(jid, { delete: msgOrKey?.key || msgOrKey }));

    return sock;
};
