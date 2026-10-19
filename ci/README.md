# Jenkins onboarding

`Jenkinsfile` pins the shared `simplia-ci` library. `ci/app.yml` defines
verification for this workspace. It has no deployment target.

## Activate the job

The platform custodian must onboard `gruia-app/open-design` in
`jenkins-platform` using its supported helper. Do not add the catalog row by
hand. From a reviewed platform checkout, with the existing protected webhook
secret:

```sh
python3 scripts/ops/onboard_jenkins_repo.py gruia-app/open-design \
  --job open-design --branch main \
  --secret-file "$HOME/.config/jenkins-webhook-audit/canonical-secret"
```

The helper must verify HMAC rejection and a fresh GitHub ping before it writes
`casc/jobs.groovy`. Review that diff in a platform PR. The custodian activates
the catalog through the existing controller procedure. A source PR alone does
not create a Jenkins job.

If the public receiver rejects the execution host, follow the scoped
controller-loopback procedure in `jenkins-platform/docs/GITHUB_WEBHOOK_AUDIT.md`.
That route requires the controller custodian's existing authority. Do not
change the ingress allowlist or fabricate an authority file.

Land these app files on `main` through the repository's review and merge gates.
Then confirm `jenkins-read effective-scm simplia/open-design-auto` points to
`gruia-app/open-design`, branch `main`, script `Jenkinsfile`. Reindex through
the supported platform control plane so existing PRs are discovered.

## Recover the security PRs

The heads observed on 2026-10-19 were:

| PR | Dependency | Head |
| --- | --- | --- |
| [#4](https://github.com/gruia-app/open-design/pull/4) | sharp | `81cdf2bd1ca234dcedfe4c940eb56774affe9175` |
| [#5](https://github.com/gruia-app/open-design/pull/5) | esbuild, tools/serve | `f4b54d888276ad06488df31090b5802762c77131` |
| [#6](https://github.com/gruia-app/open-design/pull/6) | esbuild, tools/dev | `61af1de742a0d1f582c488e12efd041b8a7105ae` |
| [#7](https://github.com/gruia-app/open-design/pull/7) | vitest | `9b7f74e99ff7e2d3b60a28ddf489e58bacd3d38e` |

After the base files land, refresh those branches through the existing
Dependabot update/rebase flow if their trees lack the Jenkins entrypoint.
Record the new head before requesting verification. A result on an old head
does not validate the replacement.

Verify `continuous-integration/jenkins/pr-head` on each current head and retain
the build URL. Full tests, builds and security checks run on Jenkins workers,
never on T3. Do not merge these dependency updates until their required gates
pass. Onboarding is complete only when the live job exists and all four PRs
publish this context on their current heads.
