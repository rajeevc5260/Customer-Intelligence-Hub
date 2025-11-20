<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import Header from '$lib/components/Header.svelte';
  import InviteDialog from '$lib/components/InviteDialog.svelte';
  import OverviewPanel from '$lib/components/dashboard/OverviewPanel.svelte';
  import ClientsPanel from '$lib/components/dashboard/ClientsPanel.svelte';
  import RelationshipsPanel from '$lib/components/dashboard/RelationshipsPanel.svelte';
  import InsightsPanel from '$lib/components/dashboard/InsightsPanel.svelte';
  import OpportunitiesPanel from '$lib/components/dashboard/OpportunitiesPanel.svelte';
  import CampaignsPanel from '$lib/components/dashboard/CampaignsPanel.svelte';
  import TasksPanel from '$lib/components/dashboard/TasksPanel.svelte';

  let showInviteDialog = $state(false);
  let activeSection = $state('overview');

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients', label: 'Clients' },
    { id: 'relationships', label: 'Stakeholders & Projects' },
    { id: 'insights', label: 'Insights' },
    { id: 'opportunities', label: 'Opportunities' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'campaigns', label: 'Campaigns' }
  ];

  $effect(() => {
    if (!authStore.loading && !authStore.user) {
      goto('/auth');
    }
  });
</script>

{#if authStore.loading}
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
{:else if authStore.user}
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <Header />
    <InviteDialog bind:isOpen={showInviteDialog} />

    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="space-y-6">
        <div class="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <div class="flex flex-col gap-4">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Welcome back</p>
              <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
                {authStore.user.fullName || authStore.user.email}!
              </h2>
              <div class="mt-4 flex items-start gap-3">
                <div class="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 flex-1">
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Email</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-white break-all">
                    {authStore.user.email}
                  </p>
                </div>
                <div class="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 flex-1">
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Role</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {authStore.user.role}
                  </p>
                </div>
              </div>
              <div class="mt-4 flex items-center justify-end">
                {#if authStore.user.role === 'admin'}
                  <button
                    onclick={() => showInviteDialog = true}
                    class="rounded-lg bg-indigo-600 text-white px-4 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Invite teammate
                  </button>
                {/if}
              </div>
            </div>
            <!-- <div class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50">
              <p class="font-medium text-gray-900 dark:text-white mb-1">How to use this hub</p>
              <p>Use the sections below to manage clients, enrich insights, track opportunities, and run field campaigns in one place.</p>
            </div> -->
          </div>
        </div>

        <div class="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm overflow-x-auto">
          <div class="flex items-center gap-2 min-w-max">
            {#each sections as section}
              <button
                class="px-4 py-2 rounded-2xl text-sm font-medium transition-colors {activeSection === section.id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
                onclick={() => activeSection = section.id}
              >
                {section.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="space-y-6">
          {#if activeSection === 'overview'}
            <OverviewPanel onNavigate={(section) => activeSection = section} />
          {:else if activeSection === 'clients'}
            <ClientsPanel />
          {:else if activeSection === 'relationships'}
            <RelationshipsPanel />
          {:else if activeSection === 'insights'}
            <InsightsPanel />
          {:else if activeSection === 'opportunities'}
            <OpportunitiesPanel />
          {:else if activeSection === 'campaigns'}
            <CampaignsPanel />
          {:else if activeSection === 'tasks'}
            <TasksPanel />
          {/if}
        </div>
      </div>
    </main>
  </div>
{/if}