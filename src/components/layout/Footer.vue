<template>
  <!-- Application footer -->
  <footer
    class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto"
  >
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- Brand Section -->
        <div class="md:col-span-1">
          <div class="flex items-center space-x-3 mb-4">
            <div
              class="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center"
            >
              <span class="text-white font-bold text-sm">P</span>
            </div>
            <h3 class="text-lg font-semibold text-white mb-4">FloppFun</h3>
          </div>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            {{ $t("footer.description") }}
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t("footer.platform") }}
          </h3>
          <ul class="space-y-2 text-sm">
            <li>
              <router-link
                to="/create"
                class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {{ $t("navigation.create") }}
              </router-link>
            </li>
            <li>
              <router-link
                to="/"
                class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {{ $t("navigation.home") }}
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t("footer.resources") }}
          </h3>
          <ul class="space-y-2 text-sm">
            <li>
              <router-link
                to="/about"
                class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {{ $t("navigation.about") }}
              </router-link>
            </li>
            <li>
              <a
                href="#"
                class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {{ $t("footer.documentation") }}
              </a>
            </li>
            <li>
              <a
                href="#"
                class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {{ $t("footer.api") }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Social Links -->
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t("footer.community") }}
          </h3>
          <div class="flex space-x-4">
            <a
              href="#"
              class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"
                />
              </svg>
            </a>
            <a
              href="#"
              class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.347-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"
                />
              </svg>
            </a>
            <a
              href="#"
              class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M13.6823 10.6218L20.2391 3H18.6854L12.9921 9.61788L8.44486 3H3.2002L10.0765 13.0074L3.2002 21H4.75404L10.7663 14.0113L15.5685 21H20.8131L13.6819 10.6218H13.6823ZM11.5541 13.0956L10.8574 12.0991L5.31391 4.16971H7.70053L12.1742 10.5689L12.8709 11.5655L18.6861 19.8835H16.2995L11.5541 13.0956Z"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div
        class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center"
      >
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t("footer.copyright") }}
        </p>
        <div class="flex space-x-6 mt-4 md:mt-0">
          <a
            href="#"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            {{ $t("footer.privacyPolicy") }}
          </a>
          <a
            href="#"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            {{ $t("footer.termsOfService") }}
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
// No additional logic needed for basic footer
</script>

<style scoped>
/* Component-specific styles are handled by Tailwind classes */
</style>
