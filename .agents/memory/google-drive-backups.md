---
name: Google Drive backups
description: Durable architecture decision for Google Drive backup and restore in the local-first PWA.
---

Google Drive authentication and file operations stay server-side through the connected Replit Google Drive connector; the browser only calls same-project API routes.

**Why:** The PWA must not handle connector OAuth credentials, while the app still needs to remain local-first and usable offline.

**How to apply:** Send versioned JSON backup payloads to the API, store them in Drive's private `appDataFolder`, and restore the newest matching JSON file by `modifiedTime`.