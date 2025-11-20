<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import Header from '$lib/components/Header.svelte';
  import InviteDialog from '$lib/components/InviteDialog.svelte';

  let showInviteDialog = $state(false);

  $effect(() => {
    if (!authStore.loading && !authStore.user) {
      goto('/auth');
    }
  });
</script>

{#if authStore.loading}
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
{:else if authStore.user}
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <Header />
    <InviteDialog bind:isOpen={showInviteDialog} />

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="space-y-6">
        <!-- Welcome Section -->
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Welcome back, {authStore.user.fullName || authStore.user.email}!
            </h2>
            
            <!-- User Details Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                <div class="mt-1 text-sm text-gray-900 dark:text-white break-all">{authStore.user.email}</div>
              </div>
              
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Role</div>
                <div class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{authStore.user.role}</div>
              </div>
              
              {#if authStore.user.fullName}
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</div>
                  <div class="mt-1 text-sm text-gray-900 dark:text-white">{authStore.user.fullName}</div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Dashboard Content</h3>
              <button
                onclick={() => showInviteDialog = true}
                class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Invite User
              </button>
            </div>
            <p class="text-gray-600 dark:text-gray-300">
              You are successfully authenticated and can access protected resources.
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
{/if}