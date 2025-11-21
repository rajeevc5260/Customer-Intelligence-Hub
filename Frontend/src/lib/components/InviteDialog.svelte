<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';

  let { isOpen = $bindable(false) } = $props();
  let email = $state('');
  let fullName = $state('');
  let role = $state('consultant');
  let loading = $state(false);
  let message = $state('');

  async function handleInvite() {
    if (!email || !fullName) return;
    
    loading = true;
    message = '';
    
    try {
      const result = await authStore.invite(email, fullName, role);
      message = result.success ? result.message : result.error;
      
      if (result.success) {
        setTimeout(() => {
          isOpen = false;
          email = '';
          fullName = '';
          role = 'consultant';
          message = '';
        }, 2000);
      }
    } catch (error) {
      message = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }

  function closeDialog() {
    isOpen = false;
    email = '';
    fullName = '';
    role = 'consultant';
    message = '';
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto" role="presentation" onclick={closeDialog} onkeydown={(e) => e.key === 'Escape' && closeDialog()}>
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>
      
      <div 
        class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md"
        role="presentation"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Invite User</h2>
          <button
            onclick={closeDialog}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close dialog"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onsubmit={handleInvite} class="space-y-4">
          <div>
            <label for="invite-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              bind:value={email}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label for="invite-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              id="invite-name"
              type="text"
              required
              bind:value={fullName}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label for="invite-role" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <select
              id="invite-role"
              required
              bind:value={role}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="consultant">Consultant</option>
              <option value="manager">Manager</option>
              <option value="leader">Leader</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </button>
        </form>

        {#if message}
          <div class="mt-4 p-3 rounded-lg text-sm {message.includes('error') || message.includes('Error') ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'}">
            {message}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}