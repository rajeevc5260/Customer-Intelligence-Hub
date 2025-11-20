<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';

	$effect(() => {
		if (!authStore.loading) {
			if (authStore.user) {
				goto('/dashboard');
			} else {
				goto('/auth');
			}
		}
	});
</script>

{#if authStore.loading}
	<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
	</div>
{/if}
