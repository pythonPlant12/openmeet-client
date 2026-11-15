import { ref } from 'vue';

// Where the workspace was when the call screen opened, so collapsing the call returns there: the same chat,
// the same panel. The app shell records it on every navigation outside the call screen.
export const lastWorkspaceRoute = ref('/dashboard');

/** The route a collapsed call returns to: the workspace as it was left, or the dashboard. */
export function workspaceReturnRoute() {
  return lastWorkspaceRoute.value.startsWith('/dashboard') ? lastWorkspaceRoute.value : '/dashboard';
}
