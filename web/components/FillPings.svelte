<script>
    import TaggingHelp from "./TaggingHelp.svelte";
    import TagEntry from "./TagEntry.svelte";
    import LastPingInfo from "./LastPingInfo.svelte";
    import { updateTagIndexWithPings } from "../tagIndex.ts";
    import { afterUpdate } from "svelte";
    import { putPings } from "../pings.ts";
    import { STR } from "../strings.ts";

    let allPingInputs;
    let onePingTags = [];
    let setTagsBtn;
    let lastPingTags = window.lastTag ? window.lastTag.tags : [];
    let pending = window.pingsPending;
    export let anyPending = false;
    $: anyPending = pending.length > 0;
    let afkTags = (localStorage["retag-afk-tags"] || "afk").split(" ");
    if (afkTags.length === 1 && afkTags[0] === "") afkTags = [];

    afterUpdate(() => {
        if (onePingTags.length > 0 && pending.length > 1) {
            // going from 1 to >1
            const firstEle = document.querySelector(`.ping-input-root [pingtime='${pending[0]}'] .tag-entry-root`);
            if (firstEle !== null) {
                firstEle.setTags(onePingTags);
                onePingTags = [];
            }
        }
        if (pending.length > 1) {
            updateDefault();
        } else {
            defaultTags = afkTags;
        }
    });

    function pingUpdate(e) {
        lastPingTags = e.lastTag ? e.lastTag.tags : [];
        pending = e.pending;
        disableSetting = false;
    }

    const taint = i => e => {
        allPingInputs.children[i].tainted = true;
    }
    let disableSetting = false;
    function setTags() {
        disableSetting = true;
        let tagsData;
        if (pending.length === 1) {
            tagsData = [{
                tags: onePingTags,
            }];
        } else {
            tagsData = [...allPingInputs.children].map(child => ({
                tags: child.children[0].tags,
            }));
        }
        updateTagIndexWithPings(tagsData); // don't wait for it to complete
        const pings = [];
        tagsData.forEach(({ tags }, i) => {
            pings.push({
                time: pending[i],
                tags: tags || [],
                category: null,
                interval: window.pintData.avg_interval,
                comment: null,
            });
        });
        putPings(pings); // don't wait for it to complete
        window.pingsPending = [];
        pending = [];
        onePingTags = [];
    }
    let defaultTags = afkTags;
    function updateDefault() {
        [...allPingInputs.children].forEach(child => {
            if (!child.tainted) {
                child.children[0].setTags(defaultTags);
            }
        });
    }
    const multiInputComplete = i => e => {
        if (allPingInputs.children[i + 1]) {
            allPingInputs.children[i + 1].children[0].focusInner();
        } else {
            setTagsBtn.focus();
        }
    }
    function defaultPingComplete(e) {
        if (allPingInputs.children[0]) allPingInputs.children[0].children[0].focusInner();
    }
    let singleEle;
    function insertSingle(tags) {
        singleEle.setTags([...new Set(onePingTags.concat(tags))]);
        singleEle.focusRest();
    }
    let defaultEle;
    function insertDefault(tags) {
        defaultEle.setTags([...new Set(defaultTags.concat(tags))]);
        defaultEle.focusRest();
    }
    $: document.title = (pending.length > 0 ? "*** " : "") + STR.appName;
</script>

<style>
    h2 {
        margin: 0;
    }
    .ping-input-root {
        background: rgb(245, 214, 112);
        padding: 8px;
        margin-bottom: 1rem;
        width: 100%;
        box-sizing: border-box;
    }
    :global(.dark) .ping-input-root {
        background: rgb(138, 121, 0);
    }
    .ping-time {
        font-weight: bold;
    }
    .default-entry {
        margin-bottom: 1rem;
    }
    .default-entry-about {
        font-weight: bold;
    }
</style>

<svelte:window on:pingUpdate={pingUpdate} />

{#if pending.length > 0}
    <div class="ping-input-root">
        <h2>Ping!</h2>
        {#if pending.length === 1}
            It&rsquo;s tag time! What were you doing at
            <span class="ping-time">{new Date(pending[0] * 1000).toLocaleTimeString()}</span>?
            <LastPingInfo {lastPingTags} insertTags={insertSingle} />
            <TaggingHelp />
            <TagEntry lastTags={lastPingTags} bind:this={singleEle} bind:tags={onePingTags} on:inputComplete={setTags} class="ping-input one-ping" autofocus />
        {:else if pending.length > 0}
            There are multiple pings pending.
            <LastPingInfo {lastPingTags} insertTags={insertDefault} />
            <TaggingHelp />
            <div class="default-entry">
                <span class="default-entry-about">Default ping entry:</span>
                <TagEntry lastTags={lastPingTags} bind:this={defaultEle} bind:tags={defaultTags} class="ping-input" on:inputComplete={defaultPingComplete} on:input={updateDefault} />
            </div>
            <div bind:this={allPingInputs} class="all-ping-inputs">
                {#each pending as pingTime, i}
                    <div pingTime={pingTime}>
                        {new Date(pingTime * 1000).toLocaleString()}:
                        <TagEntry lastTags={lastPingTags} tainted={false} on:input={taint(i)} on:inputComplete={multiInputComplete(i)} class="ping-input multi-ping" value={afkTags} />
                    </div>
                {/each}
            </div>
        {/if}
        <div>
            <button bind:this={setTagsBtn} on:click={setTags} disabled={disableSetting}>
                Set tags
            </button>
        </div>
    </div>
{/if}
