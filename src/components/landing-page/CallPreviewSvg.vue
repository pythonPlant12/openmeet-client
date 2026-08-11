<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <svg
    id="call-preview"
    class="block h-auto w-full"
    viewBox="0 0 800 600"
    role="img"
    :aria-label="label"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <defs>
      <clipPath id="call-preview-user1-clip">
        <rect width="800" height="294" rx="26" />
      </clipPath>
      <clipPath id="call-preview-user2-clip">
        <rect x="0" y="306" width="394" height="294" rx="26" />
      </clipPath>
      <clipPath id="call-preview-user3-clip">
        <rect x="406" y="306" width="394" height="294" rx="26" />
      </clipPath>
      <clipPath id="call-preview-sidebar-user1-clip">
        <rect x="612" y="134" width="176" height="132" rx="14" />
      </clipPath>
      <clipPath id="call-preview-sidebar-user3-clip">
        <rect x="612" y="314" width="176" height="132" rx="14" />
      </clipPath>
      <filter id="call-preview-controls-shadow" x="-30%" y="-60%" width="160%" height="220%">
        <feDropShadow dx="0" dy="8" flood-color="#102F35" flood-opacity="0.24" stdDeviation="12" />
      </filter>
      <filter id="call-preview-cursor-shadow" x="-80%" y="-80%" width="260%" height="260%">
        <feDropShadow dx="0" dy="4" flood-color="#102F35" flood-opacity="0.35" stdDeviation="4" />
      </filter>
    </defs>

    <rect
      id="call-preview-background"
      class="call-preview__background"
      width="800"
      height="600"
      rx="26"
      fill="#27595D"
    />

    <g id="user1-layout" class="call-preview__layout-participant">
      <g id="user1" class="call-preview__participant" data-participant="maya" clip-path="url(#call-preview-user1-clip)">
        <image
          id="user1-image"
          class="call-preview__participant-image call-preview__participant-image--maya"
          x="0"
          y="-254"
          width="800"
          height="1200"
          href="/images/participant-maya.webp"
          xlink:href="/images/participant-maya.webp"
        />
      </g>
    </g>

    <g id="user2-layout" class="call-preview__layout-participant">
      <g id="user2" class="call-preview__participant" data-participant="alex" clip-path="url(#call-preview-user2-clip)">
        <image
          id="user2-image"
          class="call-preview__participant-image call-preview__participant-image--alex"
          x="0"
          y="158"
          width="394"
          height="591"
          href="/images/participant-alex.webp"
          xlink:href="/images/participant-alex.webp"
        />
        <g id="user2-hover" class="call-preview__hover-overlay">
          <rect x="0" y="306" width="394" height="294" rx="26" fill="#102F35" fill-opacity="0.32" />
          <g
            transform="translate(181 437) scale(1.35)"
            fill="none"
            stroke="white"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path d="M15 3h6v6" />
            <path d="m21 3-7 7" />
            <path d="m3 21 7-7" />
            <path d="M9 21H3v-6" />
          </g>
        </g>
      </g>
    </g>

    <g id="user3-layout" class="call-preview__layout-participant">
      <g id="user3" class="call-preview__participant" data-participant="noah" clip-path="url(#call-preview-user3-clip)">
        <image
          id="user3-image"
          class="call-preview__participant-image call-preview__participant-image--noah"
          x="406"
          y="158"
          width="394"
          height="591"
          href="/images/participant-noah.webp"
          xlink:href="/images/participant-noah.webp"
        />
      </g>
    </g>

    <g id="focused-sidebar" class="call-preview__focused-sidebar" pointer-events="none">
      <g id="user1-sidebar" clip-path="url(#call-preview-sidebar-user1-clip)">
        <image
          id="user1-sidebar-image"
          x="612"
          y="134"
          width="176"
          height="132"
          href="/images/participant-maya.webp"
          xlink:href="/images/participant-maya.webp"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
      <g id="user3-sidebar" clip-path="url(#call-preview-sidebar-user3-clip)">
        <image
          id="user3-sidebar-image"
          x="612"
          y="314"
          width="176"
          height="132"
          href="/images/participant-noah.webp"
          xlink:href="/images/participant-noah.webp"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </g>

    <g id="controls" class="call-preview__controls" data-element="controls" filter="url(#call-preview-controls-shadow)">
      <rect
        id="controls-background"
        class="call-preview__controls-background"
        x="317"
        y="518"
        width="166"
        height="62"
        rx="31"
        fill="white"
        fill-opacity="0.95"
        stroke="#D8E7E3"
        stroke-width="1.5"
      />

      <g id="button-microphone" class="call-preview__control" data-control="microphone">
        <circle cx="348" cy="549" r="21" fill="#E6F4F1" stroke="#D8E7E3" stroke-width="1.5" />
        <g
          transform="translate(338 539) scale(0.83)"
          fill="none"
          stroke="#102F35"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        >
          <path d="M12 19v3" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <rect x="9" y="2" width="6" height="13" rx="3" />
        </g>
      </g>

      <g id="button-camera" class="call-preview__control" data-control="camera">
        <circle cx="400" cy="549" r="21" fill="#E6F4F1" stroke="#D8E7E3" stroke-width="1.5" />
        <g
          transform="translate(390 539) scale(0.83)"
          fill="none"
          stroke="#102F35"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        >
          <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
          <rect x="2" y="6" width="14" height="12" rx="2" />
        </g>
      </g>

      <g id="button-end-call" class="call-preview__control" data-control="end-call">
        <circle cx="452" cy="549" r="21" fill="#F2765F" />
        <g
          transform="translate(442 539) scale(0.83)"
          fill="none"
          stroke="white"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        >
          <path
            d="M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272"
          />
          <path d="M22 2 2 22" />
          <path
            d="M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473"
          />
        </g>
      </g>
    </g>

    <g id="demo-cursor" class="call-preview__cursor" pointer-events="none">
      <circle
        id="cursor-click-ring"
        class="call-preview__cursor-ring"
        cx="0"
        cy="0"
        r="18"
        fill="none"
        stroke="white"
        stroke-width="3"
      />
      <g id="cursor-artwork" transform="translate(-11 -1) scale(0.14)">
        <path
          d="M192.231 104.082V102c0-12.407-10.094-22.5-22.5-22.5-2.802 0-5.484.519-7.961 1.459C159.665 70.722 150.583 63 139.731 63c-2.947 0-5.76.575-8.341 1.61C128.667 55.162 119.624 48 109.231 48c-2.798 0-5.496.541-8 1.516V22.5C101.231 10.093 91.137 0 78.731 0s-22.5 10.093-22.5 22.5v66.259c-3.938-5.029-8.673-9.412-14.169-11.671-6.133-2.52-12.587-2.219-18.667.872-11.182 5.686-15.792 19.389-10.277 30.548l27.95 56.563c.79 1.552 19.731 38.008 54.023 38.008h40c31.54 0 57.199-25.794 57.199-57.506l-.031-41.491h-.028Zm-57.139 84h-40c-24.702 0-40.091-28.738-40.646-29.796l-27.88-56.42c-1.924-3.893-.33-8.519 3.629-10.532 2.182-1.11 4.081-1.223 6.158-.372 8.281 3.395 16.41 19.756 19.586 29.265l2.41 7.259 12.883-4.559V22.5c0-4.136 3.364-7.5 7.5-7.5s7.5 3.364 7.5 7.5V109h15.136V71c0-4.187 3.748-8 7.864-8 4.262 0 8 3.505 8 7.5v41h15v-26c0-4.136 3.364-7.5 7.5-7.5s7.5 3.364 7.5 7.5v33h15V102c0-4.136 3.364-7.5 7.5-7.5s7.5 3.364 7.5 7.5v10.727h.035l.025 32.852c0 23.435-18.931 42.5-42.199 42.5Z"
          fill="white"
          filter="url(#call-preview-cursor-shadow)"
        />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.call-preview__background {
  animation: background-enter 0.45s ease-out both;
}

.call-preview__participant {
  transform-box: fill-box;
  transform-origin: center;
  will-change: opacity, transform;
}

#user1 {
  animation: participant-top-enter 0.72s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}

#user2 {
  animation: participant-left-enter 0.68s cubic-bezier(0.22, 1, 0.36, 1) 0.32s both;
}

#user3 {
  animation: participant-right-enter 0.68s cubic-bezier(0.22, 1, 0.36, 1) 0.46s both;
}

.call-preview__participant-image {
  transform-box: fill-box;
  transform-origin: center;
}

.call-preview__participant-image--maya {
  animation: image-settle 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}

.call-preview__participant-image--alex {
  animation: image-settle 1s cubic-bezier(0.22, 1, 0.36, 1) 0.32s both;
}

.call-preview__participant-image--noah {
  animation: image-settle 1s cubic-bezier(0.22, 1, 0.36, 1) 0.46s both;
}

.call-preview__layout-participant {
  transform-box: view-box;
  will-change: transform;
}

#user1-layout {
  transform-origin: 400px 147px;
  animation: user1-layout-demo 8s cubic-bezier(0.22, 1, 0.36, 1) 1.65s both infinite;
}

.call-preview__focused-sidebar {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 700px 290px;
  animation: focused-sidebar-demo 8s cubic-bezier(0.22, 1, 0.36, 1) 1.65s both infinite;
}

#user2-layout {
  transform-origin: 197px 453px;
  animation: user2-layout-demo 8s cubic-bezier(0.22, 1, 0.36, 1) 1.65s both infinite;
}

#user3-layout {
  transform-origin: 603px 453px;
  animation: user3-layout-demo 8s cubic-bezier(0.22, 1, 0.36, 1) 1.65s both infinite;
}

.call-preview__hover-overlay {
  opacity: 0;
  animation: hover-demo 8s linear 1.65s both infinite;
}

.call-preview__cursor {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 0 0;
  will-change: opacity, transform;
  animation: cursor-demo 8s cubic-bezier(0.22, 1, 0.36, 1) 1.65s both infinite;
}

.call-preview__cursor-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: cursor-click 8s linear 1.65s both infinite;
}

.call-preview__controls-background {
  transform-box: fill-box;
  transform-origin: center;
  animation: controls-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.72s both;
}

.call-preview__control {
  transform-box: fill-box;
  transform-origin: center;
  will-change: opacity, transform;
}

#button-microphone {
  animation: control-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.86s both;
}

#button-camera {
  animation: control-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.98s both;
}

#button-end-call {
  animation: control-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 1.1s both;
}

@keyframes background-enter {
  from {
    opacity: 0;
  }
}

@keyframes participant-top-enter {
  from {
    opacity: 0;
    transform: translateY(-24px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes participant-left-enter {
  from {
    opacity: 0;
    transform: translateX(-28px) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes participant-right-enter {
  from {
    opacity: 0;
    transform: translateX(28px) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes image-settle {
  from {
    transform: scale(1.06);
  }

  to {
    transform: scale(1);
  }
}

@keyframes user1-layout-demo {
  0%,
  19%,
  53%,
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }

  28%,
  42% {
    opacity: 0;
    transform: translate(300px, 53px) scale(0.22);
  }
}

@keyframes user2-layout-demo {
  0%,
  19%,
  53%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  28%,
  42% {
    transform: translate(101px, -194px) scale(1.45);
  }
}

@keyframes user3-layout-demo {
  0%,
  19%,
  53%,
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }

  28%,
  42% {
    opacity: 0;
    transform: translate(97px, -73px) scale(0.45);
  }
}

@keyframes focused-sidebar-demo {
  0%,
  19%,
  53%,
  100% {
    opacity: 0;
    transform: translateX(24px) scale(0.96);
  }

  28%,
  42% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes hover-demo {
  0%,
  12%,
  24%,
  35%,
  47%,
  60%,
  100% {
    opacity: 0;
  }

  16%,
  20%,
  38%,
  43% {
    opacity: 1;
  }
}

@keyframes cursor-demo {
  0% {
    opacity: 0;
    transform: translate(690px, 510px);
  }

  5% {
    opacity: 1;
    transform: translate(690px, 510px);
  }

  17%,
  22% {
    opacity: 1;
    transform: translate(195px, 445px);
  }

  30%,
  44% {
    opacity: 1;
    transform: translate(298px, 259px);
  }

  54% {
    opacity: 1;
    transform: translate(640px, 145px);
  }

  60%,
  100% {
    opacity: 0;
    transform: translate(700px, 100px);
  }
}

@keyframes cursor-click {
  0%,
  18%,
  24%,
  40%,
  46%,
  100% {
    opacity: 0;
    transform: scale(0.35);
  }

  19%,
  41% {
    opacity: 0.9;
    transform: scale(0.35);
  }

  23%,
  45% {
    opacity: 0;
    transform: scale(1.6);
  }
}

@keyframes controls-enter {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.88);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes control-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.35);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .call-preview__background,
  .call-preview__participant,
  .call-preview__participant-image,
  .call-preview__layout-participant,
  .call-preview__focused-sidebar,
  .call-preview__controls-background,
  .call-preview__control {
    animation: none !important;
  }

  .call-preview__hover-overlay,
  .call-preview__cursor {
    display: none;
  }
}
</style>
