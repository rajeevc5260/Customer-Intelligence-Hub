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
      <p class="text-xs text-gray-500 dark:text-gray-400">Track revenue motions generated from insights</p>
    </div>
    <div class="flex items-center gap-2">
      <input
        class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2"
        placeholder="Search title..."
        bind:value={search}
      />
      <button
        class="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
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

  <div class="grid grid-cols-1 gap-6">
    <div class="space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead class="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Opportunity
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Client
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Stage
                </th>
                <th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Created
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {#if loading}
                {#each Array(5) as _}
                  <tr>
                    <td colspan="4" class="px-5 py-4">
                      <div class="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                    </td>
                  </tr>
                {/each}
              {:else if opportunities.length === 0}
                <tr>
                  <td colspan="4" class="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No opportunities found.
                  </td>
                </tr>
              {:else}
                {#each opportunities as opportunity}
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td class="px-5 py-4">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">{opportunity.title}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {opportunity.description || 'No description'}
                      </p>
                      {#if opportunity.valueEstimate}
                        <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          {opportunity.valueEstimate}
                        </p>
                      {/if}
                    </td>
                    <td class="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {clients.find((client) => client.id === opportunity.clientId)?.name || 'Client'}
                    </td>
                    <td class="px-5 py-4">
                      <select
                        class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white py-1 px-2 w-28"
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
                    <td class="px-5 py-4 text-right text-xs text-gray-600 dark:text-gray-400">
                      {new Date(opportunity.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3 shadow-sm">
        <span class="text-xs text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === 1 || loading}
            onclick={() => loadOpportunities(page - 1)}
          >
            Previous
          </button>
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === totalPages || loading}
            onclick={() => loadOpportunities(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</section>

