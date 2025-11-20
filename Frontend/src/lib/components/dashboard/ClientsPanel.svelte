<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Client, PaginatedResponse } from '$lib/types';

  let loading = $state(true);
  let submitting = $state(false);
  let updating = $state(false);
  let message = $state('');
  let error = $state('');

  let page = $state(1);
  let totalPages = $state(1);
  let clients = $state<Client[]>([]);
  let selectedClientId = $state<string | null>(null);

  let createForm = $state({
    name: '',
    industry: '',
    description: ''
  });

  let editForm = $state({
    industry: '',
    description: ''
  });

  function selectClient(client: Client) {
    selectedClientId = client.id;
    editForm = {
      industry: client.industry || '',
      description: client.description || ''
    };
  }

  async function loadClients(pageNumber = 1) {
    loading = true;
    message = '';
    error = '';

    try {
      const response: PaginatedResponse<Client> = await api.clients.list(pageNumber, 10);
      clients = response.data;
      page = response.page;
      totalPages = response.totalPages;

      if (selectedClientId) {
        const updated = response.data.find((c) => c.id === selectedClientId);
        if (updated) {
          selectClient(updated);
        } else {
          selectedClientId = null;
        }
      }
    } catch (err: any) {
      error = err?.message || 'Failed to load clients.';
    } finally {
      loading = false;
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    submitting = true;
    message = '';
    error = '';

    try {
      await api.clients.create({
        name: createForm.name,
        industry: createForm.industry || undefined,
        description: createForm.description || undefined
      });
      message = 'Client added successfully.';
      createForm = { name: '', industry: '', description: '' };
      await loadClients(page);
    } catch (err: any) {
      error = err?.message || 'Unable to create client.';
    } finally {
      submitting = false;
    }
  }

  async function handleUpdate(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedClientId) return;

    updating = true;
    message = '';
    error = '';

    try {
      await api.clients.update(selectedClientId, {
        industry: editForm.industry || null,
        description: editForm.description || null
      });
      message = 'Client details updated.';
      await loadClients(page);
    } catch (err: any) {
      error = err?.message || 'Unable to update client.';
    } finally {
      updating = false;
    }
  }

  onMount(() => {
    loadClients();
  });
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Clients</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Manage client profiles and engagement context
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onclick={() => loadClients(page)}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A9 9 0 116.582 9H20"/>
        </svg>
        Refresh
      </button>
    </div>
  </div>

  {#if message}
    <div class="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/30 px-4 py-3 text-sm text-green-700 dark:text-green-200">
      {message}
    </div>
  {/if}

  {#if error}
    <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
    <div class="xl:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Client
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Industry
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Approved Insights
              </th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            {#if loading}
              {#each Array(5) as _}
                <tr>
                  <td colspan="4" class="px-4 py-3">
                    <div class="h-6 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                  </td>
                </tr>
              {/each}
            {:else if clients.length === 0}
              <tr>
                <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No clients have been created yet.
                </td>
              </tr>
            {:else}
              {#each clients as client}
                <tr class="{selectedClientId === client.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}">
                  <td class="px-4 py-3">
                    <p class="font-medium text-gray-900 dark:text-white">{client.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                      {client.description || 'No description'}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {client.industry || '—'}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {client.approvedInsightsCount}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      class="text-sm font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                      onclick={() => selectClient(client)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        <span>Page {page} of {totalPages}</span>
        <div class="flex items-center gap-3">
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40"
            disabled={page === 1 || loading}
            onclick={() => loadClients(page - 1)}
          >
            Previous
          </button>
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40"
            disabled={page === totalPages || loading}
            onclick={() => loadClients(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Client</h3>
        <form class="space-y-4" onsubmit={handleCreate}>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Name</label>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.name}
              required
            />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Industry</label>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.industry}
            />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
            <textarea
              rows="3"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.description}
            ></textarea>
          </div>
          <button
            type="submit"
            class="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Create Client'}
          </button>
        </form>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Client Details</h3>
        {#if !selectedClientId}
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Select a client from the table to view or update details.
          </p>
        {:else}
          <form class="space-y-4" onsubmit={handleUpdate}>
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Industry</label>
              <input
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                bind:value={editForm.industry}
              />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
              <textarea
                rows="3"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                bind:value={editForm.description}
              ></textarea>
            </div>
            <button
              type="submit"
              class="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              disabled={updating}
            >
              {updating ? 'Updating...' : 'Save Changes'}
            </button>
          </form>
        {/if}
      </div>
    </div>
  </div>
</section>

