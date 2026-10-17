@Library('simplia-ci@05cac88d9687efc26035e2e22ead3080ea6a35a9') _

// CEO1028: existing Contabo2 CI capacity only; wait if it is unavailable.
def contabo2CiLabel = '(contabo2-ci-01 || contabo2-ci-02 || contabo2-ci-03 || contabo2-ci-04 || contabo2-ci-05 || contabo2-ci-06) && linux-docker-overflow && linux-docker-medium && (capacity-memory-mib-8192 || capacity-memory-mib-16384 || capacity-memory-mib-32768) && !controller'

simpliaPipeline(
  manifest: 'ci/app.yml',
  agentLabel: contabo2CiLabel,
  urgentAgentLabel: contabo2CiLabel
)
