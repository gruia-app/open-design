// Design — Jenkins entrypoint (shared Simplia CI library).
// Stage definitions live in the shared library; app behavior lives in
// ci/app.yml. Keep this file a thin adapter — do not inline pipeline stages.
//
// Supply chain: the shared library is pinned to an exact commit of
// simplificando-roberto/jenkins-platform (same pin as autonomous-coding-v2),
// so CI never runs pipeline code that landed on main unreviewed.
@Library('simplia-ci@92ed16dcf6dc06f78fb8ac0c15529f89322692d5') _

simpliaPipeline(manifest: 'ci/app.yml')
