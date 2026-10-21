<div align="center">

<img src="https://raw.githubusercontent.com/rakku-dev/Lucent-Storage/main/banner.jpeg" alt="Rakku Baileys" width="100%">

# Rakku Baileys

A WhatsApp Multi-Device library for building media-heavy bots.
Built on Baileys 7.0.0-rc14, tuned for low memory use.

![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Base](https://img.shields.io/badge/Base-Baileys%207.0.0--rc14-blue)
![Version](https://img.shields.io/badge/version-10.7.2-25D366)
![License](https://img.shields.io/badge/License-MIT-blue)

English · [Bahasa Indonesia](README.id.md)

</div>

---

## Table of contents

1. [What is this?](#what-is-this)
2. [Install](#install)
3. [First bot in 20 lines](#first-bot-in-20-lines)
4. [Feature guide](#feature-guide)
5. [Mentions, JIDs and LIDs](#mentions-jids-and-lids)
6. [Defaults and memory usage](#defaults-and-memory-usage)
7. [Message flags and stanza handling](#message-flags-and-stanza-handling)
8. [Version history](#version-history)
9. [License](#license)

---

## What is this?

Rakku Baileys keeps the standard Baileys 7 socket API, so existing bots keep working, and adds tools that bots which send lots of media tend to need:

| Area | What you get |
|---|---|
| Media | One pipeline for video, audio, image and sticker conversion (ffmpeg / sharp / audio-decode, loaded only when used) |
| Interactive UI | Inline HTML inside chat bubbles, classic buttons and lists, carousels, rich menus, A2UI widgets |
| Storage | In-memory chat store, file and SQLite auth state |
| Sending | Extra send flags (`isSecret`, `protected`, `me`, `viewOnceV2`), image polls |
| Crypto | Original `libsignal` engine, same as stock Baileys rc14 |
| Memory | Frugal defaults: no full history sync, no recent-message cache |

> Licensing note: this project's code is MIT, but `libsignal` (GPL-3.0) is loaded at runtime for Signal crypto. If you redistribute your bot, check what that means for you. This is not legal advice.

## Install

Requires **Node.js 20 or newer**.

```bash
npm install @rakku/baileys
```

Optional packages, install only what you use:

| Package | Needed for |
|---|---|
| `audio-decode` | Voice notes (`ptt: true`), required |
| `sharp` | Image resize and compression |
| `fluent-ffmpeg` | Video and audio conversion, video thumbnails |
| `jimp` `^1.6.1` | Thumbnails when sharp is not installed |
| `link-preview-js` | Link previews |

Install straight from GitHub:

```bash
npm install github:rakku-dev/rakku-catboy
```

Or as a drop-in replacement under the usual package name, in `package.json`:

```json
"@whiskeysockets/baileys": "github:rakku-dev/rakku-catboy"
```

If the repository is private, install needs a GitHub token. Add it once on the machine that runs `npm install`:

```bash
git config --global url."https://YOUR_TOKEN@github.com/".insteadOf "https://github.com/"
```

Never commit the token to `package.json`.

## First bot in 20 lines

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

## Feature guide

### Media

```js
// Image with caption
await sock.sendMessage(jid, { image: { url: 'https://example.com/photo.jpg' }, caption: 'Hello!' });

// Voice note (needs audio-decode)
await sock.sendMessage(jid, { audio: { url: './voice.ogg' }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
```

Convert before sending, and read metadata:

```js
import { convertToWhatsAppVideo, convertToOpusAudio, getVideoThumbnail, resizeImage,
         probeMedia, getMp4Duration } from '@rakku/baileys';

const mp4  = await convertToWhatsAppVideo(rawBuffer);       // any video -> MP4/H.264 (fluent-ffmpeg)
const opus = await convertToOpusAudio(audioBuffer);         // any audio -> OGG/Opus
const thumb = await getVideoThumbnail(mp4, 1);              // frame at 1s (sharp)
const small = await resizeImage(imageBuffer, { width: 300, height: 300 });

const meta = await probeMedia(buffer, 'audio/mpeg');        // { duration, bitrate, container, codec }
const secs = getMp4Duration(mp4);                           // reads MP4 atoms, no ffmpeg
```

### Inline HTML (Rich WebUI)

Renders an HTML/CSS/JS page inside the message bubble.

```js
import { sendInlineWebUI } from '@rakku/baileys';

const html = `<!DOCTYPE html><html><head><style>
  body{background:#111b21;color:#fff;font-family:sans-serif;padding:16px}
</style></head><body><h2>Bot Menu</h2><button onclick="alert('hi')">Press me</button></body></html>`;

await sendInlineWebUI(sock, jid, html, 'Bot Menu');

// Optional identity override (default is Meta AI)
await sendInlineWebUI(sock, jid, html, 'Bot Menu', { botJid: '12345@bot', forwardOrigin: 'CUSTOM' });
```

The HTML primitive name (`GenAIaeacdsnwHtmlPrimitive`) is an obfuscated WhatsApp Web identifier. If WebUI stops rendering after a WhatsApp update, refresh it from the latest WA Web bundle.

### Classic buttons and lists

Native-flow `interactiveMessage` cards no longer show on many clients (the send succeeds but nothing appears). The classic `buttonsMessage` and `listMessage` templates render on Android, iOS, Web and Desktop, so prefer them. Builders live in `lib/Utils/rich-classic.js`.

```js
import { buildButtonsMessage, buildListMessage, sendClassicMessage } from '@rakku/baileys';

const buttons = buildButtonsMessage({
  text: 'Pick an option',
  footer: '© My Bot',
  buttons: [
    { buttonId: '.owner',   buttonText: 'Owner' },
    { buttonId: '.allmenu', buttonText: 'Allmenu' },
  ],
  locationMessage: { jpegThumbnail, name: 'My Bot', address: 'v10' }, // optional header
});

const list = buildListMessage({
  title: 'Menu',
  description: 'Pick a category',
  buttonText: 'Choose',
  sections: [{ title: 'Categories', rows: [
    { title: 'main',    description: '19 commands', rowId: '.menucat main' },
    { title: 'sticker', description: '42 commands', rowId: '.menucat sticker' },
  ]}],
});

await sendClassicMessage(sock, jid, buttons);
await sendClassicMessage(sock, jid, list);
```

`normalizeUserJid(sockOrUserOrJid)` is also exported. `sock.user.jid` does not exist in Baileys 7 (`sock.user` has `.id`), and this helper accepts any shape and returns a valid JID.

### Carousel and CTA buttons

Use `rich-carousel.js` only when you need horizontal cards or CTA types (`cta_url`, `cta_call`, `cta_copy`, `cta_reminder`, `single_select`). Same rendering caveat as above.

```js
import { sendInteractiveMessage, sendCarouselMessage } from '@rakku/baileys';

await sendInteractiveMessage(sock, jid, {
  text: 'Choose an action:',
  footer: '© My Bot',
  buttons: [
    { type: 'quick_reply', displayText: 'Owner', id: '.owner' },
    { type: 'cta_url', displayText: 'Docs', url: 'https://example.com/docs' },
  ],
});

await sendCarouselMessage(sock, jid, {
  text: 'Pick a product:',
  cards: [
    { header: { title: 'Product A', mediaKind: 'thumbnail', jpegThumbnail }, text: 'Rp 50.000',
      buttons: [{ type: 'quick_reply', displayText: 'Buy', id: 'buy_a' }] },
    { header: { title: 'Product B', mediaKind: 'thumbnail', jpegThumbnail }, text: 'Rp 75.000',
      buttons: [{ type: 'quick_reply', displayText: 'Buy', id: 'buy_b' }] },
  ],
});
```

Lower-level `buildCarouselMessage`, `buildInteractiveMessage`, `buildInteractiveCard` and `buildNativeFlowButton` return the raw content object instead of sending.

### Rich menu (experimental)

Buttons act as CTA widgets with a toast rather than sending a reply. It uses an internal GenAI format, so it may not render everywhere. Also exported as `buildRichMenuMessage` / `sendRichMenu`.

```js
await sock.richMenu(jid, {
  header: { title: 'Main Menu', image: { url: 'https://example.com/banner.png' } },
  body:   { title: 'Pick one', buttons: ['Profile', 'Settings', 'Help'], toast: 'opening...' },
  footer: { text: 'Join us', url: 'https://example.com' },   // url is required for the open-link button
});

// Carousel: body.carousel = true with cards. Row layout: body.row = true.
await sock.richMenu(jid, { body: { carousel: true, cards: [
  { title: 'Card 1', buttons: ['A', 'B'], toast: '...' },
  { title: 'Card 2', buttons: ['C', 'D'], toast: '...' },
]}});
```

### A2UI widgets (experimental)

Declarative widgets sent as `interactiveMessage.bloksWidget`: `Text`, `Image`, `Video`, `Button`, `Card`, `Column`, `Row`, `Divider`, `CheckBox`, `TextField`, `ChoicePicker` and `listCard`. Internal WhatsApp format, so it may not render on every client.

```js
import { A2UI } from '@rakku/baileys';

const ui = new A2UI();
const title = ui.text('Hello!', { variant: 'h1' });
const btn   = ui.button(ui.text('Tap me'), { action: { name: 'noop' } });
ui.root([ui.card(ui.column([title, btn]))]);
await sock.sendA2UI(jid, { a2ui: ui, bodyText: 'Widget', footer: 'A2UI' });

const list = new A2UI().listCard({ title: 'Menu', items: [
  { title: 'Fried rice', price: 'Rp15.000' }, { title: 'Iced tea', price: 'Rp5.000' } ]});
await sock.sendA2UI(jid, { a2ui: list, bodyText: 'Order' });
```

Extra options: `singleScreen`, `buttons` (`{ name, params }`), `expiration`, `contextInfo`, `quoted`, `wrapped`, `type`.

### Bot helpers (ready-made shortcuts)

These are attached to the socket automatically. They never overwrite a function your bot already defines.

```js
const info = await sock.findUserId('6281234567890@s.whatsapp.net'); // { phoneNumber, lid }
await sock.toPn('123456789012345@lid');            // LID -> number JID
await sock.toLid('6281234567890@s.whatsapp.net');  // number JID -> LID
await sock.isSameUser(jidA, jidB);                 // true even if one is LID and the other a number

await sock.getGroupAdmins(groupJid);               // [{ id, pn, lid, admin }]
await sock.isGroupAdmin(groupJid, userJid);
await sock.isBotAdmin(groupJid);

await sock.reply(jid, 'Hello', msg);               // reply to a message
await sock.sendMention(jid, 'Hi @6281234567890', undefined, msg); // mentions auto-built from @number
await sock.react(jid, msg, '👍');
await sock.deleteMessage(jid, msg);
```

Extra send options: `externalAdReply` (directly in the content), `groupStatus: true`, `spoiler: true`, `isLottie: true`, and `raw: true` to send a raw message object.

### View-once V2

```js
await sock.sendMessage(jid, { text: 'Secret', viewOnceV2: true });           // viewOnceMessageV2
await sock.sendMessage(jid, { text: 'Secret', viewOnceV2Extension: true });  // viewOnceMessageV2Extension
```

### Image polls (experimental)

Each option is an image. This is a client-side builder for a message type WhatsApp defines in its proto; check rendering on your target client build before depending on it.

```js
import { generateWAMessageFromImagePoll } from '@rakku/baileys';

await generateWAMessageFromImagePoll(jid, {
  name: 'Pick your favourite',
  selectableCount: 1,
  options: [
    { name: 'Image 1', image: { url: 'https://example.com/1.jpg' } },
    { name: 'Image 2', image: { url: 'https://example.com/2.jpg' } },
  ],
}, (msg, opts) => sock.relayMessage(jid, msg, opts), { upload: sock.waUploadToServer });
```

`hashImagePollOption(optionName, fileSha256)` is exported if you only need the option hash.

### Profile pictures

By default pictures are cropped to 640×640 at quality 50. Pass `full` or your own size to change that (works for `updateProfilePicture` and `newsletterUpdatePicture`).

```js
await sock.updateProfilePicture(sock.user.id, buf, { full: true });                              // ~q92, no resize
await sock.updateProfilePicture(sock.user.id, buf, { width: 1024, height: 1024, quality: 85 });  // custom
```

### Store and auth state

```js
import makeWASocket, { makeInMemoryStore, useSqliteAuthState } from '@rakku/baileys';

const store = makeInMemoryStore({});
store.readFromFile('./store.json');
setInterval(() => store.writeToFile('./store.json'), 10_000);

// SQLite auth needs Node 22.5+ (built-in node:sqlite). Older Node throws a clear error.
const { state, saveCreds } = await useSqliteAuthState('./auth.db');

const sock = makeWASocket({ auth: state });
store.bind(sock.ev);
sock.ev.on('creds.update', saveCreds);
```

`useMultiFileAuthState` still works unchanged. `makeCacheManagerAuthState` is available if you prefer a `cache-manager` backend (optional peer dependency).

## Mentions, JIDs and LIDs

WhatsApp now identifies people in two ways, and a bot must handle both.

| Format | Example | Meaning |
|---|---|---|
| PN JID | `6281234567890@s.whatsapp.net` | Phone-number based ID |
| LID | `123456789012345@lid` | Anonymous ID. Groups and chats may show this instead of the number |
| Group | `120363xxxxxxxxxx@g.us` | Group chat |
| Channel | `120363xxxxxxxxxx@newsletter` | WhatsApp Channel |

### Where the real number is

For incoming messages with a LID sender, the real number is attached to the message key:

- Group message: `msg.key.participantAlt`
- Private chat: `msg.key.remoteJidAlt`

### Copy-paste helpers

```js
import {
  jidDecode, jidNormalizedUser, areJidsSameUser,
  isLidUser, isPnUser, isJidGroup, isJidNewsletter,
} from '@rakku/baileys';

// "6281234567890:12@s.whatsapp.net" -> "6281234567890@s.whatsapp.net"
const clean = jidNormalizedUser('6281234567890:12@s.whatsapp.net');

// Is it the same person, even with a device suffix?
areJidsSameUser('6281234567890:12@s.whatsapp.net', '6281234567890@s.whatsapp.net'); // true

// Pull the digits out of a JID
const number = jidDecode('6281234567890@s.whatsapp.net')?.user; // "6281234567890"

// Type checks
isLidUser('123456789012345@lid');            // true
isPnUser('6281234567890@s.whatsapp.net');    // true
isJidGroup('120363xxxxxxxxxx@g.us');         // true

// Get the sender's real number from an incoming message
function getSenderNumber(msg) {
  const raw = msg.key.participant || msg.key.remoteJid;
  const jid = isLidUser(raw) ? (msg.key.participantAlt || msg.key.remoteJidAlt || raw) : raw;
  return jidNormalizedUser(jid);
}
```

Converting between the two forms (uses the library's built-in mapping store):

```js
const lidMapping = sock.signalRepository.lidMapping;

const lid = await lidMapping.getLIDForPN('6281234567890@s.whatsapp.net'); // PN -> LID
const pn  = await lidMapping.getPNForLID('123456789012345@lid');          // LID -> PN
```

### How to write a mention

A mention needs **two parts that match**: the `@number` written in the text, and the same person's JID in the `mentions` array.

```js
// Mention one person
const target = '6281234567890@s.whatsapp.net';
await sock.sendMessage(jid, {
  text: `Hello @${target.split('@')[0]}, welcome!`,
  mentions: [target],
});

// Mention several people
const users = ['6281234567890@s.whatsapp.net', '6289876543210@s.whatsapp.net'];
await sock.sendMessage(jid, {
  text: users.map((u) => `@${u.split('@')[0]}`).join(' ') + ' please check this.',
  mentions: users,
});

// Mention the sender of the message you are replying to
await sock.sendMessage(jid, {
  text: `@${msg.key.participant?.split('@')[0] || msg.key.remoteJid.split('@')[0]} you called?`,
  mentions: [msg.key.participant || msg.key.remoteJid],
}, { quoted: msg });
```

Tag everyone in a group (the `.tagall` pattern):

```js
const meta = await sock.groupMetadata(jid);
const ids = meta.participants.map((p) => p.id);   // LID or PN, whichever this group uses

await sock.sendMessage(jid, {
  text: 'Attention everyone!\n\n' + ids.map((id) => `@${id.split('@')[0]}`).join(' '),
  mentions: ids,
});
```

Group participants have an `id` (a LID or a PN, depending on the group) and, for LID groups, a `phoneNumber` field with the real number. To show or compare real numbers:

```js
const meta = await sock.groupMetadata(jid);
for (const p of meta.participants) {
  const number = (p.phoneNumber || p.id).split('@')[0];
  console.log(number, p.admin ? 'admin' : 'member');
}
```

Mention everyone without listing each JID (the `mentionAll` option):

```js
await sock.sendMessage(jid, { text: '@everyone meeting starts now', mentionAll: true });
```

### Rules of thumb

1. Write `@` followed by the digits in the text, and put the full JID in `mentions`. If they do not match, the text shows as plain text instead of a blue mention.
2. In a group, build the `mentions` array from `groupMetadata` ids, so they use the same format as the group.
3. Never compare raw JIDs from different sources with `===`. Use `areJidsSameUser`, or normalize both with `jidNormalizedUser` first. Device suffixes (`:12`) and LID versus PN will break a plain comparison.
4. When you need the real phone number (owner check, premium list), use `participantAlt` / `remoteJidAlt` or `phoneNumber`, not the LID.

### Noisy console (`Closing session: SessionEntry {...}`)

That text comes from `libsignal`, which prints a session (including key material) whenever an old session is closed. It is normal, but never share those logs. This library hides it by default. To see it again: `makeWASocket({ silenceSignalLogs: false })`.

## Defaults and memory usage

```js
makeWASocket({
  auth: state,
  syncFullHistory: false,           // do not pull full chat history
  enableRecentMessageCache: false,  // do not keep recent messages in RAM
});
```

Both are already the defaults. Override them only if you need history.

## Message flags and stanza handling

`relayMessage` is the original Baileys 7.0.0-rc14 code (`relayMessageCore`, plus a small `recipientFilter` hook). Everything custom sits in a wrapper on top, and `sendMessage`, retries, `richMenu` and `sendA2UI` all go through it.

**Device filters**

```js
await sock.sendMessage(jid, content, { isSecret: true });   // recipient's primary device only
await sock.sendMessage(jid, content, { protected: true });  // recipient primary + your own devices
await sock.sendMessage(jid, content, { me: true });         // your own devices only
```

**Automatic `<biz>` node** for button, list and native-flow messages. It is skipped if you supply your own `biz` node in `additionalNodes`, and for status and newsletter targets. Every native-flow button is checked, and `viewOnce*` wrappers are unwrapped.

| Message / button | Node sent |
|---|---|
| `listMessage` | `<list type="product_list" v="2"/>` |
| `buttonsMessage`, other native-flow | `native_flow` `mixed` |
| `cta_catalog`, `mpm`, `send_location`, `view_catalog`, `wa_pay_detail` | `native_flow` with the matching name |
| `call_request` | `call_permission_request` |
| `review_and_pay`, `review_order`, `payment_info`, `payment_status`, `payment_method` | order / payment node |

`FLOW_NAME` and `ORDER_RESPONSE_NAME` are exported from `lib/WABinary/generic-utils.js`.

**Stanza `type` and `mediatype`** are resolved through every wrapper (`ephemeral`, `viewOnce*`, `documentWithCaption`, `edited`, `groupStatus` / `groupStatusV2`, `groupMentioned`, `botInvoke`, `botForwarded`, `deviceSent`). Upstream reads the raw message, so wrapped images were sent as `type=media` with no `mediatype`, which real clients never do. Added `mediatype` values: `location`, `livelocation`, `ptv`, `sticker_pack`, `group_history`. `type=event` now also covers `encEventResponseMessage` and `secretEncryptedMessage`, and `type=poll` covers `pollCreationMessageV5` / `V6`.

> Stanza shapes are validated by WhatsApp's servers. These follow WhatsApp Web behaviour but were not verified on a live account here, so test on a spare number first.

## Version history

| Version | Changes |
|---|---|
| 10.7.2 | Newer generated `WAProto` (`index.js` + `index.d.ts`). `LIDMigrationMapping` and `BloksWidget` are included. `WAProto.proto` is stale, so **do not run `npm run build:proto`**. |
| 10.7.0 | New `WAProto` with 361 top-level types (was 202), adding bot/AI, key-derivation, backup and consumer-app messages. LID migration types restored from rc14. Removed the `noSelfSync` send option. |
| 10.6.1 | `relayMessage` restored to upstream with a wrapper layer. `<biz>` covers all button types, `listMessage` uses `product_list`. Stanza `type` / `mediatype` resolved through all wrappers. |
| 10.5.2 | `noSelfSync` option (later removed). Image polls send the `polltype="creation"` meta node. Thumbnails now work with jimp 1.x alone. `BAILEYS_IMAGE_LIB=jimp` forces jimp. |
| 10.5.0 | `viewOnceV2` / `viewOnceV2Extension`, `sock.richMenu`, A2UI widgets (`BloksWidget` field 8 added to WAProto). |
| 10.2.0 | Image polls (`generateWAMessageFromImagePoll`, `hashImagePollOption`). |
| 10.1.0 | `lib/Store/*` (in-memory, cache-manager, keyed-db), `useSqliteAuthState`, `isSecret` / `protected` / `me` filters. |
| 10.0.3 | `rich-carousel.js`, `{ full: true }` for profile pictures. |
| 10.0.2 | Restored automatic `<biz>` injection. Without it, buttons and lists were accepted by the server but never displayed. |
| 10.0.1 | `rich-classic.js` (classic buttons and lists, `normalizeUserJid`). |
| 10.0.0 | Rebased on Baileys 7.0.0-rc14. Removed `lib/VoIP/*`, `Modded/message_builder.js`, `Utils/rich-messages.js`, `Socket/dugong.js`, `Utils/sticker-pack.js`. `rejectCall` is still available. `rich-webui.js` replaces the old rich messages. |

Other changes in the 10.x line: `syncFullHistory` and `enableRecentMessageCache` now default to `false`; `protobufjs-cli` pinned to `^1.1.3`; `link-preview-js` pinned to `^5.0.0` (SSRF advisory); the custom Rust Signal engine was dropped in favour of stock `libsignal`.

## Tests

```bash
npm test
```

Covers JID utilities (PN / LID / hosted) and the Rich WebUI build plus proto encode/decode round trip.

## License

MIT for this project's code. Based on the open-source Baileys library (MIT). `libsignal` (GPL-3.0) is a runtime dependency, so check its terms before redistributing.
