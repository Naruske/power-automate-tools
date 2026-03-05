import { Actions } from "./common/types/backgroundActions";
import jwtDecode from "jwt-decode";

interface State {
  token?: string;
  url?: URL;
  initiatorTabId?: number;
  appTabId?: number;
  apiUrl?: string;
  tokenExpires?: Date;
  lastMatchedRequest?: { envId: string; flowId: string } | null;
}

const state: State = {};

chrome.action.disable();

chrome.action.onClicked.addListener((tab) => {
  if (!state.lastMatchedRequest) {
    return;
  }

  chrome.tabs.create(
    {
      url: `${chrome.runtime.getURL("app.html")}?envId=${state.lastMatchedRequest.envId
        }&flowId=${state.lastMatchedRequest.flowId}`,
    },
    (appTab) => {
      state.appTabId = appTab.id;
    }
  );
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.appTabId === tabId) {
    delete state.appTabId;
  }
  // If the initiator tab (the flow edit page) is closed, reset state.
  if (state.initiatorTabId === tabId) {
    resetFlowState();
  }
});

// Aggressively set flow state whenever a tab navigates to a flow page.
// The new designer uses Service Workers (-1 tabId) for requests, so we
// cannot reliably link network requests to the UI tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url) {
    const matched = extractFlowDataFromTabUrl(tab.url);
    if (matched) {
      state.lastMatchedRequest = matched;
      state.initiatorTabId = tabId;
      chrome.action.enable();
    } else if (tabId === state.initiatorTabId) {
      resetFlowState();
    }
  }
});

// The classic designer uses *.api.flow.microsoft.com.
// The new designer (make.powerautomate.com) uses:
//   - api.flow.microsoft.com (global, no subdomain) for environment metadata
//   - *.api.flow.microsoft.com (regional) for classic flow operations
//   - *.environment.api.powerplatform.com (primary new designer flow API)
chrome.webRequest.onBeforeSendHeaders.addListener(
  listenFlowApiRequests,
  {
    urls: [
      "https://api.flow.microsoft.com/*",
      "https://*.api.flow.microsoft.com/*",
      "https://*.api.powerautomate.com/*",
      "https://api.powerautomate.com/*",
      "https://*.environment.api.powerplatform.com/*",
    ],
  },
  ["requestHeaders"]
);

chrome.runtime.onMessage.addListener(
  (action: Actions, sender, sendResponse) => {
    if (sender.tab?.id === state.appTabId) {
      switch (action.type) {
        default:
          sendResponse();
          break;
        case "app-loaded":
          sendResponse();
          sendTokenChanged();
          break;
        case "refresh":
          sendResponse();
          refreshInitiator();
          break;
      }
    }
  }
);

function resetFlowState() {
  state.lastMatchedRequest = null;
  delete state.initiatorTabId;
  chrome.action.disable();
}

function sendTokenChanged() {
  sendMessageToTab({
    type: "token-changed",
    token: state.token!,
    apiUrl: state.apiUrl!,
  });
}

function refreshInitiator() {
  if (state.initiatorTabId) {
    chrome.tabs.reload(state.initiatorTabId);
  }
}

function listenFlowApiRequests(
  details: chrome.webRequest.WebRequestHeadersDetails
) {
  // Only intercept requests directed to classic Flow hosts.
  // The new designers use powerplatform.com domains internally, but those
  // tokens have an incompatible audience for the providers/Microsoft.ProcessSimple/ API.
  // Fortunately, the new designer still makes environment queries to api.flow.microsoft.com,
  // which yields the correct token for our purposes!
  const requestHostname = new URL(details.url).hostname;
  const isClassicHost =
    requestHostname.includes("api.flow.microsoft.com") ||
    requestHostname.includes("api.powerautomate.com");

  if (!isClassicHost) {
    return;
  }

  // We no longer rely on details.tabId to extract the flow data,
  // because service worker requests have tabId === -1. Instead, we
  // rely on chrome.tabs.onUpdated mapping the active tab URL.

  const token = details.requestHeaders?.find(
    (x) => x.name.toLowerCase() === "authorization"
  )?.value;

  let apiUrlChanged = false;
  let tokenChanged = false;

  const newApiUrl = `https://${requestHostname}/`;
  if (state.apiUrl !== newApiUrl) {
    state.apiUrl = newApiUrl;
    apiUrlChanged = true;
  }

  if (token && state.token !== token) {
    state.token = token;
    tokenChanged = true;
    try {
      const decodedToken = jwtDecode(token);
      state.tokenExpires = new Date((decodedToken as any).exp * 1000);
    } catch {
      // ignore token decode failure
    }
  }

  if ((tokenChanged || apiUrlChanged) && state.token && state.apiUrl) {
    sendTokenChanged();
  }
}

function tryExtractFlowDataFromTabUrl(tabId: number) {
  chrome.tabs.get(tabId, (tab) => {
    state.lastMatchedRequest = extractFlowDataFromTabUrl(tab.url);

    if (state.lastMatchedRequest) {
      state.initiatorTabId = tabId;
      chrome.action.enable();
    }
  });
}

function sendMessageToTab(action: Actions) {
  if (state.appTabId) {
    chrome.tabs.sendMessage(state.appTabId!, action);
  }
}

function extractFlowDataFromTabUrl(url?: string) {
  if (!url) {
    return null;
  }

  // The new designer uses hash routing, e.g.:
  // https://make.powerautomate.com/environments/{envId}/flows/{flowId}?v3=true
  // The classic designer uses a similar pathname pattern on flow.microsoft.com.
  // Normalise by combining pathname + hash so we cover both cases.
  let searchTarget = url;
  try {
    const parsed = new URL(url);
    // If the router puts env/flow info into the hash (e.g. #!/environments/…)
    searchTarget = parsed.pathname + parsed.hash + parsed.search;
  } catch {
    // fall through with the raw url
  }

  const envPattern = /environments\/([a-zA-Z0-9\-_%]+)(?:\/|$)/i;
  const envResult = envPattern.exec(searchTarget);

  if (!envResult) {
    return null;
  }

  const flowPattern =
    /flows\/(?:shared\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const flowResult = flowPattern.exec(searchTarget);

  if (!flowResult) {
    return null;
  }

  return {
    envId: decodeURIComponent(envResult[1]),
    flowId: flowResult[1],
  };
}

function extractFlowDataFromUrl(
  details: chrome.webRequest.WebRequestHeadersDetails
) {
  const requestUrl = details.url;
  if (!requestUrl) {
    return null;
  }

  // Legacy classic extraction logic just in case the legacy path appears
  const classicPattern =
    /\/providers\/Microsoft\.ProcessSimple\/environments\/(.*)\/flows\/(?:shared\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  const classicResult = classicPattern.exec(requestUrl);
  if (classicResult) {
    return {
      envId: classicResult[1],
      flowId: classicResult[2],
    };
  }

  return null;
}
