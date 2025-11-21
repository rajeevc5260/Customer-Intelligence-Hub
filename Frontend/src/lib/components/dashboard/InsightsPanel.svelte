<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { Client, Insight, Project, Stakeholder } from '$lib/types';

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

  let message = $state('');
  let error = $state('');
  let loadingClients = $state(true);
  let submitting = $state(false);
  let approvingId = $state<string | null>(null);
  let feedLoading = $state(false);

  let insightFeed = $state<Insight[]>([]);
  let lastLoadedContext = $state<string | null>(null);

  const userRole = $derived(authStore.user?.role ?? 'member');
  const canCreateInsights = $derived(userRole === 'consultant');

  const timestampFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

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

  async function loadInsights(clientId?: string | null) {
    if (!clientId) {
      insightFeed = [];
      return;
    }

    feedLoading = true;
    message = '';
    error = '';

    try {
      const data: Insight[] = await api.insights.list({ clientId, limit: 100 });
      insightFeed = data;
    } catch (err: any) {
      error = err?.message || 'Unable to load insights.';
    } finally {
      feedLoading = false;
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedClientId) return;

    if (!canCreateInsights) {
      error = 'Your role cannot submit insights.';
      return;
    }

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

      message = 'Insight Sent and saved. Awaiting approval.';
      createForm = { projectId: '', stakeholderId: '', rawText: '' };
      await loadInsights(selectedClientId);
    } catch (err: any) {
      error = err?.message || 'Unable to create insight.';
    } finally {
      submitting = false;
    }
  }

  async function handleApprove(insightId: string) {
    message = '';
    error = '';
    approvingId = insightId;

    try {
      const response = await api.insights.approve(insightId);
      message = response.batchTriggered
        ? 'Insight approved and automation triggered.'
        : 'Insight approved.';

      insightFeed = insightFeed.map((insight) =>
        insight.id === insightId
          ? {
              ...insight,
              status: 'approved',
              // preserve other fields
            }
          : insight
      );
    } catch (err: any) {
      error = err?.message || 'Unable to approve insight.';
    } finally {
      approvingId = null;
    }
  }

  $effect(() => {
    if (selectedClientId) {
      createForm.projectId = '';
      createForm.stakeholderId = '';
      loadClientContext(selectedClientId);
      loadInsights(selectedClientId);
    } else {
      insightFeed = [];
    }
  });

  onMount(loadClients);

  function getInitials(fullName?: string | null, email?: string | null) {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
      return initials || fullName.charAt(0).toUpperCase();
    }
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  }

  function parseThemes(themes?: string | null) {
    if (!themes) return [];
    if (themes.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(themes);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return themes.split(',').map((item) => item.trim()).filter(Boolean);
  }
</script>

<section class="space-y-6">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Insights</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Capture consultant intelligence and trigger AI Enrichment
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
    <div class="xl:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Insight Stream</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Everyone on the same client sees the same feed in real time.
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onclick={() => loadInsights(selectedClientId)}
          disabled={feedLoading}
        >
          Refresh
        </button>
      </div>

      <div class="flex-1 overflow-y-auto pr-1 space-y-4 max-h-128">
        {#if feedLoading}
          {#each Array(4) as _}
            <div class="flex gap-3">
              <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
              <div class="flex-1 rounded-2xl bg-gray-50 dark:bg-gray-800/70 h-24 animate-pulse"></div>
            </div>
          {/each}
        {:else if !insightFeed.length}
          <div class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No insights yet for this client. Capture one using the form on the right.
          </div>
        {:else}
          {#each insightFeed as insight}
            <div class="flex gap-3 items-start">
              <div class="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                {getInitials(insight.author?.fullName, insight.author?.email)}
              </div>
              <div class="flex-1 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-4 space-y-2">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">
                      {insight.author?.fullName || insight.author?.email || 'Unknown teammate'}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {timestampFormatter.format(new Date(insight.createdAt))}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      class={`text-xs font-semibold uppercase tracking-wide ${
                        insight.status === 'approved'
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {insight.status}
                    </span>
                    <button
                      class={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        insight.status === 'approved'
                          ? 'border-gray-300 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                          : 'border-emerald-500 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                      }`}
                      title="Approve insight"
                      onclick={() => handleApprove(insight.id)}
                      disabled={insight.status === 'approved' || approvingId === insight.id}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      {approvingId === insight.id ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </div>

                {#if insight.summary}
                  <p class="text-sm text-gray-900 dark:text-gray-100">{insight.summary}</p>
                {/if}

                <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                  {insight.rawText}
                </p>

                {#if parseThemes(insight.themes).length}
                  <div class="flex flex-wrap gap-2">
                    {#each parseThemes(insight.themes) as theme}
                      <span class="text-xs px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200">
                        {theme}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    {#if canCreateInsights}
      <div class="space-y-6">
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create Insight</h3>
          <form class="space-y-4" onsubmit={handleCreate}>
            <div class="grid grid-cols-1 gap-4">
              <div class="md:col-span-1">
                <label for="insight-client" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Client</label>
                <select
                  id="insight-client"
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
                <label for="insight-project" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Project</label>
                <select
                  id="insight-project"
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
                <label for="insight-stakeholder" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Stakeholder</label>
                <select
                  id="insight-stakeholder"
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
              <label for="insight-raw" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Raw notes</label>
              <textarea
                id="insight-raw"
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
              {submitting ? 'Sending...' : 'Send Insight'}
            </button>
          </form>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Approved insights every 5 submissions per client still auto-create opportunities and tasks.
          </p>
        </div>
      </div>
    {/if}
  </div>
</section>