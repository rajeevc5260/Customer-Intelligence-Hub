<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Client, Project, Stakeholder } from '$lib/types';

  let loadingClients = $state(true);
  let loadingRelations = $state(false);
  let message = $state('');
  let error = $state('');

  let clients = $state<Client[]>([]);
  let selectedClientId = $state<string | null>(null);

  let stakeholders = $state<Stakeholder[]>([]);
  let projects = $state<Project[]>([]);

  let stakeholderForm = $state({
    name: '',
    role: '',
    email: '',
    notes: ''
  });

  let projectForm = $state({
    name: '',
    description: '',
    status: 'active'
  });

  async function loadClients() {
    loadingClients = true;
    try {
      const res = await api.clients.list(1, 100);
      clients = res.data;
      if (!selectedClientId && res.data.length > 0) {
        selectedClientId = res.data[0].id;
        await loadRelations(res.data[0].id);
      }
    } catch (err: any) {
      error = err?.message || 'Unable to load clients.';
    } finally {
      loadingClients = false;
    }
  }

  async function loadRelations(clientId: string) {
    if (!clientId) return;
    loadingRelations = true;
    message = '';
    error = '';

    try {
      const [stakeholderRes, projectRes] = await Promise.all([
        api.stakeholders.byClient(clientId),
        api.projects.byClient(clientId)
      ]);

      stakeholders = stakeholderRes;
      projects = projectRes;
    } catch (err: any) {
      error = err?.message || 'Unable to load client relationships.';
    } finally {
      loadingRelations = false;
    }
  }

  function handleClientChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    selectedClientId = value;
    loadRelations(value);
  }

  async function handleStakeholderSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedClientId) return;
    message = '';
    error = '';

    try {
      await api.stakeholders.create({
        clientId: selectedClientId,
        name: stakeholderForm.name,
        role: stakeholderForm.role || undefined,
        email: stakeholderForm.email || undefined,
        notes: stakeholderForm.notes || undefined
      });
      message = 'Stakeholder added.';
      stakeholderForm = { name: '', role: '', email: '', notes: '' };
      await loadRelations(selectedClientId);
    } catch (err: any) {
      error = err?.message || 'Unable to create stakeholder.';
    }
  }

  async function handleProjectSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedClientId) return;
    message = '';
    error = '';

    try {
      await api.projects.create({
        clientId: selectedClientId,
        name: projectForm.name,
        description: projectForm.description || undefined,
        status: projectForm.status
      });
      message = 'Project added.';
      projectForm = { name: '', description: '', status: 'active' };
      await loadRelations(selectedClientId);
    } catch (err: any) {
      error = err?.message || 'Unable to create project.';
    }
  }

  onMount(loadClients);
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Relationships</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Stakeholders and projects linked to each client
      </p>
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

  <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
    <label class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
      Select Client
    </label>
    <select
      class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
      disabled={loadingClients}
      oninput={handleClientChange}
    >
      {#if loadingClients}
        <option>Loading...</option>
      {:else if clients.length === 0}
        <option>No clients found</option>
      {:else}
        {#each clients as client}
          <option selected={client.id === selectedClientId} value={client.id}>
            {client.name}
          </option>
        {/each}
      {/if}
    </select>
  </div>

  {#if loadingRelations}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {#each Array(2) as _}
        <div class="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if !selectedClientId}
    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Select a client to review their relationships.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Stakeholders Section -->
      <div class="space-y-4">
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">Stakeholders</h3>
            <span class="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              {stakeholders.length}
            </span>
          </div>
          <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
            {#if stakeholders.length === 0}
              <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No stakeholders yet.</p>
            {:else}
              {#each stakeholders as stakeholder}
                <div class="rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{stakeholder.name}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {stakeholder.role || 'Role not set'}
                  </p>
                  {#if stakeholder.email}
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{stakeholder.email}</p>
                  {/if}
                  {#if stakeholder.notes}
                    <p class="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">
                      {stakeholder.notes}
                    </p>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">Add Stakeholder</h4>
          <form class="space-y-3" onsubmit={handleStakeholderSubmit}>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Full name"
              required
              bind:value={stakeholderForm.name}
            />
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Role / title"
              bind:value={stakeholderForm.role}
            />
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Email"
              type="email"
              bind:value={stakeholderForm.email}
            />
            <textarea
              rows="2"
              placeholder="Notes"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              bind:value={stakeholderForm.notes}
            ></textarea>
            <button
              type="submit"
              class="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Save Stakeholder
            </button>
          </form>
        </div>
      </div>

      <!-- Projects Section -->
      <div class="space-y-4">
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">Projects</h3>
            <span class="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {projects.length}
            </span>
          </div>
          <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
            {#if projects.length === 0}
              <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No projects yet.</p>
            {:else}
              {#each projects as project}
                <div class="rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white flex-1">{project.name}</p>
                    <span class="text-xs uppercase font-semibold tracking-wide text-indigo-600 dark:text-indigo-300 whitespace-nowrap">
                      {project.status}
                    </span>
                  </div>
                  {#if project.description}
                    <p class="text-xs text-gray-600 dark:text-gray-300 mt-1.5 line-clamp-2">
                      {project.description}
                    </p>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">Add Project</h4>
          <form class="space-y-3" onsubmit={handleProjectSubmit}>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Project name"
              required
              bind:value={projectForm.name}
            />
            <textarea
              rows="2"
              placeholder="Description"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              bind:value={projectForm.description}
            ></textarea>
            <select
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              bind:value={projectForm.status}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <button
              type="submit"
              class="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Save Project
            </button>
          </form>
        </div>
      </div>
    </div>
  {/if}
</section>

