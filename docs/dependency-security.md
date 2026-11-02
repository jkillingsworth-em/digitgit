# Dependency security maintenance

The dependency update branch uses Firebase 13.1.0. Firebase still requests
an older gRPC release, so `package.json` overrides only Firestore's
`@grpc/grpc-js` dependency to `^1.14.5`. This is outside Firestore's declared
range and must be retested whenever Firebase or gRPC changes. Remove the
override once Firebase's own dependency resolves to a patched release.

Use Node 24 LTS, version 24.12.0 or later in that release line. `.nvmrc`
selects Node 24, and `engines` records Firebase's minimum Node requirement.
Hosted builds must also use a compatible runtime. This change does not
update a hosted build setting, deploy the app, or migrate database records.

## Checks

```sh
npm ci
npm audit
npm audit --omit=dev
npm run build
```

The Firebase integration tests require Java 21 and run against an isolated
demo project with the repository's existing Firestore rules:

```sh
npm exec --yes --package firebase-tools@15.34.2 -- firebase emulators:exec --config firebase.test.json --project demo-digitgit --only auth,firestore "npm run test:firebase"
```

The tests refuse to start unless the demo project and both loopback emulator
addresses are set by the emulator runner. No Firebase account login is needed.
They cover account creation/sign-in/sign-out, document creation/read/delete,
snapshot delivery, batched writes, concurrent SDK transactions and an employee
write denial. They exercise the Firebase SDK and the Node gRPC transport;
they do not exercise the app's inventory UI or its business logic.

On Windows, if Java reports an invalid argument creating its loopback pipe,
set `JAVA_TOOL_OPTIONS` to include `-Djdk.net.unixdomain.tmpdir=<short existing
local directory>` and `-Djava.net.preferIPv4Stack=true` for that shell only.

## Verification and limits

On November 2, 2026, all three emulator tests passed with Node 24.22.2,
Java 21 and Firebase CLI 15.34.2. The upgraded app builds successfully.
The installed dependency audit reports zero known vulnerabilities.

The separate TypeScript check (`npx tsc --noEmit`) still reports 49 errors,
with identical diagnostics on unchanged main and this dependency upgrade.
Those pre-existing application errors remain unresolved. The build also
retains its large-chunk warning; Firebase 13 increases the generated main
JavaScript bundle compared with Firebase 11. Hosted browser sign-in and
the full inventory workflows still require app-level verification.
