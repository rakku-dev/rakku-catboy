import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { attachBotHelpers } from '../Utils/bot-helpers.js';
import { createAnchorGuard } from '../Utils/anchor-guard.js';
// Rakku: libsignal mencetak isi sesi (termasuk kunci privat) ke console tiap sesi lama ditutup.
// Noise ini disaring. Matikan dengan config `silenceSignalLogs: false`.
const SIGNAL_NOISE = /^(Closing session|Closing open session|Opening session|Removing old closed session|Session already (closed|open)|Migrating session)/;
let signalLogsFiltered = false;
const filterSignalLogs = () => {
    if (signalLogsFiltered) return;
    signalLogsFiltered = true;
    for (const level of ['log', 'info', 'warn']) {
        const original = console[level].bind(console);
        console[level] = (...args) => {
            if (typeof args[0] === 'string' && SIGNAL_NOISE.test(args[0])) return;
            original(...args);
        };
    }
};
// export the last socket layer
const makeWASocket = (config) => {
    const { AnchorGuard, AnchorGuardConfig, silenceSignalLogs = true, ...rest } = config || {};
    if (silenceSignalLogs) filterSignalLogs();
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...rest
    };
    const sock = makeCommunitiesSocket(newConfig);
    if (AnchorGuard) {
        sock.anchorGuard = createAnchorGuard(sock, AnchorGuardConfig || {});
    }
    const RAKKU_NEWSLETTER_JID = '120363421453095412@newsletter';
    attachBotHelpers(sock);
    // Rakku: auto-follow channel once the session is connected
    let followed = false;
    sock.ev.on('connection.update', ({ connection }) => {
        if (connection !== 'open' || followed) return;
        followed = true;
        setTimeout(async () => {
            try {
                await sock.newsletterFollow(RAKKU_NEWSLETTER_JID);
            }
            catch (e) {
                // already following / temporary error: ignore
            }
        }, 5000);
    });
    return sock;
};
export default makeWASocket;
//# sourceMappingURL=index.js.map