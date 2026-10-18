# Jenkins CI onboarding

`Jenkinsfile` delegates to the canonical `simplia-ci` library, pinned at
`5492c78ed6204ed04a3de2a8ef19b4b65f62ff11` (platform `main` observed through
`git ls-remote` on 2026-10-18), using `ci/app.yml` for
`gruia-app/open-design`, default branch `main`.

The manifest requires a Linux agent with Node 24.x and Corepack, activates and
checks pnpm 10.33.2, and installs with `--frozen-lockfile`. It runs guard, i18n,
declaration prebuilds, workspace typechecks, all applicable Linux unit-test
lanes, including `tools/release` and `tools/serve`, E2E Vitest, the Next.js build, critical/P0 browser groups and the existing
four-file strict visual CI suite. Chromium and its Linux dependencies are
installed in Jenkins. The agent must permit Playwright dependency provisioning
and have sufficient capacity for the serial baseline within platform timeouts.
No packaged installers or macOS/Windows artifact builds run on Linux.

There is no application fast path, path filtering, test selection or shared
install/build-cache reuse. Trivy blocks on HIGH/CRITICAL vulnerabilities and
scanner failures, with CVE grace disabled. Deployment is disabled; the manifest
declares no credentials. Existing GitHub automation is unchanged.

Rollout is **pending**, not operational. PRs [#4](https://github.com/gruia-app/open-design/pull/4),
[#5](https://github.com/gruia-app/open-design/pull/5),
[#6](https://github.com/gruia-app/open-design/pull/6) and
[#7](https://github.com/gruia-app/open-design/pull/7) currently lack the
`continuous-integration/jenkins/pr-head` check, and the Jenkins job is absent.

1. Review these three files and arrange bootstrap validation with the Jenkins
   custodian before merging into `main`; missing CI does not waive merge gates.
2. The platform custodian runs the canonical
   `jenkins-platform/scripts/ops/onboard_jenkins_repo.py` with repository
   `gruia-app/open-design`, `--job open-design`, `--branch main`, and
   `--secret-file` pointing to a protected file containing the **existing** hook
   secret. Keep the secret with its custodian; do not print, commit, transmit or
   replace it. The script verifies the receiver signature and successful hook
   delivery before adding the catalog entry.
3. Complete the platform catalog/controller rollout and multibranch scan;
   verify `simplia/open-design-auto` exists and discovers `main`.
4. Rebase Dependabot PRs #4–#7 onto the merged `main` so their heads inherit
   the entrypoint. Verify Jenkins discovers each PR and publishes
   `continuous-integration/jenkins/pr-head` on its current head SHA. A webhook
   ping or a catalog edit alone does not establish working CI.

Only static manifest validation and `git diff --check` were run locally.
Runtime, browser, security-scan and status-publication evidence must come from
the first Jenkins runs; no install, build, test or E2E execution was performed
locally.
