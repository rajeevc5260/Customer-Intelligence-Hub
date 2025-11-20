<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Client, Project, Stakeholder } from '$lib/types';

  type LocalInsight = {
    id: string;
    clientId: string;
    clientName: string;
    summary?: string;
    themes?: string;
    status: 'pending' | 'approved';
    automation?: {
      batchTriggered: boolean;
      opportunityId?: string | null;
      taskIds?: string[];
    };
  };

  let clients = $state<Client[]>([]);
  let selectedClientId = $state<string | null>(null);
  let stakeholders = $state<Stakeholder[]>([]);
  let projects = $state<Project[]>([]);
  let contextLoading = $state(false);

  let createForm = $state({
    projectId: '',
    stakeholderId: '',
    rawText: ''
  });

  let approvalId = $state('');
  let message = $state('');
  let error = $state('');
  let loadingClients = $state(true);
  let submitting = $state(false);
  let approving = $state(false);

  let recentInsights = $state<LocalInsight[]>([]);
  let lastLoadedContext = $state<string | null>(null);

  async function loadClients() {
    loadingClients = true;
    try {
      const res = await api.clients.list(1, 100);
      clients = res.data;
      if (res.data.length > 0) {
        selectedClientId = res.data[0].id;
      }
    } catch (err: any) {
      error = err?.message || 'Unable to load clients.';
    } finally {
      loadingClients = false;
    }
  }

  async function loadClientContext(clientId: string) {
    if (!clientId || lastLoadedContext === clientId) return;
    contextLoading = true;
    try {
      const [stakeholderRes, projectRes] = await Promise.all([
        api.stakeholders.byClient(clientId),
        api.projects.byClient(clientId)
      ]);
      stakeholders = stakeholderRes;
      projects = projectRes;
      lastLoadedContext = clientId;
    } catch (err: any) {
      error = err?.message || 'Unable to load client context.';
    } finally {
      contextLoading = false;
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedClientId) return;

    submitting = true;
    message = '';
    error = '';

    try {
      const response = await api.insights.create({
        clientId: selectedClientId,
        projectId: createForm.projectId || undefined,
        stakeholderId: createForm.stakeholderId || undefined,
        rawText: createForm.rawText
      });

      const newInsight: LocalInsight = {
        id: response.id,
        clientId: selectedClientId,
        clientName: clients.find((client) => client.id === selectedClientId)?.name || 'Client',
        summary: response.data?.summary,
        themes: response.data?.themes,
        status: 'pending'
      };

      recentInsights = [newInsight, ...recentInsights].slice(0, 5);
      message = 'Insight enriched and saved. Awaiting approval.';
      createForm = { projectId: '', stakeholderId: '', rawText: '' };
      approvalId = response.id;
    } catch (err: any) {
      error = err?.message || 'Unable to create insight.';
    } finally {
      submitting = false;
    }
  }

  async function handleApprove(event: SubmitEvent) {
    event.preventDefault();
    if (!approvalId) return;

    approving = true;
    message = '';
    error = '';

    try {
      const response = await api.insights.approve(approvalId);
      message = response.batchTriggered
        ? 'Insight approved and automation triggered.'
        : 'Insight approved.';

      recentInsights = recentInsights.map((insight) =>
        insight.id === approvalId
          ? {
              ...insight,
              status: 'approved',
              automation: {
                batchTriggered: response.batchTriggered,
                opportunityId: response.opportunityId,
                taskIds: response.taskIds
              }
            }
          : insight
      );
    } catch (err: any) {
      error = err?.message || 'Unable to approve insight.';
    } finally {
      approving = false;
    }
  }

  $effect(() => {
    if (selectedClientId) {
      loadClientContext(selectedClientId);
    }
  });

  onMount(loadClients);
</script>

<section class="space-y-6">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Insights</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Capture consultant intelligence and trigger AI enrichment
    </p>
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
    <div class="xl:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create AI-Enriched Insight</h3>
      <form class="space-y-4" onsubmit={handleCreate}>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Client</label>
            <select
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={selectedClientId}
              disabled={loadingClients}
            >
              {#if loadingClients}
                <option>Loading...</option>
              {:else if clients.length === 0}
                <option>No clients found</option>
              {:else}
                {#each clients as client}
                  <option value={client.id}>{client.name}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Project</label>
            <select
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.projectId}
              disabled={contextLoading}
            >
              <option value="">Auto-detect</option>
              {#each projects as project}
                <option value={project.id}>{project.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Stakeholder</label>
            <select
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.stakeholderId}
              disabled={contextLoading}
            >
              <option value="">Auto-detect</option>
              {#each stakeholders as stakeholder}
                <option value={stakeholder.id}>{stakeholder.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Raw notes</label>
          <textarea
            rows="6"
            class="w-full rounded-2xl border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Paste call notes and context..."
            required
            bind:value={createForm.rawText}
          ></textarea>
        </div>

        <button
          type="submit"
          class="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          disabled={submitting || !selectedClientId}
        >
          {submitting ? 'Enriching...' : 'Enrich Insight'}
        </button>
      </form>

      {#if recentInsights.length > 0}
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Recent drafts
            </h4>
            <span class="text-xs text-gray-500 dark:text-gray-400">{recentInsights.length} saved</span>
          </div>
          <div class="space-y-3">
            {#each recentInsights as insight}
              <div class="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-2">
                <div class="flex items-center justify-between">
                  <p class="font-semibold text-gray-900 dark:text-white">{insight.clientName}</p>
                  <span class="text-xs uppercase font-semibold text-indigo-600 dark:text-indigo-300">
                    {insight.status}
                  </span>
                </div>
                {#if insight.summary}
                  <p class="text-sm text-gray-600 dark:text-gray-300">{insight.summary}</p>
                {/if}
                {#if insight.themes}
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Themes: {insight.themes}
                  </p>
                {/if}
                <div class="text-xs text-gray-400 dark:text-gray-500">
                  Insight ID: <span class="font-mono">{insight.id}</span>
                </div>
                {#if insight.automation}
                  <div class="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-2 text-xs text-indigo-800 dark:text-indigo-100">
                    Automation triggered → Opportunity {insight.automation.opportunityId || 'pending'}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approve Insight</h3>
        <form class="space-y-4" onsubmit={handleApprove}>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Insight ID</label>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
              placeholder="Use ID from recent list or paste existing"
              required
              bind:value={approvalId}
            />
          </div>
          <button
            type="submit"
            class="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            disabled={approving}
          >
            {approving ? 'Approving...' : 'Approve Insight'}
          </button>
        </form>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Every 5 approved insights per client automatically generates an opportunity with follow-on tasks.
        </p>
      </div>
    </div>
  </div>
</section>

