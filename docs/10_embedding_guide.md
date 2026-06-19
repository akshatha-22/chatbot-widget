# Embedding Remi on Any Website

Drop the Remi chat widget into **any** site — plain HTML, WordPress, Webflow, Wix, or a React app — without requiring the host to run Vite or import your monorepo.

**Status:** **Shipped** — [`remi-widget@1.0.0`](https://www.npmjs.com/package/remi-widget) published on npm; served globally via jsDelivr and unpkg.  
**Build output:** `client/dist-lib/remi-widget.js` (single self-contained IIFE with React + CSS injected).

---

## CDN Hosting via jsDelivr (production)

`remi-widget.js` is served by [jsDelivr](https://www.jsdelivr.com/package/npm/remi-widget)'s global CDN at no cost.

### Pinned version (recommended for production)

```html
<script>
  window.RemiConfig = {
    apiUrl: "https://your-backend.up.railway.app",
    primaryColor: "#2979FF"
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/remi-widget@1.0.0/dist-lib/remi-widget.js"></script>
```

### Latest version (demos and docs only)

```html
<script src="https://cdn.jsdelivr.net/npm/remi-widget@latest/dist-lib/remi-widget.js"></script>
```

**Always pin a specific version (`@1.0.0`) in production integrations.** Using `@latest` means a breaking change in a future release affects every site embedding the widget immediately, with no opportunity to test first.

### Alternative CDN — unpkg

```html
<script src="https://unpkg.com/remi-widget@1.0.0/dist-lib/remi-widget.js"></script>
```

### Subresource Integrity (optional, for security-conscious integrators)

Generate an SRI hash after each publish at [jsDelivr package page](https://www.jsdelivr.com/package/npm/remi-widget) and provide it alongside the script tag:

```html
<script
  src="https://cdn.jsdelivr.net/npm/remi-widget@1.0.0/dist-lib/remi-widget.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

Enable backend CORS for arbitrary embed origins:

```env
CORS_ALLOW_ANY_ORIGIN=true
```

JWT auth uses the `Authorization` header (not cookies), so wildcard CORS with `allow_credentials=false` is safe.

---

## Quick start — self-hosted bundle

If you prefer not to use the npm CDN:

1. Build the embed bundle:

```bash
cd client
npm run build:lib
```

2. Host `dist-lib/remi-widget.js` on your own CDN or static file server.

3. On the host page:

```html
<script>
  window.RemiConfig = {
    apiUrl: "https://your-backend.up.railway.app",
    primaryColor: "#2979FF",
    position: "bottom-right"
  };
</script>
<script src="https://your-cdn.com/remi-widget.js"></script>
```

---

## Configuration (`window.RemiConfig`)

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `apiUrl` | **Yes** | — | Backend origin, e.g. `https://api.example.com` (no trailing slash) |
| `primaryColor` | No | `#2979FF` | Accent color (`--remi-accent` CSS variable) |
| `position` | No | `bottom-right` | `bottom-right` or `bottom-left` |
| `containerId` | No | `remi-widget-mount` | Outer mount element `id` |

---

## WordPress / Webflow / Wix

Paste the jsDelivr script blocks (or self-hosted equivalent) into:

- **WordPress:** Appearance → Theme File Editor → footer, or a “Custom HTML” block / plugin
- **Webflow:** Project Settings → Custom Code → Footer
- **Wix:** Settings → Custom Code → Body end

Set `apiUrl` to your Railway (or other) API URL.

---

## Manual mount control

Skip auto-mount and call the API when you want:

```html
<script
  src="https://cdn.jsdelivr.net/npm/remi-widget@1.0.0/dist-lib/remi-widget.js"
  data-manual-mount="true"
></script>
<script>
  document.getElementById("open-chat").addEventListener("click", () => {
    window.RemiWidget.mount({
      apiUrl: "https://your-backend.up.railway.app",
    });
  });
</script>
```

### API

```javascript
window.RemiWidget.mount(config?)  // mount once
window.RemiWidget.unmount()       // remove widget
window.RemiWidget.isMounted()     // boolean
```

---

## React apps (monorepo / npm path)

The existing dev app path is unchanged:

```tsx
import ChatbotWidget from './components/ChatbotWidget/FloatingWidget'
import { initApiFromEnv } from './api/config'

initApiFromEnv() // reads VITE_API_URL in Vite builds

export default function App() {
  return (
    <ChatbotWidget
      apiUrl="https://your-backend.up.railway.app"
      primaryColor="#2979FF"
      position="bottom-right"
    />
  )
}
```

Or pass only `apiUrl` when `VITE_API_URL` is set at build time.

---

## Local demo

```bash
cd client
npm run build:lib
npx vite preview --outDir dist-lib --port 4174
```

Open `embed-demo.html` and point the script `src` at `http://127.0.0.1:4174/remi-widget.js`.

---

## Publishing a new version

1. Update `version` in `client/package.json` (follow semver — patch/minor/major).
2. Run `npm run verify-publish` from `client/` (or `bash scripts/verify-publish.sh`) and review the `npm pack --dry-run` file list — only `dist-lib/` should appear.
3. Run `npm publish` from inside `client/`.
4. Confirm the new version is live:  
   `https://cdn.jsdelivr.net/npm/remi-widget@<new-version>/dist-lib/remi-widget.js`  
   (jsDelivr may take a few minutes to pick up a fresh publish.)
5. Update pinned version references in this guide and on any demo/portfolio sites.

**Publish checklist (new versions):**

```bash
cd client
npm login                    # npmjs.com account (first time only)
npm run verify-publish
npm publish                  # unscoped — no --access public needed
```

---

## CSS isolation

Embed styles are scoped under `.remi-widget-root` with Tailwind `important: '.remi-widget-root'`. Host page CSS should not override widget utilities in normal cases.

---

## CORS options

| Mode | Env | Use case |
|------|-----|----------|
| **Wildcard** | `CORS_ALLOW_ANY_ORIGIN=true` | Public embed on any customer domain |
| **Allow-list** | `CORS_ORIGINS=https://a.com,https://b.com` | Known host origins only (default) |

---

## Related

- [09_known_limitations.md](./09_known_limitations.md) — deployment constraints
- [07_deployment_guide.md](./07_deployment_guide.md) — Railway + Vercel setup
- [08_frontend_guide.md](./08_frontend_guide.md) — React component reference
