import { describe, expect, it } from 'vitest';
import type { WorkspaceDirectoryItem } from '@open-design/contracts';
import { explicitWorkspaceHeaders } from '../../src/collab/useWorkspaceContext';

// The local `/api/workspace/context` endpoint derives authority from these
// assertions: sending only ids defaults a Team member to `personal/member`,
// so a Team member/admin with an empty wallet would be answered with the
// personal upgrade dialog instead of the owner top-up one.
describe('explicitWorkspaceHeaders', () => {
  it('forwards the chosen row authority claims for a team admin', () => {
    const selection: WorkspaceDirectoryItem = {
      workspaceId: 'ws-team',
      workspaceName: 'Team',
      workspaceType: 'team',
      workspaceMemberId: 'member-1',
      role: 'admin',
      memberStatus: 'active',
      lifecycleState: 'active',
    };
    expect(explicitWorkspaceHeaders(selection)).toEqual({
      'x-od-workspace-id': 'ws-team',
      'x-od-workspace-member-id': 'member-1',
      'x-od-workspace-type': 'team',
      'x-od-workspace-role': 'admin',
      'x-od-workspace-lifecycle-state': 'active',
      'x-od-workspace-member-status': 'active',
    });
  });

  it('forwards a removed member status unchanged', () => {
    const selection: WorkspaceDirectoryItem = {
      workspaceId: 'ws-team',
      workspaceName: 'Team',
      workspaceType: 'team',
      workspaceMemberId: 'member-2',
      role: 'member',
      memberStatus: 'removed',
      lifecycleState: 'active',
    };
    expect(explicitWorkspaceHeaders(selection)).toMatchObject({
      'x-od-workspace-role': 'member',
      'x-od-workspace-member-status': 'removed',
    });
  });
});
