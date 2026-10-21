<div align="center">

<img src="https://raw.githubusercontent.com/rakku-dev/Lucent-Storage/main/banner.jpeg" alt="Rakku Baileys" width="100%">

# Rakku Baileys

Library WhatsApp Multi-Device untuk bot yang banyak mengirim media.
Berbasis Baileys 7.0.0-rc14, dengan pemakaian memori yang hemat.

![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Base](https://img.shields.io/badge/Base-Baileys%207.0.0--rc14-blue)
![Version](https://img.shields.io/badge/version-10.7.2-25D366)
![License](https://img.shields.io/badge/License-MIT-blue)

[English](README.md) · Bahasa Indonesia

</div>

---

## Daftar isi

1. [Apa ini?](#apa-ini)
2. [Instalasi](#instalasi)
3. [Bot pertama dalam 20 baris](#bot-pertama-dalam-20-baris)
4. [Panduan fitur](#panduan-fitur)
5. [Mention, JID, dan LID](#mention-jid-dan-lid)
6. [Default dan pemakaian memori](#default-dan-pemakaian-memori)
7. [Flag pesan dan penanganan stanza](#flag-pesan-dan-penanganan-stanza)
8. [Riwayat versi](#riwayat-versi)
9. [Lisensi](#lisensi)

---

## Apa ini?

Rakku Baileys mempertahankan API socket Baileys 7 yang standar, jadi bot lama tetap jalan, lalu menambahkan alat yang biasanya dibutuhkan bot dengan banyak media:

| Bidang | Yang kamu dapat |
|---|---|
| Media | Satu pipeline untuk konversi video, audio, gambar, dan stiker (ffmpeg / sharp / audio-decode, baru dimuat saat dipakai) |
| UI interaktif | HTML langsung di dalam bubble chat, tombol dan list klasik, carousel, rich menu, widget A2UI |
| Penyimpanan | Store chat di memori, auth state berbasis file dan SQLite |
| Pengiriman | Flag kirim tambahan (`isSecret`, `protected`, `me`, `viewOnceV2`), polling gambar |
| Kripto | Engine `libsignal` asli, sama seperti Baileys rc14 standar |
| Memori | Default hemat: tanpa sinkron riwayat penuh, tanpa cache pesan terbaru |

> Catatan lisensi: kode proyek ini MIT, tapi `libsignal` (GPL-3.0) dimuat saat runtime untuk kripto Signal. Kalau kamu mendistribusikan bot-mu, cek dulu artinya buat kamu. Ini bukan saran hukum.

## Instalasi

Butuh **Node.js 20 atau lebih baru**.

```bash
npm install @rakku/baileys
```

Paket opsional, pasang hanya yang dipakai:

| Paket | Dibutuhkan untuk |
|---|---|
| `audio-decode` | Voice note (`ptt: true`), wajib |
| `sharp` | Resize dan kompres gambar |
| `fluent-ffmpeg` | Konversi video dan audio, thumbnail video |
| `jimp` `^1.6.1` | Thumbnail kalau sharp tidak dipasang |
| `link-preview-js` | Preview link |

Pasang langsung dari GitHub:

```bash
npm install github:rakku-dev/rakku-catboy
```

Atau sebagai pengganti langsung dengan nama paket biasa, di `package.json`:

```json
"@whiskeysockets/baileys": "github:rakku-dev/rakku-catboy"
```

Kalau repositori private, instalasi butuh token GitHub. Pasang sekali di mesin yang menjalankan `npm install`:

```bash
git config --global url."https://TOKEN_KAMU@github.com/".insteadOf "https://github.com/"
```

Jangan pernah menaruh token di `package.json`.

## Bot pertama dalam 20 baris

```js
import makeWASocket, { useMultiFileAuthState } from '@rakku/baileys';

const { state, saveCreds } = await useMultiFileAuthState('auth_info');
const sock = makeWASocket({ auth: state, printQRInTerminal: true });

sock.ev.on('creds.update', saveCreds);

sock.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const jid = msg.key.remoteJid;
  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

  if (text === '!ping') await sock.sendMessage(jid, { text: 'pong' }, { quoted: msg });
});
```

## Panduan fitur

### Media

```js
// Gambar dengan caption
await sock.sendMessage(jid, { image: { url: 'https://example.com/photo.jpg' }, caption: 'Halo!' });

// Voice note (butuh audio-decode)
await sock.sendMessage(jid, { audio: { url: './voice.ogg' }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
```

Konversi sebelum kirim, dan baca metadata:

```js
import { convertToWhatsAppVideo, convertToOpusAudio, getVideoThumbnail, resizeImage,
         probeMedia, getMp4Duration } from '@rakku/baileys';

const mp4  = await convertToWhatsAppVideo(rawBuffer);       // video apa saja -> MP4/H.264 (fluent-ffmpeg)
const opus = await convertToOpusAudio(audioBuffer);         // audio apa saja -> OGG/Opus
const thumb = await getVideoThumbnail(mp4, 1);              // frame di detik ke-1 (sharp)
const small = await resizeImage(imageBuffer, { width: 300, height: 300 });

const meta = await probeMedia(buffer, 'audio/mpeg');        // { duration, bitrate, container, codec }
const secs = getMp4Duration(mp4);                           // baca atom MP4, tanpa ffmpeg
```

### HTML di dalam chat (Rich WebUI)

Menampilkan halaman HTML/CSS/JS langsung di dalam bubble pesan.

```js
import { sendInlineWebUI } from '@rakku/baileys';

const html = `<!DOCTYPE html><html><head><style>
  body{background:#111b21;color:#fff;font-family:sans-serif;padding:16px}
</style></head><body><h2>Bot Menu</h2><button onclick="alert('hi')">Press me</button></body></html>`;

await sendInlineWebUI(sock, jid, html, 'Bot Menu');

// Identitas bisa diganti (default Meta AI)
await sendInlineWebUI(sock, jid, html, 'Bot Menu', { botJid: '12345@bot', forwardOrigin: 'CUSTOM' });
```

Nama primitive HTML (`GenAIaeacdsnwHtmlPrimitive`) adalah identifier WhatsApp Web yang diobfuscate. Kalau WebUI berhenti tampil setelah update WhatsApp, perbarui dari bundle WA Web terbaru.

### Tombol dan list klasik

Kartu `interactiveMessage` native-flow sudah tidak tampil di banyak client (pengiriman sukses tapi pesan tidak muncul). Template klasik `buttonsMessage` dan `listMessage` tampil di Android, iOS, Web, dan Desktop, jadi pilih ini dulu. Builder-nya ada di `lib/Utils/rich-classic.js`.

```js
import { buildButtonsMessage, buildListMessage, sendClassicMessage } from '@rakku/baileys';

const buttons = buildButtonsMessage({
  text: 'Pilih salah satu',
  footer: '© My Bot',
  buttons: [
    { buttonId: '.owner',   buttonText: 'Owner' },
    { buttonId: '.allmenu', buttonText: 'Allmenu' },
  ],
  locationMessage: { jpegThumbnail, name: 'My Bot', address: 'v10' }, // header opsional
});

const list = buildListMessage({
  title: 'Menu',
  description: 'Pilih kategori',
  buttonText: 'Pilih',
  sections: [{ title: 'Categories', rows: [
    { title: 'main',    description: '19 perintah', rowId: '.menucat main' },
    { title: 'sticker', description: '42 perintah', rowId: '.menucat sticker' },
  ]}],
});

await sendClassicMessage(sock, jid, buttons);
await sendClassicMessage(sock, jid, list);
```

`normalizeUserJid(sockOrUserOrJid)` juga diekspor. `sock.user.jid` tidak ada di Baileys 7 (`sock.user` punya `.id`), dan helper ini menerima bentuk apa saja lalu mengembalikan JID yang valid.

### Carousel dan tombol CTA

Pakai `rich-carousel.js` hanya kalau butuh kartu geser horizontal atau tipe CTA (`cta_url`, `cta_call`, `cta_copy`, `cta_reminder`, `single_select`). Catatan tampilan sama seperti di atas.

```js
import { sendInteractiveMessage, sendCarouselMessage } from '@rakku/baileys';

await sendInteractiveMessage(sock, jid, {
  text: 'Pilih aksi:',
  footer: '© My Bot',
  buttons: [
    { type: 'quick_reply', displayText: 'Owner', id: '.owner' },
    { type: 'cta_url', displayText: 'Docs', url: 'https://example.com/docs' },
  ],
});

await sendCarouselMessage(sock, jid, {
  text: 'Pilih produk:',
  cards: [
    { header: { title: 'Product A', mediaKind: 'thumbnail', jpegThumbnail }, text: 'Rp 50.000',
      buttons: [{ type: 'quick_reply', displayText: 'Beli', id: 'buy_a' }] },
    { header: { title: 'Product B', mediaKind: 'thumbnail', jpegThumbnail }, text: 'Rp 75.000',
      buttons: [{ type: 'quick_reply', displayText: 'Beli', id: 'buy_b' }] },
  ],
});
```

`buildCarouselMessage`, `buildInteractiveMessage`, `buildInteractiveCard`, dan `buildNativeFlowButton` (level lebih rendah) mengembalikan objek konten mentah tanpa mengirim.

### Rich menu (eksperimental)

Tombolnya berupa widget CTA dengan toast, bukan membalas pesan. Memakai format GenAI internal, jadi mungkin tidak tampil di semua client. Juga diekspor sebagai `buildRichMenuMessage` / `sendRichMenu`.

```js
await sock.richMenu(jid, {
  header: { title: 'Main Menu', image: { url: 'https://example.com/banner.png' } },
  body:   { title: 'Pilih salah satu', buttons: ['Profile', 'Settings', 'Help'], toast: 'opening...' },
  footer: { text: 'Join us', url: 'https://example.com' },   // url wajib untuk tombol buka link
});

// Carousel: body.carousel = true + cards. Layout baris: body.row = true.
await sock.richMenu(jid, { body: { carousel: true, cards: [
  { title: 'Card 1', buttons: ['A', 'B'], toast: '...' },
  { title: 'Card 2', buttons: ['C', 'D'], toast: '...' },
]}});
```

### Widget A2UI (eksperimental)

Widget deklaratif yang dikirim sebagai `interactiveMessage.bloksWidget`: `Text`, `Image`, `Video`, `Button`, `Card`, `Column`, `Row`, `Divider`, `CheckBox`, `TextField`, `ChoicePicker`, dan `listCard`. Format internal WhatsApp, jadi mungkin tidak tampil di semua client.

```js
import { A2UI } from '@rakku/baileys';

const ui = new A2UI();
const title = ui.text('Halo!', { variant: 'h1' });
const btn   = ui.button(ui.text('Klik saya'), { action: { name: 'noop' } });
ui.root([ui.card(ui.column([title, btn]))]);
await sock.sendA2UI(jid, { a2ui: ui, bodyText: 'Widget', footer: 'A2UI' });

const list = new A2UI().listCard({ title: 'Menu', items: [
  { title: 'Nasi goreng', price: 'Rp15.000' }, { title: 'Es teh', price: 'Rp5.000' } ]});
await sock.sendA2UI(jid, { a2ui: list, bodyText: 'Pesan menu' });
```

Opsi tambahan: `singleScreen`, `buttons` (`{ name, params }`), `expiration`, `contextInfo`, `quoted`, `wrapped`, `type`.

### Helper bot (shortcut siap pakai)

Ditempel otomatis ke socket. Tidak pernah menimpa fungsi yang sudah kamu buat sendiri di bot.

```js
const info = await sock.findUserId('6281234567890@s.whatsapp.net'); // { phoneNumber, lid }
await sock.toPn('123456789012345@lid');            // LID -> JID nomor
await sock.toLid('6281234567890@s.whatsapp.net');  // JID nomor -> LID
await sock.isSameUser(jidA, jidB);                 // true walau satu LID dan satunya nomor

await sock.getGroupAdmins(groupJid);               // [{ id, pn, lid, admin }]
await sock.isGroupAdmin(groupJid, userJid);
await sock.isBotAdmin(groupJid);

await sock.reply(jid, 'Halo', msg);                // balas pesan
await sock.sendMention(jid, 'Hai @6281234567890', undefined, msg); // mention dibuat otomatis dari @nomor
await sock.react(jid, msg, '👍');
await sock.deleteMessage(jid, msg);
```

Opsi kirim tambahan: `externalAdReply` (langsung di isi pesan), `groupStatus: true`, `spoiler: true`, `isLottie: true`, dan `raw: true` untuk mengirim objek pesan mentah.

### View-once V2

```js
await sock.sendMessage(jid, { text: 'Rahasia', viewOnceV2: true });           // viewOnceMessageV2
await sock.sendMessage(jid, { text: 'Rahasia', viewOnceV2Extension: true });  // viewOnceMessageV2Extension
```

### Polling gambar (eksperimental)

Setiap opsi berupa gambar. Ini builder sisi client untuk tipe pesan yang didefinisikan WhatsApp di proto-nya; cek tampilannya di build client tujuanmu sebelum diandalkan.

```js
import { generateWAMessageFromImagePoll } from '@rakku/baileys';

await generateWAMessageFromImagePoll(jid, {
  name: 'Pilih gambar favorit',
  selectableCount: 1,
  options: [
    { name: 'Gambar 1', image: { url: 'https://example.com/1.jpg' } },
    { name: 'Gambar 2', image: { url: 'https://example.com/2.jpg' } },
  ],
}, (msg, opts) => sock.relayMessage(jid, msg, opts), { upload: sock.waUploadToServer });
```

`hashImagePollOption(optionName, fileSha256)` diekspor kalau kamu hanya butuh hash opsinya.

### Foto profil

Secara default foto di-crop ke 640×640 dengan kualitas 50. Kirim `full` atau ukuranmu sendiri untuk mengubahnya (berlaku untuk `updateProfilePicture` dan `newsletterUpdatePicture`).

```js
await sock.updateProfilePicture(sock.user.id, buf, { full: true });                              // ~kualitas 92, tanpa resize
await sock.updateProfilePicture(sock.user.id, buf, { width: 1024, height: 1024, quality: 85 });  // ukuran sendiri
```

### Store dan auth state

```js
import makeWASocket, { makeInMemoryStore, useSqliteAuthState } from '@rakku/baileys';

const store = makeInMemoryStore({});
store.readFromFile('./store.json');
setInterval(() => store.writeToFile('./store.json'), 10_000);

// Auth SQLite butuh Node 22.5+ (node:sqlite bawaan). Node lama akan memberi error yang jelas.
const { state, saveCreds } = await useSqliteAuthState('./auth.db');

const sock = makeWASocket({ auth: state });
store.bind(sock.ev);
sock.ev.on('creds.update', saveCreds);
```

`useMultiFileAuthState` tetap bekerja seperti biasa. `makeCacheManagerAuthState` tersedia kalau kamu lebih suka backend `cache-manager` (peer dependency opsional).

## Mention, JID, dan LID

WhatsApp sekarang mengenali orang lewat dua format, dan bot harus bisa menangani keduanya.

| Format | Contoh | Arti |
|---|---|---|
| JID nomor (PN) | `6281234567890@s.whatsapp.net` | ID berbasis nomor telepon |
| LID | `123456789012345@lid` | ID anonim. Grup dan chat bisa menampilkan ini, bukan nomornya |
| Grup | `120363xxxxxxxxxx@g.us` | Chat grup |
| Saluran | `120363xxxxxxxxxx@newsletter` | Saluran WhatsApp |

### Di mana nomor aslinya

Untuk pesan masuk dari pengirim ber-LID, nomor asli menempel di key pesan:

- Pesan grup: `msg.key.participantAlt`
- Chat pribadi: `msg.key.remoteJidAlt`

### Helper siap copas

```js
import {
  jidDecode, jidNormalizedUser, areJidsSameUser,
  isLidUser, isPnUser, isJidGroup, isJidNewsletter,
} from '@rakku/baileys';

// "6281234567890:12@s.whatsapp.net" -> "6281234567890@s.whatsapp.net"
const clean = jidNormalizedUser('6281234567890:12@s.whatsapp.net');

// Orang yang sama? Tetap benar walau ada akhiran device
areJidsSameUser('6281234567890:12@s.whatsapp.net', '6281234567890@s.whatsapp.net'); // true

// Ambil angka nomor dari JID
const number = jidDecode('6281234567890@s.whatsapp.net')?.user; // "6281234567890"

// Cek tipe
isLidUser('123456789012345@lid');            // true
isPnUser('6281234567890@s.whatsapp.net');    // true
isJidGroup('120363xxxxxxxxxx@g.us');         // true

// Ambil nomor asli pengirim dari pesan masuk
function getSenderNumber(msg) {
  const raw = msg.key.participant || msg.key.remoteJid;
  const jid = isLidUser(raw) ? (msg.key.participantAlt || msg.key.remoteJidAlt || raw) : raw;
  return jidNormalizedUser(jid);
}
```

Konversi antar dua bentuk (memakai penyimpanan mapping bawaan library):

```js
const lidMapping = sock.signalRepository.lidMapping;

const lid = await lidMapping.getLIDForPN('6281234567890@s.whatsapp.net'); // PN -> LID
const pn  = await lidMapping.getPNForLID('123456789012345@lid');          // LID -> PN
```

### Cara menulis mention

Mention butuh **dua bagian yang cocok**: `@nomor` yang ditulis di teks, dan JID orang yang sama di array `mentions`.

```js
// Mention satu orang
const target = '6281234567890@s.whatsapp.net';
await sock.sendMessage(jid, {
  text: `Halo @${target.split('@')[0]}, selamat datang!`,
  mentions: [target],
});

// Mention beberapa orang
const users = ['6281234567890@s.whatsapp.net', '6289876543210@s.whatsapp.net'];
await sock.sendMessage(jid, {
  text: users.map((u) => `@${u.split('@')[0]}`).join(' ') + ' tolong cek ini.',
  mentions: users,
});

// Mention pengirim pesan yang sedang kamu balas
await sock.sendMessage(jid, {
  text: `@${msg.key.participant?.split('@')[0] || msg.key.remoteJid.split('@')[0]} kamu manggil?`,
  mentions: [msg.key.participant || msg.key.remoteJid],
}, { quoted: msg });
```

Tag semua anggota grup (pola `.tagall`):

```js
const meta = await sock.groupMetadata(jid);
const ids = meta.participants.map((p) => p.id);   // LID atau PN, sesuai yang dipakai grup itu

await sock.sendMessage(jid, {
  text: 'Perhatian semuanya!\n\n' + ids.map((id) => `@${id.split('@')[0]}`).join(' '),
  mentions: ids,
});
```

Peserta grup punya `id` (LID atau PN, tergantung grupnya) dan, untuk grup LID, field `phoneNumber` berisi nomor aslinya. Untuk menampilkan atau membandingkan nomor asli:

```js
const meta = await sock.groupMetadata(jid);
for (const p of meta.participants) {
  const number = (p.phoneNumber || p.id).split('@')[0];
  console.log(number, p.admin ? 'admin' : 'member');
}
```

Mention semua orang tanpa menulis JID satu per satu (opsi `mentionAll`):

```js
await sock.sendMessage(jid, { text: '@everyone rapat dimulai', mentionAll: true });
```

### Aturan praktis

1. Tulis `@` diikuti angka di teks, dan taruh JID lengkapnya di `mentions`. Kalau tidak cocok, teks tampil biasa, bukan mention biru.
2. Di grup, susun array `mentions` dari id `groupMetadata`, supaya formatnya sama dengan grup itu.
3. Jangan bandingkan JID mentah dari sumber berbeda dengan `===`. Pakai `areJidsSameUser`, atau normalkan keduanya dengan `jidNormalizedUser` dulu. Akhiran device (`:12`) dan perbedaan LID dengan PN akan merusak perbandingan biasa.
4. Kalau butuh nomor telepon asli (cek owner, daftar premium), pakai `participantAlt` / `remoteJidAlt` atau `phoneNumber`, bukan LID.

### Console penuh teks acak (`Closing session: SessionEntry {...}`)

Teks itu keluar dari `libsignal`, yang mencetak isi sesi (termasuk material kunci) setiap sesi lama ditutup. Ini normal, tapi jangan pernah membagikan log seperti itu. Library ini menyembunyikannya secara default. Untuk menampilkannya lagi: `makeWASocket({ silenceSignalLogs: false })`.

## Default dan pemakaian memori

```js
makeWASocket({
  auth: state,
  syncFullHistory: false,           // jangan tarik riwayat chat penuh
  enableRecentMessageCache: false,  // jangan simpan pesan terbaru di RAM
});
```

Keduanya sudah jadi default. Ubah hanya kalau kamu memang butuh riwayat.

## Flag pesan dan penanganan stanza

`relayMessage` adalah kode asli Baileys 7.0.0-rc14 (`relayMessageCore`, plus satu hook kecil `recipientFilter`). Semua fitur tambahan ada di wrapper di atasnya, dan `sendMessage`, retry, `richMenu`, serta `sendA2UI` semuanya lewat wrapper itu.

**Filter perangkat**

```js
await sock.sendMessage(jid, content, { isSecret: true });   // hanya perangkat utama penerima
await sock.sendMessage(jid, content, { protected: true });  // perangkat utama penerima + perangkatmu
await sock.sendMessage(jid, content, { me: true });         // hanya perangkatmu sendiri
```

**Node `<biz>` otomatis** untuk pesan tombol, list, dan native-flow. Dilewati kalau kamu menyertakan node `biz` sendiri di `additionalNodes`, dan untuk tujuan status dan newsletter. Semua tombol native-flow dicek, dan wrapper `viewOnce*` dibuka.

| Pesan / tombol | Node yang dikirim |
|---|---|
| `listMessage` | `<list type="product_list" v="2"/>` |
| `buttonsMessage`, native-flow lain | `native_flow` `mixed` |
| `cta_catalog`, `mpm`, `send_location`, `view_catalog`, `wa_pay_detail` | `native_flow` dengan nama yang sesuai |
| `call_request` | `call_permission_request` |
| `review_and_pay`, `review_order`, `payment_info`, `payment_status`, `payment_method` | node order / pembayaran |

`FLOW_NAME` dan `ORDER_RESPONSE_NAME` diekspor dari `lib/WABinary/generic-utils.js`.

**`type` dan `mediatype` stanza** ditentukan lewat semua wrapper (`ephemeral`, `viewOnce*`, `documentWithCaption`, `edited`, `groupStatus` / `groupStatusV2`, `groupMentioned`, `botInvoke`, `botForwarded`, `deviceSent`). Upstream membaca pesan mentah, jadi gambar yang terbungkus dikirim sebagai `type=media` tanpa `mediatype`, pola yang tidak pernah dikirim client asli. `mediatype` baru: `location`, `livelocation`, `ptv`, `sticker_pack`, `group_history`. `type=event` kini juga mencakup `encEventResponseMessage` dan `secretEncryptedMessage`, dan `type=poll` mencakup `pollCreationMessageV5` / `V6`.

> Bentuk stanza divalidasi server WhatsApp. Ini mengikuti perilaku WhatsApp Web tapi belum diverifikasi di akun asli, jadi coba dulu di nomor cadangan.

## Riwayat versi

| Versi | Perubahan |
|---|---|
| 10.7.2 | `WAProto` hasil generate yang lebih baru (`index.js` + `index.d.ts`). `LIDMigrationMapping` dan `BloksWidget` sudah termasuk. `WAProto.proto` sudah usang, jadi **jangan jalankan `npm run build:proto`**. |
| 10.7.0 | `WAProto` baru dengan 361 tipe tingkat atas (sebelumnya 202), menambah pesan bot/AI, key-derivation, backup, dan consumer-app. Tipe LID migration dikembalikan dari rc14. Opsi kirim `noSelfSync` dihapus. |
| 10.6.1 | `relayMessage` dikembalikan ke upstream dengan lapisan wrapper. `<biz>` mencakup semua jenis tombol, `listMessage` memakai `product_list`. `type` / `mediatype` stanza ditentukan lewat semua wrapper. |
| 10.5.2 | Opsi `noSelfSync` (kemudian dihapus). Polling gambar mengirim node meta `polltype="creation"`. Thumbnail kini jalan hanya dengan jimp 1.x. `BAILEYS_IMAGE_LIB=jimp` memaksa pakai jimp. |
| 10.5.0 | `viewOnceV2` / `viewOnceV2Extension`, `sock.richMenu`, widget A2UI (field 8 `BloksWidget` ditambahkan ke WAProto). |
| 10.2.0 | Polling gambar (`generateWAMessageFromImagePoll`, `hashImagePollOption`). |
| 10.1.0 | `lib/Store/*` (in-memory, cache-manager, keyed-db), `useSqliteAuthState`, filter `isSecret` / `protected` / `me`. |
| 10.0.3 | `rich-carousel.js`, `{ full: true }` untuk foto profil. |
| 10.0.2 | Injeksi `<biz>` otomatis dipulihkan. Tanpanya, tombol dan list diterima server tapi tidak pernah tampil. |
| 10.0.1 | `rich-classic.js` (tombol dan list klasik, `normalizeUserJid`). |
| 10.0.0 | Rebase ke Baileys 7.0.0-rc14. Dihapus: `lib/VoIP/*`, `Modded/message_builder.js`, `Utils/rich-messages.js`, `Socket/dugong.js`, `Utils/sticker-pack.js`. `rejectCall` tetap tersedia. `rich-webui.js` menggantikan rich messages lama. |

Perubahan lain di seri 10.x: `syncFullHistory` dan `enableRecentMessageCache` kini default `false`; `protobufjs-cli` dikunci ke `^1.1.3`; `link-preview-js` dikunci ke `^5.0.0` (advisory SSRF); engine Signal Rust kustom dibuang dan kembali ke `libsignal` standar.

## Tes

```bash
npm test
```

Mencakup utilitas JID (PN / LID / hosted) dan build Rich WebUI beserta round trip encode/decode proto.

## Lisensi

MIT untuk kode proyek ini. Berbasis library open-source Baileys (MIT). `libsignal` (GPL-3.0) adalah dependency runtime, jadi cek ketentuannya sebelum mendistribusikan ulang.
