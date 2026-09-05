#!/usr/bin/env bash
set -u

readonly daemon_port=9007
readonly web_port=3006
result=0

server-manager status "$daemon_port" --json || result=$?
server-manager health "$daemon_port" --json || result=$?
server-manager status "$web_port" --json || result=$?
server-manager health "$web_port" --json || result=$?

exit "$result"
