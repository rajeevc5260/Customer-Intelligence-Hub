<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { Client, Insight, Project, Stakeholder } from '$lib/types';

  let clients = $state<Client[]>([]);
  let viewingClientId = $state<string | null>(null); // Client whose updates are shown in feed
  let selectedClientId = $state<string | null>(null); // Client selected in form for creating updates
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
  let feedLoading = $state(false);

  let insightFeed = $state<Insight[]>([]);
  let lastLoadedContext = $state<string | null>(null);

  const userRole = $derived(authStore.user?.role ?? 'member');
  const canCreateUpdates = $derived(userRole === 'consultant');

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
        viewingClientId = res.data[0].id;
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
      error = err?.message || 'Unable to load updates.';
    } finally {
      feedLoading = false;
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedClientId) return;

    if (!canCreateUpdates) {
      error = 'Your role cannot submit updates.';
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

      message = 'Update submitted successfully.';
      createForm = { projectId: '', stakeholderId: '', rawText: '' };
      // Reload the viewing client's feed if it matches the created update's client
      if (viewingClientId === selectedClientId) {
        await loadInsights(viewingClientId);
      }
    } catch (err: any) {
      error = err?.message || 'Unable to create update.';
    } finally {
      submitting = false;
    }
  }

  async function handleViewingClientChange(newClientId: string) {
    viewingClientId = newClientId;
    await loadInsights(viewingClientId);
  }

  // Effect for viewing client - controls the feed
  $effect(() => {
    if (viewingClientId) {
      loadInsights(viewingClientId);
    } else {
      insightFeed = [];
    }
  });

  // Effect for form client - only loads context for creating updates
  $effect(() => {
    if (selectedClientId) {
      createForm.projectId = '';
      createForm.stakeholderId = '';
      loadClientContext(selectedClientId);
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
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Updates</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Share inputs, news, and updates from client interactions and field work
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
    <div class="xl:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm flex flex-col gap-4 {canCreateUpdates ? 'xl:col-span-2' : 'xl:col-span-3'}">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Updates Feed</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Everyone on the same client sees the same feed in real time.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <select
            class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-28"
            bind:value={viewingClientId}
            onchange={(e) => handleViewingClientChange((e.target as HTMLSelectElement).value)}
            disabled={loadingClients || feedLoading}
          >
            {#if loadingClients}
              <option>Loading...</option>
            {:else if clients.length === 0}
              <option>No clients</option>
            {:else}
              {#each clients as client}
                <option value={client.id}>{client.name}</option>
              {/each}
            {/if}
          </select>
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onclick={() => loadInsights(viewingClientId)}
            disabled={feedLoading || !viewingClientId}
          >
            Refresh
          </button>
        </div>
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
            {#if viewingClientId}
              No updates yet for {clients.find(c => c.id === viewingClientId)?.name || 'this client'}. Share one using the form on the right.
            {:else}
              Select a client to view updates.
            {/if}
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

    {#if canCreateUpdates}
      <div class="space-y-6">
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Share Update</h3>
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
              <label for="insight-raw" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Update Details</label>
              <textarea
                id="insight-raw"
                rows="6"
                class="w-full rounded-2xl border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Share news, updates, call notes, or any relevant information..."
                required
                bind:value={createForm.rawText}
              ></textarea>
            </div>

            <button
              type="submit"
              class="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              disabled={submitting || !selectedClientId}
            >
              {submitting ? 'Submitting...' : 'Share Update'}
            </button>
          </form>
        </div>
      </div>
    {/if}
  </div>
</section>