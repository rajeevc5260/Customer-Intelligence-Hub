<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { goto } from '$app/navigation';

  async function handleLogout() {
    await authStore.logout();
    goto('/auth');
  }
</script>

<header class="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Customer Intelligence Hub</h1>
      
      <div class="flex items-center gap-2 sm:gap-4">
        <button
          onclick={() => themeStore.toggle()}
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {#if themeStore.isDark}
            <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
            </svg>
          {:else}
            <svg class="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
            </svg>
          {/if}
        </button>

        <div class="flex items-center gap-2 sm:gap-3">
          <div class="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-indigo-600 flex items-center justify-center">
            <span class="text-white font-medium text-xs sm:text-sm">
              {authStore.user?.fullName ? authStore.user.fullName.charAt(0).toUpperCase() : authStore.user?.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div class="hidden lg:block">
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {authStore.user?.fullName || 'User'}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{authStore.user?.email}</div>
          </div>
        </div>
        
        <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 capitalize">
          {authStore.user?.role}
        </span>
        
        <button
          onclick={handleLogout}
          class="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <span class="hidden sm:inline">Sign Out</span>
          <span class="sm:hidden">Exit</span>
        </button>
      </div>
    </div>
  </div>
</header>