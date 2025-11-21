<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { User } from '$lib/auth';

  let loading = $state(true);
  let updating = $state(false);
  let message = $state('');
  let error = $state('');

  let users = $state<User[]>([]);
  let selectedUserId = $state<string | null>(null);

  let editForm = $state({
    fullName: '',
    team: '',
    role: 'consultant'
  });

  function selectUser(user: User) {
    selectedUserId = user.id;
    editForm = {
      fullName: user.fullName || '',
      team: (user as any).team || '',
      role: user.role || 'consultant'
    };
  }

  async function loadUsers() {
    loading = true;
    message = '';
    error = '';

    try {
      users = await api.users.list();

      if (selectedUserId) {
        const updated = users.find((u) => u.id === selectedUserId);
        if (updated) {
          selectUser(updated);
        } else {
          selectedUserId = null;
        }
      }
    } catch (err: any) {
      error = err?.message || 'Failed to load users.';
    } finally {
      loading = false;
    }
  }

  async function handleUpdate(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedUserId) return;

    updating = true;
    message = '';
    error = '';

    try {
      await api.profile.update({
        userId: selectedUserId,
        fullName: editForm.fullName || undefined,
        team: editForm.team || undefined,
        role: editForm.role || undefined
      });
      message = 'User profile updated successfully.';
      await loadUsers();
    } catch (err: any) {
      error = err?.message || 'Unable to update user profile.';
    } finally {
      updating = false;
    }
  }

  onMount(() => {
    loadUsers();
  });
</script>

<section class="space-y-6">
  <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">User Management</h2>

    {#if error}
      <div class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
        {error}
      </div>
    {/if}

    {#if message}
      <div class="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">
        {message}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Users List</h3>
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        {:else if users.length === 0}
          <p class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No users found.</p>
        {:else}
          <div class="space-y-2 max-h-[600px] overflow-y-auto">
            {#each users as user}
              <button
                onclick={() => selectUser(user)}
                class="w-full text-left p-3 rounded-lg border transition-colors {selectedUserId === user.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.fullName || user.email}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div class="ml-3 flex-shrink-0">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">User Details</h3>
        {#if !selectedUserId}
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Select a user from the list to view or update details.
          </p>
        {:else}
          <form class="space-y-4" onsubmit={handleUpdate}>
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Full Name
              </label>
              <input
                type="text"
                required
                bind:value={editForm.fullName}
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Team
              </label>
              <input
                type="text"
                bind:value={editForm.team}
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Consulting, Sales, etc."
              />
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Role
              </label>
              <select
                bind:value={editForm.role}
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="consultant">Consultant</option>
                <option value="manager">Manager</option>
                <option value="leader">Leader</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={updating}
              class="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updating ? 'Updating...' : 'Save Changes'}
            </button>
          </form>
        {/if}
      </div>
    </div>
  </div>
</section>

