<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Client, Opportunity, PaginatedResponse } from '$lib/types';

  const stages = ['identified', 'qualified', 'in-progress', 'closed'];

  let loading = $state(true);
  let savingStage = $state<string | null>(null);
  let submitting = $state(false);
  let message = $state('');
  let error = $state('');

  let page = $state(1);
  let totalPages = $state(1);
  let search = $state('');
  let opportunities = $state<Opportunity[]>([]);
  let clients = $state<Client[]>([]);

  let form = $state({
    clientId: '',
    insightId: '',
    title: '',
    description: '',
    valueEstimate: ''
  });

  async function loadOpportunities(pageNumber = 1) {
    loading = true;
    message = '';
    error = '';

    try {
      const response: PaginatedResponse<Opportunity> = await api.opportunities.list(
        pageNumber,
        10,
        search
      );
      opportunities = response.data;
      page = response.page;
      totalPages = response.totalPages;
    } catch (err: any) {
      error = err?.message || 'Unable to load opportunities.';
    } finally {
      loading = false;
    }
  }

  async function loadClients() {
    try {
      const res = await api.clients.list(1, 100);
      clients = res.data;
      if (!form.clientId && res.data.length) {
        form.clientId = res.data[0].id;
      }
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleStageChange(opportunity: Opportunity, newStage: string) {
    if (opportunity.stage === newStage) return;
    savingStage = opportunity.id;

    try {
      await api.opportunities.updateStage(opportunity.id, newStage);
      opportunities = opportunities.map((item) =>
        item.id === opportunity.id ? { ...item, stage: newStage } : item
      );
    } catch (err: any) {
      error = err?.message || 'Unable to update stage.';
    } finally {
      savingStage = null;
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    submitting = true;
    message = '';
    error = '';

    try {
      await api.opportunities.create({
        clientId: form.clientId,
        insightId: form.insightId || undefined,
        title: form.title,
        description: form.description || undefined,
        valueEstimate: form.valueEstimate || undefined
      });
      message = 'Opportunity created.';
      form = { clientId: form.clientId, insightId: '', title: '', description: '', valueEstimate: '' };
      await loadOpportunities(page);
    } catch (err: any) {
      error = err?.message || 'Unable to create opportunity.';
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    loadOpportunities();
    loadClients();
  });
</script>

<section class="space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Opportunities</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">Track revenue motions generated from insights</p>
    </div>
    <div class="flex items-center gap-2">
      <input
        class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        placeholder="Search title..."
        bind:value={search}
      />
      <button
        class="rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-4 py-2 text-sm font-medium"
        onclick={() => loadOpportunities(1)}
      >
        Search
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

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Opportunity
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Client
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Stage
              </th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Created
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
            {:else if opportunities.length === 0}
              <tr>
                <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No opportunities found.
                </td>
              </tr>
            {:else}
              {#each opportunities as opportunity}
                <tr>
                  <td class="px-4 py-3">
                    <p class="font-semibold text-gray-900 dark:text-white">{opportunity.title}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                      {opportunity.description || 'No description'}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {clients.find((client) => client.id === opportunity.clientId)?.name || 'Client'}
                  </td>
                  <td class="px-4 py-3">
                    <select
                      class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      bind:value={opportunity.stage}
                      oninput={(event) =>
                        handleStageChange(opportunity, (event.target as HTMLSelectElement).value)
                      }
                      disabled={savingStage === opportunity.id}
                    >
                      {#each stages as stage}
                        <option value={stage}>{stage}</option>
                      {/each}
                    </select>
                  </td>
                  <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {new Date(opportunity.createdAt).toLocaleDateString()}
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
            onclick={() => loadOpportunities(page - 1)}
          >
            Previous
          </button>
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40"
            disabled={page === totalPages || loading}
            onclick={() => loadOpportunities(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create Opportunity</h3>
      <form class="space-y-4" onsubmit={handleCreate}>
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Client</label>
          <select
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            required
            bind:value={form.clientId}
          >
            <option value="" disabled>Select client</option>
            {#each clients as client}
              <option value={client.id}>{client.name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Insight ID (optional)</label>
          <input
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
            bind:value={form.insightId}
          />
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Title</label>
          <input
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            required
            bind:value={form.title}
          />
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
          <textarea
            rows="3"
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            bind:value={form.description}
          ></textarea>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Value estimate</label>
          <input
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="$250K"
            bind:value={form.valueEstimate}
          />
        </div>
        <button
          type="submit"
          class="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Save Opportunity'}
        </button>
      </form>
    </div>
  </div>
</section>

