---
name: Local Android builds
description: Environment constraint and verification path for Capacitor APK builds
---

The Replit workspace can provide Java 21 without providing Android SDK platform and build-tool packages. In that state Gradle fails before compilation with a missing `ANDROID_HOME`/`sdk.dir`; the GitHub Actions workflow is the reliable APK build path.

**Why:** The Android project itself is valid, but the local environment may not expose `sdkmanager` or a configured SDK, so repeated local Gradle retries do not add signal.

**How to apply:** Verify web TypeScript/build and Capacitor sync locally, then rely on the workflow's `setup-android`, SDK installation, and Java 21 steps to produce the release APK.