# TrakAI native mobile architecture

## Decision

Use **two separate Capacitor projects**:

- `artifacts/trak-client-mobile` → iOS bundle `com.trakai.client`
- `artifacts/trak-coach-mobile` → iOS bundle `com.trakai.coach`

Each project bundles the corresponding React application directly into its own
WKWebView package. The native projects do not iframe the web artifacts and do
not point Capacitor's `server.url` at a remotely hosted website.

## Why two projects

Coach and client are distinct products with different:

- authenticated roles and permitted API data;
- App Store listings and release cadence;
- bundle identifiers, Keychain namespaces, push entitlements, and APNs topics;
- notification destinations and deep-link routes;
- logout/session boundaries.

A single binary with a role switch would make it easier to leak role state,
route a notification into the wrong product, or share credentials accidentally.
The small amount of shared bridge code is safer to duplicate behind the same
interface than the native identity boundary is to combine.

## How existing UI is reused

The mobile Vite entry points import the corresponding coach/client React app
source directly. This keeps one implementation of each product surface while
producing separate mobile bundles:

- client mobile bundles `artifacts/trak-client/src`;
- coach mobile bundles `artifacts/trak-coach/src`.

Web builds continue to use their current entry points, cookie sessions,
service workers, and artifact base paths. Native builds initialize a Capacitor
bridge before React renders. The bridge:

1. rewrites same-origin `/api/*` requests to the configured public API origin;
2. exchanges login credentials through `/api/auth/token/login`;
3. stores the rotating refresh credential in iOS Keychain-backed secure
   storage;
4. attaches access tokens, refreshes once after an authentication failure, and
   clears/revokes credentials on logout;
5. registers APNs device tokens with the authenticated actor;
6. maps notification taps and app URLs to the appropriate in-app route.

## Push model

Browser Web Push remains available to the web artifacts. Native APNs tokens
are stored separately because a Web Push endpoint/key tuple and an APNs device
token are different credential types.

The server derives token ownership from the bearer session. It never accepts a
coach/client identity supplied by the device. Notification payloads carry a
stable route and event type; the client and coach shells independently map
those values to their own route space.

## Deep links

- Client custom scheme: `trakai-client://`
- Coach custom scheme: `trakai-coach://`

Both bridges also understand HTTPS URLs whose path matches their route space,
so universal-link routing can use the same code once an Associated Domains
entitlement and production domain are finalized.

## Constraints and judgment calls

- The repository runs on Linux, so it can generate/sync the iOS projects and
  validate TypeScript, web bundles, and native configuration, but it cannot run
  Xcode, an iOS Simulator, codesigning, or an archive build.
- Production APNs delivery requires Apple Team/Key configuration and push
  entitlements. Signing certificates and production push credentials are
  explicitly outside this task. The server therefore enables APNs delivery
  only when its APNs environment variables are configured. Set
  `APNS_ENVIRONMENT=sandbox` for Debug device tokens; Release delivery defaults
  to Apple's production APNs host.
- The API permits the fixed iOS WebView origin `capacitor://localhost` for CORS
  so native bearer requests can preflight. It is deliberately not trusted for
  cookie-authenticated mutations.
- Android source generation is not required. Shared TypeScript deliberately
  keeps platform checks generic so Android can be added later without changing
  the authentication protocol.
- The chosen secure-storage plugin must support the selected Capacitor major
  version and use iOS Keychain. If package compatibility cannot be confirmed,
  implementation must stop rather than fall back to Preferences/localStorage.