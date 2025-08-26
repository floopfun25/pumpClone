<template>
  <!-- Add a ref to the root element -->
  <div class="social-share" ref="shareRoot">
    <!-- Share Button -->
    <button
      @click="toggleDropdown"
      :class="[
        'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
        buttonClass || 'bg-primary-500 hover:bg-primary-600 text-white',
      ]"
    >
      <span class="text-lg">📤</span>
      <span>{{ buttonText }}</span>
      <span
        :class="[
          'transform transition-transform duration-200',
          showDropdown ? 'rotate-180' : '',
        ]"
      >
        ▼
      </span>
    </button>

    <!-- Share Dropdown -->
    <div
      v-if="showDropdown"
      class="absolute z-50 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Share {{ contentType }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Spread the word about {{ shareData.title }}
        </p>
      </div>

      <!-- Social Platforms -->
      <div class="p-4">
        <div class="grid grid-cols-2 gap-3">
          <!-- Loop through social platforms -->
          <button
            v-for="platform in socialPlatforms"
            :key="platform.name"
            @click="platform.handler"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                platform.bgClass,
              ]"
            >
              <span :class="['text-lg', platform.iconClass]">{{
                platform.icon
              }}</span>
            </div>
            <div class="text-left">
              <div class="font-medium text-gray-900 dark:text-white">
                {{ platform.name }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ platform.description }}
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Copy Link Section -->
      <div class="border-t border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center gap-3">
          <input
            ref="linkInput"
            :value="shareData.url"
            readonly
            class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            @click="copyToClipboard"
            :class="[
              'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              copied
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500',
            ]"
          >
            {{ copied ? "✓ Copied!" : "📋 Copy" }}
          </button>
        </div>
      </div>

      <!-- Analytics & Engagement -->
      <div
        v-if="showStats"
        class="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/50"
      >
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">Total Shares</span>
          <span class="font-medium text-gray-900 dark:text-white">{{
            shareData.shareCount || 0
          }}</span>
        </div>
        <div class="flex items-center justify-between text-sm mt-2">
          <span class="text-gray-600 dark:text-gray-400">Your Shares</span>
          <span class="font-medium text-gray-900 dark:text-white">{{
            userShareCount
          }}</span>
        </div>
      </div>

      <!-- Quick Share Templates -->
      <div class="border-t border-gray-200 dark:border-gray-700 p-4">
        <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Quick Templates
        </p>
        <div class="space-y-2">
          <button
            v-for="template in shareTemplates"
            :key="template.id"
            @click="useTemplate(template)"
            class="w-full text-left p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <div class="font-medium text-sm text-gray-900 dark:text-white">
              {{ template.name }}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {{ template.preview }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Backdrop -->
    <div
      v-if="showDropdown"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
    ></div>

    <!-- Success Toast -->
    <div
      v-if="showToast"
      class="fixed bottom-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-up"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { SupabaseService } from "@/services/supabase";

interface ShareData {
  title: string;
  description?: string;
  url: string;
  image?: string;
  hashtags?: string[];
  shareCount?: number;
}

interface ShareTemplate {
  id: string;
  name: string;
  preview: string;
  content: string;
}

// Props
interface Props {
  contentType: "token" | "post" | "profile" | "general";
  shareData: ShareData;
  buttonText?: string;
  buttonClass?: string;
  showStats?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: "Share",
  showStats: true,
});

// Store
const authStore = useAuthStore();

// State
const showDropdown = ref(false);
const copied = ref(false);
const showToast = ref(false);
const toastMessage = ref("");
const linkInput = ref<HTMLInputElement | null>(null);
const shareRoot = ref<HTMLElement | null>(null); // Ref for the root element
const userShareCount = ref(0);

// Computed
const shareTemplates = computed((): ShareTemplate[] => {
  const baseTemplates: Record<string, ShareTemplate[]> = {
    token: [
      {
        id: "bullish",
        name: "🚀 Bullish Alert",
        preview: "This token is going to the moon! 🚀",
        content: `🚀 BULLISH ALERT! ${props.shareData.title} is pumping hard! 💎\n\nDon't miss out on this gem! ${props.shareData.hashtags?.map((tag) => `#${tag}`).join(" ") || ""}\n\n${props.shareData.url}`,
      },
      {
        id: "gem",
        name: "💎 Hidden Gem",
        preview: "Found a hidden gem...",
        content: `💎 HIDDEN GEM ALERT! 💎\n\nJust discovered ${props.shareData.title} - this could be the next big meme coin! 🔥\n\n${props.shareData.description || ""}\n\n${props.shareData.url}`,
      },
      {
        id: "dyor",
        name: "🔍 DYOR",
        preview: "Check this out and DYOR...",
        content: `🔍 DYOR: ${props.shareData.title}\n\n${props.shareData.description || "Interesting project worth researching"}\n\nAlways do your own research! 📚\n\n${props.shareData.url}`,
      },
    ],
    post: [
      {
        id: "check-out",
        name: "📢 Check This Out",
        preview: "Check out this awesome post!",
        content: `📢 Check out this awesome post!\n\n${props.shareData.title}\n\n${props.shareData.description || ""}\n\n${props.shareData.url}`,
      },
      {
        id: "interesting",
        name: "🤔 Interesting Read",
        preview: "Found something interesting...",
        content: `🤔 Found something interesting: ${props.shareData.title}\n\n${props.shareData.description || ""}\n\nWhat do you think?\n\n${props.shareData.url}`,
      },
    ],
    profile: [
      {
        id: "follow",
        name: "👤 Follow This User",
        preview: "Check out this awesome creator!",
        content: `👤 Check out this awesome creator: ${props.shareData.title}\n\n${props.shareData.description || "Great content and insights!"}\n\n${props.shareData.url}`,
      },
    ],
    general: [
      {
        id: "simple",
        name: "📢 Simple Share",
        preview: "Check this out!",
        content: `Check this out: ${props.shareData.title}\n\n${props.shareData.url}`,
      },
    ],
  };

  return baseTemplates[props.contentType] || baseTemplates.general;
});

const socialPlatforms = computed(() => [
  {
    name: "Twitter",
    description: "Share on X",
    icon: "𝕏",
    bgClass: "bg-black dark:bg-white",
    iconClass: "text-white dark:text-black font-bold",
    handler: shareOnTwitter,
  },
  {
    name: "Telegram",
    description: "Share in groups",
    icon: "✈",
    bgClass: "bg-blue-500",
    iconClass: "text-white",
    handler: shareOnTelegram,
  },
  {
    name: "Discord",
    description: "Share in servers",
    icon: "🎮",
    bgClass: "bg-indigo-500",
    iconClass: "text-white",
    handler: shareOnDiscord,
  },
  {
    name: "Reddit",
    description: "Post to communities",
    icon: "🤖",
    bgClass: "bg-orange-500",
    iconClass: "text-white",
    handler: shareOnReddit,
  },
]);

// Methods
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
};

const closeDropdown = () => {
  showDropdown.value = false;
};

const shareOnTwitter = () => {
  const text = encodeURIComponent(
    `${props.shareData.title}\n\n${props.shareData.description || ""}`,
  );
  const url = encodeURIComponent(props.shareData.url);
  const hashtags =
    props.shareData.hashtags?.join(",") || "FloppFun,memecoins,Solana";

  const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=${hashtags}`;

  window.open(twitterUrl, "_blank", "width=600,height=400");
  trackShare("twitter");
};

const shareOnTelegram = () => {
  const text = encodeURIComponent(
    `${props.shareData.title}\n\n${props.shareData.description || ""}\n\n${props.shareData.url}`,
  );
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(props.shareData.url)}&text=${text}`;

  window.open(telegramUrl, "_blank");
  trackShare("telegram");
};

const shareOnDiscord = () => {
  // Discord doesn't have a direct share URL, so we copy a formatted message
  const discordText = `**${props.shareData.title}**\n\n${props.shareData.description || ""}\n\n${props.shareData.url}`;

  navigator.clipboard.writeText(discordText).then(() => {
    showToastMessage("Discord message copied! Paste it in your server.");
    trackShare("discord");
  });
};

const shareOnReddit = () => {
  const title = encodeURIComponent(props.shareData.title);
  const url = encodeURIComponent(props.shareData.url);

  const redditUrl = `https://reddit.com/submit?title=${title}&url=${url}`;

  window.open(redditUrl, "_blank");
  trackShare("reddit");
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.shareData.url);
    copied.value = true;
    showToastMessage("Link copied to clipboard!");

    setTimeout(() => {
      copied.value = false;
    }, 2000);

    trackShare("copy-link");
  } catch (error) {
    // Fallback for older browsers
    if (linkInput.value) {
      linkInput.value.select();
      document.execCommand("copy");
      copied.value = true;
      showToastMessage("Link copied to clipboard!");

      setTimeout(() => {
        copied.value = false;
      }, 2000);
    }
  }
};

const useTemplate = (template: ShareTemplate) => {
  navigator.clipboard.writeText(template.content).then(() => {
    showToastMessage(`"${template.name}" template copied!`);
    closeDropdown();
  });
};

const trackShare = async (platform: string) => {
  // Log share event (could be sent to analytics service)
  console.log(
    `Shared ${props.contentType} on ${platform}:`,
    props.shareData.title,
  );

  // If user is authenticated, record the share in the database
  if (authStore.isAuthenticated && authStore.user) {
    const result = await SupabaseService.recordShare(
      authStore.user.id,
      props.shareData.url,
      platform,
    );
    if (result.success && !result.alreadyExists) {
      // Only increment the count if it was a new, unique share
      userShareCount.value += 1;
    }
  }

  // Close dropdown after sharing
  closeDropdown();
};

const showToastMessage = (message: string) => {
  toastMessage.value = message;
  showToast.value = true;

  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

// Handle click outside
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (
    showDropdown.value &&
    shareRoot.value &&
    !shareRoot.value.contains(target)
  ) {
    closeDropdown();
  }
};

// Lifecycle
onMounted(() => {
  document.addEventListener("click", handleClickOutside);

  // If user is logged in, fetch their share count from the database
  if (authStore.isAuthenticated && authStore.user) {
    SupabaseService.getUserShareCount(
      authStore.user.id,
      props.shareData.url,
    ).then((count) => {
      userShareCount.value = count;
    });
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
.social-share {
  position: relative;
  display: inline-block;
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
</style>
