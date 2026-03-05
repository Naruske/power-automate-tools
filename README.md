![Extension Logo](public/icons/pa-tools-128.png)

# Power Automate Tools (New Designer Support)

![Extension Screen Shot](static/pa-tools-extension.jpg)

This is a **fork** of the excellent [Power Automate Tools extension by Kamil Rithaler](https://github.com/kamilrithaler/PowerAutomateTools), updated specifically restore compatibility with the **v3 New Designer** (`make.powerautomate.com`). 

> **Note:** The updates in this fork, including compatibility fixes for the New Designer and the restoration of key functionalities, were actively developed and implemented using AI coding tools.

The Chrome/Edge extension enables editing a Power Automate flow definition as JSON directly from your browser.

## Motivation

The reason behind creating this extension is constantly struggling with repetitive tasks in the flow authoring workflow like replacing a SharePoint site's URL or changing the variable name. The original extension stopped working when Microsoft rolled out the "New Designer" architecture, so this fork was created to get it working again!

## Features

- **(NEW)** Full support for the v3 Power Automate New Designer!
- **(NEW)** Works on shared flows and hybrid API environments.
- Edit a Power Automate flow as JSON in your browser.
- Workflow definition JSON schema validation.
- Rich text manipulation features thanks to [Monaco Editor (VS Code)](https://microsoft.github.io/monaco-editor/).
- Validating actions using "Flow Checker".

## Installation (Manual)

Since this is a community fork, you can install it manually in Developer Mode:

1. Download the latest `Power_Automate_Tools_New_Designer_Support_v1.3.zip` from the Releases tab (or build it yourself).
2. Extract the ZIP file into a folder on your computer.
3. Open your browser's extension page:
   - Edge: Navigate to `edge://extensions`
   - Chrome: Navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle switch usually in the bottom left or top right).
5. Click **Load unpacked** and select the folder where you extracted the ZIP.
6. Open any flow in Power Automate and click the extension icon to edit the JSON!

## How to Build from Source

If you want to build the extension yourself:

```bash
# Install dependencies
npm install

# Build the extension for production
npm run build

# The output will be inside the /dist folder. 
# You can load this folder directly as an "unpacked extension".
```

## Change Log

### v1.3.0 (New Designer Fork)
- Fixed authentication interception for the New Designer's `environment.api.powerplatform.com` hybrid architecture.
- Added support for the global `api.flow.microsoft.com` REST endpoint.
- Aggressive background state tracking via `chrome.tabs.onUpdated` to bypass Service Worker interception limitations.
- Restored functionality for shared flows.

### v1.2
- Fixed the issue of saving a flow.
- Support for launching from the new Power Automate designer.
- Improved launching from the Power Apps Portal.
- Now the editor allows to edit the flow definition and connection references.

## Known limitations

- The authentication token is not refreshed automatically at this moment. Sometimes might be necessary to refresh the flow page (F5) that was used to open the extension to capture a fresh token.
