# اليوسفي سوفت

تطبيق PWA عربي لإدارة بيع كروت الشبكات والعملاء والديون والمخزون وحسابات المورد والأرباح، ويعمل محلياً دون اتصال.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Wouter + Tailwind CSS
- Offline storage: versioned localStorage payload mirrored to IndexedDB, with JSON backup and restore

## Where things live

- `artifacts/alyousifi-soft/src/App.tsx` — local domain state, business rules, routes, screens, and modals
- `artifacts/alyousifi-soft/src/index.css` — shared theme tokens and responsive visual language
- `artifacts/alyousifi-soft/public/manifest.webmanifest` and `public/sw.js` — installability and offline shell caching

## Architecture decisions

- This first release is local-first by design: sales and financial records remain available without an online backend.
- State is persisted as a versioned payload and migrated by merging known collections, so updates do not overwrite existing local records.
- The API server remains available for future sync integrations, but current core flows do not depend on network access.

## Product

اليوسفي سوفت يوفر لوحة يومية للصندوق والديون والمخزون والمورد، نقطة بيع نقدي وآجل، ملفات العملاء والتحصيل والتنبيهات، إدارة التوريد والمرتجعات، وسجل الحسابات والنسخ الاحتياطية.

## Release notes

- سجل التحديثات محفوظ في `artifacts/alyousifi-soft/src/data/changelog.ts` كبيانات ثابتة داخل التطبيق، لذلك لا تحذفه عمليات مسح البيانات.
- عند تنفيذ أي إصلاح أو ميزة جديدة، حدّث الإصدار وأضف إدخالاً جديداً في أعلى سجل التحديثات، واجعل الإدخال الأحدث فقط `isLatest: true`.
- نافذة سجل التحديثات تعتمد على `last_seen_version` في LocalStorage وتظهر مرة واحدة عند التثبيت أو التحديث، مع إمكانية فتحها يدوياً من الإعدادات.

## User preferences

 - الواجهة وكل النصوص للمستخدم باللغة العربية وباتجاه RTL، مع أولوية واضحة لسهولة الاستخدام على الهاتف.

## Gotchas

- The frontend workflow supplies `PORT` and `BASE_PATH`; use the managed workflow for preview and use `PORT=... BASE_PATH=/` when invoking a local production build manually.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
