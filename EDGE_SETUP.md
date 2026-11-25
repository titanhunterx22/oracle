# ORACLE on Microsoft Edge

ORACLE uses the same Manifest V3 extension package in Microsoft Edge and Google Chrome. You do **not** need a separate Edge build or a different manifest. Edge is Chromium-based and supports the shared extension APIs used by ORACLE.

## Install ORACLE in Edge

1. Download the repository ZIP from [ORACLE on GitHub](https://github.com/titanhunterx22/oracle) using **Code → Download ZIP**.
2. Extract the ZIP to a folder that you will keep in place.
3. In Microsoft Edge, open `edge://extensions`.
4. Turn on **Developer mode**.
5. Select **Load unpacked** and choose the extracted `oracle` folder containing `manifest.json`.
6. Pin ORACLE from the Extensions menu.

If ORACLE was already installed in Edge, replace the files with the updated repository files, open `edge://extensions`, and click **Reload**.

## Enable Edge's optional on-device AI

ORACLE's dictionary, page tools, tab manager, study tools and vault work without the optional language model. Open-ended AI answers require Edge to expose its Prompt API to the extension.

1. Open `edge://settings/ai` and turn **On-device AI** on.
2. For the extension Prompt API preview, use a current **Edge Dev or Canary** build. Open `edge://flags`, search for **Prompt API for on-device language model**, set it to **Enabled**, and restart Edge.
3. Open `edge://on-device-internals` and check **Device performance class** and **Model Status**.
4. In ORACLE, open **Dashboard → Settings → Local AI reasoning** and click **Download & enable local AI**.

Microsoft documents Prompt API access from extension JavaScript in the Edge Dev/Canary preview. Microsoft has also announced an origin trial for the Prompt API on live websites, but that does not guarantee the API is enabled for every extension build or every stable Edge release. If ORACLE reports that the API is unavailable, your Edge build may not expose it to extensions yet. The rest of ORACLE will continue to work.

## Download, privacy and cost

Edge downloads its built-in model when a supported feature first needs it, on eligible devices. The first setup requires an unmetered internet connection. Microsoft currently says to allow approximately **20 GB of free space** on the drive containing the Edge profile; hardware eligibility also applies and requirements can change.

Once downloaded and available, prompts are processed by Edge's on-device model. ORACLE does not send prompts or supplied page text to an ORACLE server or a paid AI API. There is no ORACLE subscription or per-question API charge. The model uses your computer's storage, memory and processor resources.

For Microsoft's current instructions, see [Prompt API for Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api) and [Manage on-device AI models in Edge](https://support.microsoft.com/en-us/edge/manage-on-device-generative-ai-models-with-edge).
