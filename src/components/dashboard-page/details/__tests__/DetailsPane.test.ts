import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import DetailsPane from '@/components/dashboard-page/details/DetailsPane.vue';
import { userStatusOption } from '@/config/user-status.config';

vi.mock('@/composables/useOwnProfile', () => ({
  useOwnProfile: () => ({
    avatarUrl: ref(null),
    nickname: ref('alex'),
    ownStatus: ref('available'),
    ownStatusOption: computed(() => userStatusOption('available')),
    isNicknameCopied: ref(false),
    setOwnStatus: vi.fn(),
    copyNickname: vi.fn(),
  }),
}));

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
        changeFriendship: async () => true,
        friends: [],
        pendingFriend: null,
        selectedConversation: null,
        selectedIsGroup: false,
        selectedTitle: '',
        callActive: false,
        currentUser: { name: 'Alex Smith', email: 'alex@example.com' },
      },
      global: { stubs: { AccountMenuContent: true } },
    });

    const card = wrapper.get('[aria-label="Open account settings"]');
    expect(card.find('[aria-label="Online"]').exists()).toBe(true);
    await card.trigger('click');

    expect(wrapper.emitted('account')).toHaveLength(1);
  });
});
