<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  let isLogin = $state(true);
  let email = $state('');
  let fullName = $state('');
  let loading = $state(false);
  let message = $state('');

  async function handleSubmit() {
    if (!email) return;
    
    loading = true;
    message = '';
    
    try {
      const result = isLogin 
        ? await authStore.login(email)
        : await authStore.invite(email, fullName);
      
      message = result.success ? result.message : result.error;
    } catch (error) {
      message = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!authStore.loading && authStore.user) {
      goto('/dashboard');
    }
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
  <div class="max-w-md w-full">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
      <div class="text-center mb-6 sm:mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {isLogin ? 'Welcome Back' : 'Join Us'}
        </h1>
        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {isLogin ? 'Sign in to your account' : 'Create your account'}
        </p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4 sm:space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            bind:value={email}
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            placeholder="Enter your email"
          />
        </div>

        {#if !isLogin}
          <div>
            <label for="fullName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              bind:value={fullName}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="Enter full name"
            />
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : isLogin ? 'Send Magic Link' : 'Sign Up'}
        </button>
      </form>

      {#if message}
        <div class="mt-4 p-3 rounded-lg text-sm {message.includes('error') || message.includes('Error') ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'}">
          {message}
        </div>
      {/if}

      <div class="mt-6 text-center">
        <button
          onclick={() => { isLogin = !isLogin; message = ''; }}
          class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium text-sm sm:text-base"
        >
          {isLogin ? 'Need to sign up?' : 'Already have an account?'}
        </button>
      </div>
    </div>
  </div>
</div>