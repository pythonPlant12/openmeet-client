import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DetailsPane from '@/components/dashboard-page/details/DetailsPane.vue';

describe('DetailsPane', () => {
  it('opens account settings from the current-user footer', async () => {
    const wrapper = mount(DetailsPane, {
      props: {
        groupError: '',
        groupInfo: null,
        groupLoading: false,
        groupMembers: [],
        groupMemberAvatarUrls: {},
        groupMembersHasMore: false,
        groupMembersLoadingMore: false,
        groupMutationBusy: () => false,
        beginMutation: () => null,
        endMutation: () => undefined,
        friends: [],
        pendingFriend: null,
        selectedConversation: null,
        selectedIsGroup: false,
        selectedTitle: '',
        callActive: false,
        currentUser: { name: 'Alex Smith', email: 'alex@example.com' },
      },
    });

    await wrapper.get('[aria-label="Open account settings"]').trigger('click');

    expect(wrapper.emitted('account')).toHaveLength(1);
  });
});
