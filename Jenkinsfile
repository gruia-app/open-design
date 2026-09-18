// Design — Jenkins entrypoint (shared Simplia CI library).
// Stage definitions live in the shared library; app behavior lives in
// ci/app.yml. Keep this file a thin adapter — do not inline pipeline stages.
//
// Supply chain: the shared library is pinned to an exact commit of
// simplificando-roberto/jenkins-platform (same pin as autonomous-coding-v2),
// so CI never runs pipeline code that landed on main unreviewed.
@Library('simplia-ci@6417a12e9960e1f47761aa0a9dba5b55beb6ea8d') _

simpliaPipeline(manifest: 'ci/app.yml')
