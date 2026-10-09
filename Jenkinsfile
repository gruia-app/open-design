// Design — Jenkins entrypoint (shared Simplia CI library).
// Stage definitions live in the shared library; app behavior lives in
// ci/app.yml. Keep this file a thin adapter — do not inline pipeline stages.
//
// Supply chain: the shared library is pinned to an exact commit of
// simplificando-roberto/jenkins-platform (same pin as autonomous-coding-v2),
// so CI never runs pipeline code that landed on main unreviewed.
@Library('simplia-ci@f18f8042723700a0c7ec2efaa89368c0a0bf7fad') _

simpliaPipeline(manifest: 'ci/app.yml')
