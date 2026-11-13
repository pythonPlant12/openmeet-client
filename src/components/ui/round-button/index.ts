export { default as RoundButton } from './RoundButton.vue';
export { default as RoundButtonGroup } from './RoundButtonGroup.vue';

/** `default` is the white disc with a shadow; `accent` the teal glass primary action; `soft` a flat gray disc for
 *  list rows; `plain` only the icon until hovered; `danger` the red glass for ending or declining a call; `destructive` the white
 *  disc with a red icon, for removing something after a confirmation beside a primary action. */
export type RoundButtonTone = 'default' | 'accent' | 'soft' | 'plain' | 'danger' | 'destructive';
export type RoundButtonSize = 'sm' | 'md' | 'lg';
