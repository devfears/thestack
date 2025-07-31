# Farcaster Mini Apps - Complete Documentation

> **Source**: https://miniapps.farcaster.xyz/llms-full.txt  
> **Last Updated**: January 2025  
> **Purpose**: Complete reference documentation for developing Farcaster Mini Apps

---

## Table of Contents

1. [Why Farcaster Doesn't Need OAuth 2.0](#why-farcaster-doesnt-need-oauth-20)
2. [Getting Started](#getting-started)
3. [Specification](#specification)
4. [SDK Documentation](#sdk-documentation)
5. [Publishing & Discovery](#publishing--discovery)
6. [Social Sharing](#social-sharing)
7. [Notifications](#notifications)
8. [Wallet Integration](#wallet-integration)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Why Farcaster Doesn't Need OAuth 2.0

OAuth exists to let three separate parties (user → platform → third-party app) establish mutual trust. Farcaster is built on a decentralized architecture that collapses this triangle:

### 1. Identity & Authentication

* **User-owned keys:** A user controlled cryptographic signature proves control of a Farcaster ID—no intermediary.
* **Dev mappings**
  * Sign In with X → Sign-in with Farcaster (SIWF)
  * OAuth 2.0 Authorization Flow → Quick Auth

### 2. Data Access & Permissions

* **Open, replicated data:** Social data like casts, reactions, and profiles live on Snapchain and can be read by anyone.
* **No permission scopes:** Everything is already public; you filter what you need instead of requesting scopes.
* **Zero-cost reads:** Sync the chain yourself or hit a public indexer—no rate caps, no $5k +/month fire-hoses.
* **Cryptographic writes:** Users can delegate a key to applications so the applications can write on their behalf.
* **Dev mappings**
  * Centralized APIs → Snapchain + infra services (e.g. Neynar)
  * Access token → no equivalent, data is public
  * Write permissions → App Keys

### Builder Takeaways

1. **Skip OAuth flows—wallet signature = auth.**
2. **Forget permission scopes—use filters.**
3. **Enjoy building permissionlessly**

### Resources

* [Quick Auth](https://miniapps.farcaster.xyz/docs/sdk/quick-auth)
* [Neynar SDK for one-call Snapchain queries](https://docs.neynar.com/reference/quickstart)
* [App Keys](https://docs.farcaster.xyz/reference/warpcast/signer-requests)

---

## Getting Started

### Overview

Mini apps are web apps built with HTML, CSS, and Javascript that can be discovered and used within Farcaster clients. You can use an SDK to access native Farcaster features, like authentication, sending notifications, and interacting with the user's wallet.

### Requirements

Before getting started, make sure you have:

* **Node.js 22.11.0 or higher** (LTS version recommended)
  * Check your version: `node --version`
  * Download from [nodejs.org](https://nodejs.org/)
* A package manager (npm, pnpm, or yarn)

⚠️ **Warning**: If you encounter installation errors, verify you're using Node.js 22.11.0 or higher. Earlier versions are not supported.

### Enable Developer Mode

Developer mode gives you access to tools for Mini Apps:

1. Make sure you're logged in to Farcaster on either mobile or desktop
2. Click this link: https://farcaster.xyz/~/settings/developer-tools on either mobile or desktop
3. Toggle on "Developer Mode"
4. Once enabled, a developer section will appear on the left side of your desktop display

💡 **Tip**: Developer mode unlocks tools for creating manifests, previewing your mini app, auditing your manifests and embeds, and viewing analytics. We recommend using it on desktop for the best development experience.

### Quick Start

For new projects, you can set up an app using the [@farcaster/create-mini-app](https://github.com/farcasterxyz/miniapps/tree/main/packages/create-mini-app) CLI:

```bash
# npm
npm create @farcaster/mini-app

# pnpm
pnpm create @farcaster/mini-app

# yarn
yarn create @farcaster/mini-app
```

### Manual Setup

For existing projects, install the MiniApp SDK:

#### Package Manager

```bash
# npm
npm install @farcaster/miniapp-sdk

# pnpm
pnpm add @farcaster/miniapp-sdk

# yarn
yarn add @farcaster/miniapp-sdk
```

#### CDN

If you're not using a package manager, you can also use the MiniApp SDK via an ESM-compatible CDN:

```html
<script type="module">
  import { sdk } from 'https://esm.sh/@farcaster/miniapp-sdk'
</script>
```

### Making Your App Display

After your app loads, you must call `sdk.actions.ready()` to hide the splash screen and display your content:

```javascript
import { sdk } from '@farcaster/miniapp-sdk'

// After your app is fully loaded and ready to display
await sdk.actions.ready()
```

⚠️ **Important**: If you don't call `ready()`, users will see an infinite loading screen. This is one of the most common issues when building Mini Apps.

### Troubleshooting

#### Node.js Version Issues

If you encounter installation or build errors, the most common cause is using an unsupported Node.js version.

**Common error messages:**
* `npm ERR! engine Unsupported platform`
* `npm ERR! peer dep missing`
* Build failures with cryptic error messages
* Package installation failures

**Solution:**

1. Check your Node.js version:
   ```bash
   node --version
   ```

2. If you're using Node.js < 22.11.0, update to the latest LTS version:
   * Visit [nodejs.org](https://nodejs.org/) to download the latest LTS
   * Or use a version manager like `nvm`:
     ```bash
     nvm install --lts
     nvm use --lts
     ```

### Building with AI

These docs are LLM friendly so that you use the latest models to build your applications.

1. Use the Ask in ChatGPT buttons available on each page to interact with the documentation
2. Use the [llms-full.txt](https://miniapps.farcaster.xyz/llms-full.txt) to keep your LLM up to date with these docs

### Next Steps

You'll need to do a few more things before distributing your app to users:

1. Publish the app by providing information about who created it and how it should be displayed
2. Make it sharable in feeds

---

## Specification

A Mini App is a web application that renders inside a Farcaster client.

### Mini App Embed

The primary discovery points for Mini Apps are social feeds. Mini App Embeds are an OpenGraph-inspired metadata standard that lets any page in a Mini App be rendered as a rich object that can launch user into an application.

#### Versioning

Mini App Embeds will follow a simple versioning scheme where non-breaking changes can be added to the same version but a breaking change must accompany a version bump.

#### Metatags

A Mini App URL must have a MiniAppEmbed in a serialized form in the `fc:miniapp` meta tag in the HTML `<head>`. For backward compatibility, the `fc:frame` meta tag is also supported. When this URL is rendered in a cast, the image is displayed in a 3:2 ratio with a button underneath. Clicking the button will open a Mini App to the provided action url and use the splash page to animate the transition.

```html
<meta name="fc:miniapp" content="<stringified Embed JSON>" />
<!-- For backward compatibility -->
<meta name="fc:frame" content="<stringified Embed JSON>" />
```

#### Schema

| Property | Type   | Required | Description             | Constraints                                    |
| -------- | ------ | -------- | ----------------------- | ---------------------------------------------- |
| version  | string | Yes      | Version of the embed.   | Must be "1"                                    |
| imageUrl | string | Yes      | Image url for the embed | Max 1024 characters. Must be 3:2 aspect ratio. |
| button   | object | Yes      | Button                  |                                                |

##### Button Schema

| Property | Type   | Required | Description    | Constraints                 |
| -------- | ------ | -------- | -------------- | --------------------------- |
| title    | string | Yes      | Mini App name. | Max length 32 characters    |
| action   | object | Yes      | Action         | Max length 1024 characters. |

##### Action Schema

| Property              | Type   | Required | Description                                                                        | Constraints                                  |
| --------------------- | ------ | -------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| type                  | string | Yes      | The type of action.                                                                | One of: `launch_frame`, `view_token`         |
| url                   | string | No       | App URL to open. If not provided, defaults to full URL used to fetch the document. | Max length 1024 characters.                  |
| name                  | string | No       | Name of the application                                                            | Max length 32 characters                     |
| splashImageUrl        | string | No       | URL of image to show on loading screen.                                            | Max length 1024 characters. Must be 200x200px. |
| splashBackgroundColor | string | No       | Hex color code to use on loading screen.                                           | Hex color code.                              |

##### Example

```json
{
  "version": "1",
  "imageUrl": "https://yoink.party/framesV2/opengraph-image",
  "button": {
    "title": "🚩 Start",
    "action": {
      "type": "launch_frame",
      "name": "Yoink!",
      "url": "https://yoink.party/framesV2",
      "splashImageUrl": "https://yoink.party/logo.png",
      "splashBackgroundColor": "#f5f0ec"
    }
  }
}
```

### App Surface

#### Header

Hosts should render a header above the Mini App that includes the name and author specified in the manifest. Clients should show the header whenever the Mini App is launched.

#### Splash Screen

Hosts should show a splash screen as soon as the app is launched. The icon and background must be specified in the Mini App manifest or embed meta tags. The Mini App can hide the splash screen once loading is complete.

#### Size & Orientation

A Mini App should be rendered in a vertical modal. Mobile Mini App sizes should be dictated by device dimensions while web Mini App sizes should be set to 424x695px.

### SDK

Mini Apps can communicate with their Host using a JavaScript SDK. At this time there is no formal specification for the message passing format, Hosts and Apps should use the open-source NPM packages that can be found in the [farcasterxyz/miniapps](https://github.com/farcasterxyz/miniapps) repo.

This SDK facilitates communication over a `postMessage` channel available in iframes and mobile WebViews.

#### Versioning

The SDK is versioned using [Semantic Versioning](https://semver.org/). A What's New page is maintained to communicate developer impacting changes. A lower level changelog is maintained within the code base to document all changes.

#### API

* **context** - provides information about the context the Mini App is running in

##### Actions

* **addMiniApp** - Prompts the user to add the Mini App
* **close** - Closes the Mini App
* **composeCast** - Prompt the user to cast
* **ready** - Hides the Splash Screen
* **signin** - Prompts the user to Sign In with Farcaster
* **openUrl** - Open an external URL
* **viewProfile** - View a Farcaster profile
* **viewCast** - View a specific cast
* **swapToken** - Prompt the user to swap tokens
* **sendToken** - Prompt the user to send tokens
* **viewToken** - View a token

##### Wallet

* **getEthereumProvider** - EIP-1193 Ethereum Provider
* **getSolanaProvider** - Experimental Solana provider

#### Events

The SDK allows Mini Apps to subscribe to events emitted by the Host.

### Manifest

Mini Apps can publish metadata that allows Farcaster clients to more deeply integrate with their Mini App. This file is published at `/.well-known/farcaster.json` and the Fully Qualified Domain Name where it is hosted uniquely identifies the Mini App. The Manifest contains data that allows Farcaster clients to verify the author of the app, present the Mini App in discovery surfaces like app stores, and allows the Mini App to send notifications.

#### Versioning

Manifests will follow a simple versioning scheme where non-breaking changes can be added to the same version but a breaking change must accompany a version bump.

#### Schema

| Property           | Type   | Required  | Description                                      |
| ------------------ | ------ | --------- | ------------------------------------------------ |
| accountAssociation | object | ✅ **Yes** | Verifies domain ownership to a Farcaster account |
| miniapp (or frame) | object | ✅ **Yes** | Metadata about the Mini App                      |

##### accountAssociation

The account association verifies authorship of this domain to a Farcaster account.

The value is set to the JSON representation of a JSON Farcaster Signature from the account's custody address with the following payload:

```json
{
  "domain": "string"
}
```

The `domain` value must exactly match the FQDN of where it is hosted.

##### Schema

| Property  | Type   | Required | Description               |
| --------- | ------ | -------- | ------------------------- |
| header    | string | Yes      | base64 encoded JFS header |
| payload   | string | Yes      | base64 encoded payload    |
| signature | string | Yes      | base64 encoded signature  |

##### Example

```json
{
  "header": "eyJmaWQiOjM2MjEsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyY2Q4NWEwOTMyNjFmNTkyNzA4MDRBNkVBNjk3Q2VBNENlQkVjYWZFIn0",
  "payload": "eyJkb21haW4iOiJ5b2luay5wYXJ0eSJ9",
  "signature": "MHgwZmJiYWIwODg3YTU2MDFiNDU3MzVkOTQ5MDRjM2Y1NGUxMzVhZTQxOGEzMWQ5ODNhODAzZmZlYWNlZWMyZDYzNWY4ZTFjYWU4M2NhNTAwOTMzM2FmMTc1NDlmMDY2YTVlOWUwNTljNmZiNDUxMzg0Njk1NzBhODNiNjcyZWJjZTFi"
}
```

##### frame

Metadata needed by Hosts to distribute the Mini App.

**Required Fields:**

| Property    | Type   | Required | Description                        | Constraints              |
|-------------|--------|----------|------------------------------------|--------------------------|
| version     | string | Yes      | Version of the miniapp             | Must be "1"              |
| name        | string | Yes      | Name of the miniapp                | Max 32 characters        |
| iconUrl     | string | Yes      | URL of the miniapp icon            | Must be 1024x1024px PNG  |
| homeUrl     | string | Yes      | Default URL to launch              | Max 1024 characters      |

**Optional Fields:**

| Property              | Type   | Description                    | Constraints              |
|-----------------------|--------|--------------------------------|--------------------------|
| imageUrl              | string | URL of the miniapp image       | 3:2 aspect ratio         |
| buttonTitle           | string | Title for the launch button    | Max 32 characters        |
| splashImageUrl        | string | URL of splash screen image     | 200x200px                |
| splashBackgroundColor | string | Splash screen background color | Hex color code           |
| webhookUrl            | string | URL for server events          | Max 1024 characters      |

#### Example

Example of a valid farcaster.json manifest:

```json
{
  "accountAssociation": {
    "header": "eyJmaWQiOjM2MjEsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyY2Q4NWEwOTMyNjFmNTkyNzA4MDRBNkVBNjk3Q2VBNENlQkVjYWZFIn0",
    "payload": "eyJkb21haW4iOiJ5b2luay5wYXJ0eSJ9",
    "signature": "MHgwZmJiYWIwODg3YTU2MDFiNDU3MzVkOTQ5MDRjM2Y1NGUxMzVhZTQxOGEzMWQ5ODNhODAzZmZlYWNlZWMyZDYzNWY4ZTFjYWU4M2NhNTAwOTMzM2FmMTc1NDlmMDY2YTVlOWUwNTljNmZiNDUxMzg0Njk1NzBhODNiNjcyZWJjZTFi"
  },
  "miniapp": {
    "version": "1",
    "name": "Yoink!",
    "iconUrl": "https://yoink.party/logo.png",
    "homeUrl": "https://yoink.party/framesV2/",
    "imageUrl": "https://yoink.party/framesV2/opengraph-image",
    "buttonTitle": "🚩 Start",
    "splashImageUrl": "https://yoink.party/logo.png",
    "splashBackgroundColor": "#f5f0ec",
    "webhookUrl": "https://yoink.party/api/webhook"
  }
}
```

#### Caching

Farcaster clients may cache the manifest for a Mini App but should provide a way for refreshing the manifest file.

---

## Publishing & Discovery

### Adding Mini Apps

Mini Apps can be added to their Farcaster client by users. This enables the user to quickly navigate back to the app and the app to send notifications to the user.

Mini Apps can prompt the user to add the app during an interaction with the `addMiniApp` action. Hosts may also let users add Mini Apps from discovery surfaces like app stores or featured notifications.

Before a user adds a Mini App the Host should display information about the app and a reminder that the app will be able to notify the user.

When a user adds a Mini App the Host must generate the appropriate Server Events and send them to the Mini App's `webhookUrl` if one was provided.

After a user adds a Mini App, the Host should make it easy to find and launch the Mini App by providing a top-level interface where users can browse and open added apps.

### Server Events

The Host server POSTs 4 types of events to the Mini App server at the `webhookUrl` specified in its Mini App manifest:

* `miniapp_added`
* `miniapp_removed`
* `notifications_enabled`
* `notifications_disabled`

The body uses the JSON Farcaster Signature format and are signed with the app key of the user. The final format is:

```json
{
  "header": "string",
  "payload": "string",
  "signature": "string"
}
```

All 3 values are `base64url` encoded. The payload and header can be decoded to JSON, where the payload is different per event.

#### miniapp_added

This event may happen when an open frame calls `actions.addMiniApp` to prompt the user to favorite it, or when the frame is closed and the user adds the frame elsewhere in the client application (e.g. from a catalog).

Adding a frame includes enabling notifications.

The Host server generates a unique `notificationToken` and sends it together with the `notificationUrl` that the frame must call, to both the Host client and the frame server. Client apps must generate unique tokens for each user.

Webhook payload:

```json
{
  "event": "miniapp_added",
  "notificationDetails": {
    "url": "https://api.farcaster.xyz/v1/frame-notifications",
    "token": "a05059ef2415c67b08ecceb539201cbc6"
  }
}
```

#### miniapp_removed

A user can remove a frame, which means that any notification tokens for that fid and client app should be considered invalid:

Webhook payload:

```json
{
  "event": "miniapp_removed"
}
```

#### notifications_disabled

A user can disable frame notifications from e.g. a settings panel in the client app. Any notification tokens for that fid and client app should be considered invalid:

Webhook payload:

```json
{
  "event": "notifications_disabled"
}
```

#### notifications_enabled

A user can enable frame notifications (e.g. after disabling them). The client backend again sends a `notificationUrl` and a `token`, with a backend-only flow:

Webhook payload:

```json
{
  "event": "notifications_enabled",
  "notificationDetails": {
    "url": "https://api.farcaster.xyz/v1/frame-notifications",
    "token": "a05059ef2415c67b08ecceb539201cbc6"
  }
}
```

---

## Social Sharing

Mini Apps can be shared in social feeds using special embeds that let users interact with an app directly from their feed. A Mini App is a web application that renders inside a Farcaster client. The primary discovery points for Mini Apps are social feeds. Mini App Embeds are an OpenGraph-inspired metadata standard that lets any page in a Mini App be rendered as a rich object that can launch user into an application.

### Sharing Process

1. App adds an `fc:miniapp` (and optionally `fc:frame` for backward compatibility) meta tag to a page to make it sharable
2. User copies URL and embeds it in a cast. Farcaster client fetches the URL and attaches the miniapp metadata to the cast
3. Farcaster client injects the cast + embed + attached metadata into thousands of feeds
4. User sees cast in feed with an embed rendered from the attached metadata

### Meta Tag Requirements

A Mini App URL must have a MiniAppEmbed in a serialized form in the `fc:miniapp` meta tag in the HTML `<head>`. For backward compatibility, the `fc:frame` meta tag is also supported.

```html
<meta name="fc:miniapp" content="<stringified Embed JSON>" />
<!-- For backward compatibility -->
<meta name="fc:frame" content="<stringified Embed JSON>" />
```

### Share Extensions

Apps can also receive shared content through share extensions that allow receiving shared casts with context.

---

## Notifications

### Overview

A Mini App server can send notifications to one or more users who have enabled them. The Mini App server is given an authentication token and a URL which they can use to push a notification to the specific Farcaster app that invoked the Mini App. This is private and must be done separately for each Farcaster client that a user may use.

### Sending Notifications

The Mini App server calls the `notificationUrl` with the following JSON body:

**Request Schema:**

| Property       | Type   | Required | Description                           | Constraints         |
|----------------|--------|----------|---------------------------------------|---------------------|
| notificationId | string | Yes      | Unique identifier for notification    | Max 256 characters  |
| title          | string | Yes      | Notification title                    | Max 32 characters   |
| body           | string | Yes      | Notification body text               | Max 128 characters  |
| targetUrl      | string | Yes      | URL to open when notification clicked| Max 1024 characters |
| tokens         | array  | Yes      | Array of user notification tokens     |                     |

**Response Schema:**

The response from the client server must be an HTTP 200 OK with the following JSON body:

| Property | Type   | Description                    |
|----------|--------|--------------------------------|
| result   | string | "success" or error message     |
| details  | object | Additional response details    |

### Notification Details

Once a user has been notified, when clicking the notification the client app will:

* Open `targetUrl`
* Set the context to the notification

### Rate Limits

Host servers should impose rate limits per `token` to prevent intentional or accidental abuse. The recommended rate limits are:

* 1 notification per 30 seconds per `token`
* 100 notifications per day per `token`

### Idempotency

A host MUST deduplicate notification requests using `(FID, notificationId)` as an idempotency key that is valid for 24 hours. This allows Apps to safely retry notification requests.

### User Controls

Hosts should provide controls for the user to toggle their notification settings for their apps:

* Users should be able to navigate to settings for any Mini App they've added and be able to enable or disable notifications from this menu
* Users should be able to disable notifications for a Mini App directly from a notification from that Mini App

---

## Wallet Integration

### Ethereum Support

Mini Apps can access Ethereum wallets through the EIP-1193 Ethereum Provider:

```javascript
import { sdk } from '@farcaster/miniapp-sdk'

// Get Ethereum provider
const provider = await sdk.wallet.getEthereumProvider()

// Use with wagmi or ethers
const accounts = await provider.request({ method: 'eth_accounts' })
```

**Recommendations:**
* Use Wagmi for Ethereum wallet integration
* Provider supports standard EIP-1193 methods

### Solana Support (Experimental)

```javascript
import { sdk } from '@farcaster/miniapp-sdk'

// Get Solana provider (experimental)
const provider = await sdk.solana.getSolanaProvider()
```

**Recommendations:**
* Use Wallet Adapter for Solana integration
* Solana support is experimental and may change

### Low-Level Provider Access

The SDK provides low-level provider access for both Ethereum and Solana wallets, giving developers flexibility in their wallet integrations.

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. Infinite Loading Screen

**Problem:** App shows loading screen forever  
**Cause:** App hasn't called `sdk.actions.ready()`  
**Solution:**

```javascript
import { sdk } from '@farcaster/miniapp-sdk'

// After app is ready to display
await sdk.actions.ready()
```

#### 2. Manifest Not Found (404)

**Problem:** `/.well-known/farcaster.json` returns 404  
**Solutions:**

**Option A: Use Hosted Manifest**
1. Go to https://farcaster.xyz/~/developers/hosted-manifests
2. Create hosted manifest
3. Set up redirect:

```json
{
  "redirects": [
    {
      "source": "/.well-known/farcaster.json",
      "destination": "https://api.farcaster.xyz/miniapps/hosted-manifest/{manifest-id}",
      "permanent": false
    }
  ]
}
```

**Option B: Create Local Manifest**
1. Create file at `/.well-known/farcaster.json`
2. Sign the manifest at developer tools

#### 3. Tunnel URLs Not Working

**Problem:** ngrok/localtunnel URLs don't work in preview  
**Cause:** Browser security blocks unvisited tunnel domains  
**Solution:**

1. Open tunnel URL directly in browser first
2. Then use in preview tool
3. This whitelists the domain for iframe usage

**Important Limitations:**
* SDK actions like `addMiniApp()` will fail with tunnel domains
* Your manifest domain must match your app's hosting domain exactly
* For testing manifest-dependent features, deploy to production domain

#### 4. Invalid Manifest Schema

**Problem:** Manifest doesn't follow correct schema  
**Common Issues:**
* Using `"version": "next"` instead of `"version": "1"`
* Missing required fields (`name`, `iconUrl`, `homeUrl`)
* Icon not 1024x1024px PNG format
* Splash image not 200x200px

**Solution:** Use this template:

```json
{
  "accountAssociation": {
    "header": "...",
    "payload": "...",
    "signature": "..."
  },
  "miniapp": {
    "version": "1",
    "name": "Your App Name",
    "iconUrl": "https://yourdomain.com/icon-1024x1024.png",
    "homeUrl": "https://yourdomain.com",
    "imageUrl": "https://yourdomain.com/preview-3-2-ratio.png",
    "buttonTitle": "Launch App",
    "splashImageUrl": "https://yourdomain.com/splash-200x200.png",
    "splashBackgroundColor": "#ffffff"
  }
}
```

### Validation Commands

#### Check Manifest Accessibility

```bash
curl -s https://{domain}/.well-known/farcaster.json
```

**Expected:** HTTP 200 response with valid JSON

#### Check Embed Tags

```bash
curl -s https://{domain}/{path} | grep -E 'fc:miniapp|fc:frame'
```

**Expected:** Meta tag with valid JSON content

#### Test in Preview Tool

```bash
# Encode your URL
encoded_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('https://example.com/page'))")
echo "https://farcaster.xyz/~/developers/mini-apps/preview?url=$encoded_url"
```

### Asset Requirements

| Asset Type    | Dimensions | Format | Usage                    |
|---------------|------------|--------|--------------------------|
| App Icon      | 1024x1024  | PNG    | App listings, manifest   |
| Splash Image  | 200x200    | PNG    | Loading screen           |
| Preview Image | 3:2 ratio  | PNG/JPG| Social sharing, embeds   |

### Best Practices

1. **Always call `sdk.actions.ready()`** after your app loads
2. **Test locally with tunnels** but deploy to production domain for full testing
3. **Use proper asset dimensions** - incorrect sizes will cause issues
4. **Sign your manifest** - unsigned manifests won't work
5. **Match domains exactly** - manifest domain must match hosting domain
6. **Handle errors gracefully** - SDK calls can fail, always handle errors

---

## Additional Resources

### Official Links

* [Mini Apps Documentation](https://miniapps.farcaster.xyz/)
* [GitHub Repository](https://github.com/farcasterxyz/miniapps)
* [Farcaster Protocol Docs](https://docs.farcaster.xyz/)
* [Developer Tools](https://farcaster.xyz/~/settings/developer-tools)

### Community & Support

* Reach out to Farcaster team (@pirosb3, @linda, @deodad) on Farcaster for support
* Use the preview tool for testing: `https://farcaster.xyz/~/developers/mini-apps/preview`
* Join developer discussions in Farcaster channels

### Integration Examples

* [Neynar SDK](https://docs.neynar.com/reference/quickstart) for Snapchain queries
* [App Keys](https://docs.farcaster.xyz/reference/warpcast/signer-requests) for write permissions
* [Quick Auth](https://miniapps.farcaster.xyz/docs/sdk/quick-auth) for authentication

---

> **Last Updated:** January 2025  
> **Version:** Based on SDK version with semantic versioning  
> **Source:** https://miniapps.farcaster.xyz/llms-full.txt