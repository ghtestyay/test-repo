// @ts-ignore
import { STR } from "./strings.ts";

if (top !== self) {
    try { top.location.replace(self.location.href); } catch (e) {}
    document.body.innerHTML = `<a href="${location.href}" target="_top">${STR.appName}</a>`
    throw new Error("throwing error to prevent code exec when framed");
}

const taglogicPromise = require("./pkg/taglogic");
// @ts-ignore
import App from "./components/App.svelte";
// @ts-ignore
import onSecond from "./onSecond.ts";
// @ts-ignore
import "./init-db.ts";
// @ts-ignore
import { latestPing } from "./pings.ts";
// @ts-ignore
import { beemLoadCheck } from "./beem.ts";
// @ts-ignore
import "./autoplay.ts";
// @ts-ignore
import { registerSw } from "./register-sw.ts";

declare global {
    interface Window {
        pintData: any,
        db: any,
        taglogic: any,
        recheckPending: any,
        pingsPending: Uint32Array,
        loginState: "in" | "local" | "out",
        supportsAutoplay: Promise<boolean>,
        lastTag: any,
        miniData: any,
    }
}

window.lastTag = null;

if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", e => {
        if (e.data.id === "tag-focus") {
            window.focus();
            const entryEle = (document.querySelector(".tag-entry-root input") as HTMLInputElement);
            if (entryEle !== null) entryEle.focus();
        }
    });
}

// @ts-ignore
import { checkLoginStateOnInit } from "./sync.ts"; // has to be imported after DB is setup
window.recheckPending = () => {}; // ignore calls to recheck pending until ping checking is setup
(async () => {
    if (location.search === "?prolongLoading") await new Promise(resolve => setTimeout(resolve, 3000));

    beemLoadCheck(); // async, but start it now (usually does nothing)

    window.pingsPending = new Uint32Array([]);
    let username = null;
    if (localStorage["retag-auth"] === "local") {
        window.loginState = "local";
    } else {
        const loginCheck = await checkLoginStateOnInit();
        window.loginState = loginCheck.status;
        localStorage["retag-auth"] = loginCheck.status;
        username = loginCheck.username;
    }

    // This is below the checkLoginStateOnInit so it can start on putting pings in the DB while the WASM loads
    const taglogic = await taglogicPromise;
    taglogic.init();
    window.taglogic = taglogic;
    let algBoolValue;
    switch (localStorage["retag-pint-alg"]) {
        case "fnv":
        case undefined:
        case null:
        case "":
            algBoolValue = false;
            break;
        case "tagtime":
            algBoolValue = true;
            break;
        default:
            alert("Unsupported interval algorithm. Try reloading. If that doesn't work, try clearing your cache or filing a bug report at https://github.com/smittyvb/ttw/issues.");
    }
    window.pintData = taglogic.new_ping_interval_data(
        localStorage["retag-pint-seed"] ? parseInt(localStorage["retag-pint-seed"], 10) : 12345,
        localStorage["retag-pint-interval"] ? parseInt(localStorage["retag-pint-interval"], 10) : (60 * 45),
        // fnv - false
        // tagtime - true
        algBoolValue,
    );

    const app = new App({
        target: document.body,
        props: {
            username,
            // @ts-ignore
            buildInfo: __BUILD_INFO__,
        },
    });

    async function pendingPings(): Promise<{ pending: Uint32Array, lastTag: any }> {
        const lastTag = await latestPing();
        // no tags yet, causes weird behavior for first ping
        if (lastTag === undefined) return {
            lastTag: null,
            pending: new Uint32Array([Math.floor(Date.now() / 1000)])
        };
        const startTime = lastTag.time + 1;
        const endTime = Math.floor(Date.now() / 1000);
        if (startTime >= endTime) return {
            lastTag,
            pending: new Uint32Array([]),
        }
        return {
            pending: taglogic.pings_between_u32(startTime, endTime, window.pintData),
            lastTag,
        };
    }

    window.recheckPending = () => checkPings(true);

    function closeOnNotifClick() {
        console.log("Notification clicked");
        this.close();
        window.focus();
        (document.querySelector(".tag-entry-root input") as HTMLInputElement).focus();
    }

    let lastNotifiedPing: number = null;
    let initialCheck = true;
    let scheduledCheckTime = null;
    async function checkPings(force: boolean) {
        const { pending, lastTag } = await pendingPings();
        if (pending.length > 0 || force) {
            scheduledCheckTime = null;
            let latest = pending[pending.length - 1];
            if (latest === undefined) {
                latest = taglogic.last_ping_u32(Math.floor(Date.now() / 1000), window.pintData);
            }
            const event = new CustomEvent("pingUpdate");
            (event as any).lastPing = latest;
            (event as any).pending = pending;
            (event as any).lastTag = lastTag;
            window.lastTag = lastTag;
            window.dispatchEvent(event);
            if (latest !== lastNotifiedPing) {
                // if we're offline then we won't be getting a notification from the server, so create a ping locally
                if (!initialCheck && (localStorage["retag-notifs"] === "1") && (!navigator.onLine) && window.Notification) {
                    const notif = new Notification(`Ping! ${new Date(latest * 1000).toLocaleTimeString().split(" ")[0]}`, {
                        lang: "en",
                        renotify: true,
                        tag: "retag-ping",
                    });
                    notif.onclick = closeOnNotifClick;
                }
                if (!initialCheck && navigator.vibrate) {
                    navigator.vibrate(1000);
                }
                if (localStorage["retag-audio"] === undefined) {
                    localStorage["retag-audio"] = "n";
                }
                if (localStorage["retag-audio"] !== "n" && !initialCheck) {
                    const ele =
                        document.getElementById(`audio-${localStorage["retag-audio"]}`) as HTMLMediaElement;
                    if (ele) {
                        ele.play().catch(e => { });
                    }
                }
                lastNotifiedPing = latest;
            }
        }
        if (scheduledCheckTime === null) {
            const nextPing = taglogic.next_ping_after_u32(Math.floor(Date.now() / 1000), window.pintData);
            onSecond(nextPing * 1000, () => checkPings(false));
            scheduledCheckTime = nextPing;
        }
        window.pingsPending = pending;
        initialCheck = false;
    }
    if (window.loginState !== "out") checkPings(true);

    await db.keyVal.bulkPut([
        { key: "seed", value: window.pintData.seed },
        { key: "avgInterval", value: window.pintData.avg_interval },
        { key: "alg", value: window.pintData.alg },
    ]);
    await registerSw();
})();
