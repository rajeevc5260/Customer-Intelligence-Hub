<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  onMount(async () => {
    // Extract token from URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      goto('/auth?error=' + encodeURIComponent(error));
      return;
    }

    if (accessToken) {
      try {
        const result = await authStore.handleCallback(accessToken);
        console.log('Callback result:', result);
        console.log('Auth store user:', authStore.user);
        
        if (result.success) {
          // Give a moment for cookie to be set
          await new Promise(resolve => setTimeout(resolve, 100));
          goto('/dashboard');
        } else {
          console.error('Callback failed:', result);
          goto('/auth?error=callback_failed');
        }
      } catch (error) {
        console.error('Callback error:', error);
        goto('/auth?error=callback_failed');
      }
    } else {
      goto('/auth?error=no_token');
    }
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Authenticating...</h2>
    <p class="text-gray-600 dark:text-gray-400">Please wait while we sign you in.</p>
  </div>
</div>