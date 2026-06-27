# Changelog

## [3.7.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.6.0-alpha.1...pagescms-v3.7.0-alpha.1) (2026-06-27)


### Features

* add preview bridge integration and widget worker ([2d1b329](https://github.com/Blaise1030/pagescms/commit/2d1b3291e3536289b07b82700000148adf5f3f9e))
* add preview bridge integration and widget worker ([3bdf891](https://github.com/Blaise1030/pagescms/commit/3bdf891e97aedd3db79f0d01a0112dd3214df4ea))


### Bug Fixes

* **auth:** always send production redirect_uri to GitHub on previews ([32ef68b](https://github.com/Blaise1030/pagescms/commit/32ef68b50cc58abcacf7db36c679d1d4c2559a4a))
* **auth:** keep OAuth proxy callback on preview host after login ([e1fd61b](https://github.com/Blaise1030/pagescms/commit/e1fd61b7ed70f9dd9a3525652237024e6191b405))
* **auth:** resolve OAuth state_mismatch on preview deployments ([a47a1be](https://github.com/Blaise1030/pagescms/commit/a47a1be5bab203989f225c165671fc0a4bc0a02b))
* **ci:** bootstrap staging worker so preview URLs actually route ([e4ef831](https://github.com/Blaise1030/pagescms/commit/e4ef831f44c41e0e6f54bb93c0117b9330e0640a))
* **ci:** target pagescms-staging worker for preview deploys ([34dce9f](https://github.com/Blaise1030/pagescms/commit/34dce9fc6292a0b1905a208d9addbed2c5e9ecf2))
* **ci:** upload preview secrets to staging worker via secrets-file ([f172ac6](https://github.com/Blaise1030/pagescms/commit/f172ac67f1860ed11c1b9974ffd4603d2c31f3fa))
* enable preview URLs on pagescms-staging worker ([20e4356](https://github.com/Blaise1030/pagescms/commit/20e4356051263e952dd1855086cfef8045560961))

## [3.6.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.5.0-alpha.1...pagescms-v3.6.0-alpha.1) (2026-06-27)


### Features

* **ci:** staging worker previews with oauth-proxy for PR deployments ([360d12b](https://github.com/Blaise1030/pagescms/commit/360d12b0b00d63186a1b5c6dfb3f124ce76d2838))

## [3.5.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.4.0-alpha.1...pagescms-v3.5.0-alpha.1) (2026-06-23)


### Features

* add markdown docs site and move dashboard to /projects ([a253ca8](https://github.com/Blaise1030/pagescms/commit/a253ca8a1801db57de561b91430374d4618b0215))
* add scroll border to marketing header ([bc842f5](https://github.com/Blaise1030/pagescms/commit/bc842f5090d14a7a9c82ba4cbc0770e87173385c))
* left-align hero and unify page width to max-w-[1400px] ([24c9cd0](https://github.com/Blaise1030/pagescms/commit/24c9cd0fc4d79942eee07f7c9e1963cf59a7f48a))
* multi-column footer layout ([0586769](https://github.com/Blaise1030/pagescms/commit/0586769b66d2e844f7e80310667bdb4d4e128d34))
* rebuild homepage with Linear-style layout ([8390929](https://github.com/Blaise1030/pagescms/commit/83909292a9f7b8ddf93d9fc9c7379141011fbbc3))
* unify header width and show footer on docs pages ([82930b4](https://github.com/Blaise1030/pagescms/commit/82930b4d1f88659414b3c0e94904912a2eb9768c))


### Bug Fixes

* escape apostrophe in marketing hero headline ([6651f06](https://github.com/Blaise1030/pagescms/commit/6651f0655775809f361c86f78bdda1dbc47cee0d))
* FORK_URL in header, footer z-index, cleanup ([46ff847](https://github.com/Blaise1030/pagescms/commit/46ff847cb4f6f9d731a04ccb2e9dede71b73c250))
* hero headline font-medium ([891e6c8](https://github.com/Blaise1030/pagescms/commit/891e6c813a7c064db09d0557fb42797d2a8d1eff))
* remove all gradients and glows from marketing pages ([dabbaa2](https://github.com/Blaise1030/pagescms/commit/dabbaa2772d91294cb30268f2e3fd75ab15372d2))
* use font-light for hero headline ([3576e62](https://github.com/Blaise1030/pagescms/commit/3576e62f7e05fa29a079e68034aaea9b76bf091d))
* use FORK_URL constant and correct pillar copy ([365aab9](https://github.com/Blaise1030/pagescms/commit/365aab9e168fea32df640abe59e33254fe5172d6))

## [3.4.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.3.0-alpha.1...pagescms-v3.4.0-alpha.1) (2026-06-22)


### Features

* add collaborators, collaboratorInvite, cacheStatus query keys ([de856d6](https://github.com/Blaise1030/pagescms/commit/de856d68e8dd2a1e9b4343ab8173785f7a0484c2))
* add searchable repo switcher, sidebar hide mode, and UI polish ([1937289](https://github.com/Blaise1030/pagescms/commit/1937289a07a7e3f203c8e09664685a7d8a72555c))
* migrate cache-page to useQuery + useMutation ([e7ff353](https://github.com/Blaise1030/pagescms/commit/e7ff3534b25829e4391488db28904124370768dd))
* migrate collaborators to useQuery + useMutation ([8f3d012](https://github.com/Blaise1030/pagescms/commit/8f3d01286498eb0d202b1f64647a7ba81f8d917f))
* migrate collection rename-node to useMutation ([bd3688d](https://github.com/Blaise1030/pagescms/commit/bd3688d2d7a60dd71220ee1f3c1339164ca6c080))
* migrate data fetching to TanStack Query and fix infinite re-render ([e1495ac](https://github.com/Blaise1030/pagescms/commit/e1495acd518a8067fc83f97e43489a0b713664dd))
* migrate data fetching to TanStack Query and fix infinite re-render ([fa51b4b](https://github.com/Blaise1030/pagescms/commit/fa51b4b69c441037dba05651a4db3bd023310d4f))
* migrate empty-create to useMutation ([f7f106b](https://github.com/Blaise1030/pagescms/commit/f7f106bd2004158bd15eecc322af06505819acba))
* migrate entry create/rename to useMutation ([1cdb6c5](https://github.com/Blaise1030/pagescms/commit/1cdb6c5cc1866c33ff3a506e0c02bbe165856d6c))
* migrate file-options delete to useMutation ([2d4235c](https://github.com/Blaise1030/pagescms/commit/2d4235ceee3c061eafc28d1322e3da6f7dbb800f))
* migrate file-rename to useMutation ([521c58d](https://github.com/Blaise1030/pagescms/commit/521c58dfdc8f9fbee85d97d4f5d1ac217a0e3e4f))
* migrate invite-sign-in to useQuery + useMutation ([45f7785](https://github.com/Blaise1030/pagescms/commit/45f7785206a8f1b729a31a52746b762a78ae8e7b))
* migrate rich-text image upload to useMutation ([9f70c5a](https://github.com/Blaise1030/pagescms/commit/9f70c5a9ee3431b2f4385601327460b40a0fa00d))
* migrate settings mutations to useMutation ([165b1d1](https://github.com/Blaise1030/pagescms/commit/165b1d103628df8faf95aab582ebf517fbacbaab))
* **task-11:** migrate reference edit-component useEffect fetches to useQuery ([738619c](https://github.com/Blaise1030/pagescms/commit/738619c2ecb04384c7782d77b982fc7c635f0869))


### Bug Fixes

* address final review findings (onError toast, invite queryFn error handling, unused param) ([c0aa34b](https://github.com/Blaise1030/pagescms/commit/c0aa34bc2a65cf1b924de97c66b3cf414cdc715a))
* remove max-width constraint on media page layout ([89fa17f](https://github.com/Blaise1030/pagescms/commit/89fa17ff00c5b560b262b13cf671b851ae2c1f7e))
* resolve self-referencing useCallback ESLint errors ([58fd767](https://github.com/Blaise1030/pagescms/commit/58fd767dae557265df8edb1ab2842a3f7d600725))

## [3.3.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.2.0-alpha.1...pagescms-v3.3.0-alpha.1) (2026-06-21)


### Features

* added preview panel ([3315cab](https://github.com/Blaise1030/pagescms/commit/3315cab70b4b8654a2551535c6c3ba6e8d048871))
* CMS enhancements — preview panel, preferences, lazy loading, CI/CD improvements ([2070a45](https://github.com/Blaise1030/pagescms/commit/2070a4558df146e5cf3256999a4f6450d6c0b5cb))

## [3.2.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.1.0-alpha.1...pagescms-v3.2.0-alpha.1) (2026-06-21)


### Features

* move panel toggle into preview panel, add outline back button ([a0a3cad](https://github.com/Blaise1030/pagescms/commit/a0a3cad29fe331d9b0401b797caa5c953f678cdc))
* move panel toggle into preview panel, add outline back button ([534b523](https://github.com/Blaise1030/pagescms/commit/534b523c2427f33fe9c9f2b628140946b1933a01))


### Bug Fixes

* add missing lib/preview and components/ui/resizable files ([3c72913](https://github.com/Blaise1030/pagescms/commit/3c72913663535b5d29d8c23e2c96e576623fb55f))
* externalize react-resizable-panels from RSC server build ([5088b8a](https://github.com/Blaise1030/pagescms/commit/5088b8a5750638ab61f0c98d3b61ea8e6eb0e6e1))
* removed ui component transitions ([861a2ed](https://github.com/Blaise1030/pagescms/commit/861a2ed7273815b6f1e01a179f36b8fc84d78e7a))

## [3.1.0-alpha.1](https://github.com/Blaise1030/pagescms/compare/pagescms-v3.0.0-alpha.1...pagescms-v3.1.0-alpha.1) (2026-06-21)


### Features

* add draft restore banner and save status indicator ([5f309c4](https://github.com/Blaise1030/pagescms/commit/5f309c4d8bf0c8d6d687e5a2abbf98707c5d4b1a))
* add idb and preferences utilities ([6c5ed29](https://github.com/Blaise1030/pagescms/commit/6c5ed29c5f23c5d221788cc1f9766a5e9b48464c))
* add settings preferences page with sidebar layout ([0db1fda](https://github.com/Blaise1030/pagescms/commit/0db1fdad7e21180403c0f2fe897491b1978b5243))
* added loading shell ([2526aa9](https://github.com/Blaise1030/pagescms/commit/2526aa9292a27bdd09aa85a36e73574ffe5a2c56))
* CMS enhancements — preferences, lazy loading, draft restore, and UI updates ([32664b0](https://github.com/Blaise1030/pagescms/commit/32664b0d528c6bbe8aca363fe4340642a256f01c))
* update field components with lazy loading ([9613473](https://github.com/Blaise1030/pagescms/commit/9613473d489adf6c5e286a6445ea1500d4965f32))


### Bug Fixes

* **ci:** pin Node 22.23.0 and add missing .nvmrc ([19046df](https://github.com/Blaise1030/pagescms/commit/19046dfc9865a79a30df4ca4f7940433bf2965bc))
* **ci:** use npm ci instead of pnpm ([b7688cf](https://github.com/Blaise1030/pagescms/commit/b7688cf166359b0030474173633cc0ef63ec7968))
* emit deployment-url output from preview URL step ([eaf45b9](https://github.com/Blaise1030/pagescms/commit/eaf45b91cf121712a04f6afb9557b4f3f710d76a))
* hardcode workers.dev subdomain to avoid secret masking on output ([9e8271d](https://github.com/Blaise1030/pagescms/commit/9e8271dc82379f3f814f24e870409269fe00fc66))
* pass environment as input to reusable deploy workflow ([0e98876](https://github.com/Blaise1030/pagescms/commit/0e98876a9330b8f0cb3d0a28530ccb09214e4292))
* remove environment from reusable workflow call in preview.yml ([fc55164](https://github.com/Blaise1030/pagescms/commit/fc55164e8a9d0608d10235b4c5b30ce4eaeebc76))
* remove job-level environment from release-please deploy job ([b9eb375](https://github.com/Blaise1030/pagescms/commit/b9eb37525bc1abd0cf13b56704737a956cd3dfa8))
* upgrade wrangler-action to v4 and drop optional webhook secret upload ([32b5299](https://github.com/Blaise1030/pagescms/commit/32b5299ba23ac6fb5c7ae33f654f18dd012a18f5))
* use vars.CLOUDFLARE_WORKERS_DEV_SUBDOMAIN instead of secrets ([a42c24f](https://github.com/Blaise1030/pagescms/commit/a42c24f2f194766bfaf82e339dd8eea7d88ac79f))

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
