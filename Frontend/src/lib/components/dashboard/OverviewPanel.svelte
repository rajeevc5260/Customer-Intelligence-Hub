<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Campaign, Client, Opportunity } from '$lib/types';

  interface Props {
    onNavigate?: (section: string) => void;
  }

  let { onNavigate }: Props = $props();

  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  let loading = $state(true);
  let error = $state('');

  let stats = $state({
    clients: 0,
    approvedInsights: 0,
    opportunities: 0,
    campaigns: 0
  });

  let recentClients = $state<Client[]>([]);
  let recentOpportunities = $state<Opportunity[]>([]);
  let recentCampaigns = $state<Campaign[]>([]);

  async function loadOverview() {
    loading = true;
    error = '';

    try {
      const [clientRes, opportunityRes, campaignRes] = await Promise.all([
        api.clients.list(1, 50),
        api.opportunities.list(1, 5),
        api.campaigns.list()
      ]);

      stats = {
        clients: clientRes.total,
        approvedInsights: clientRes.data.reduce(
          (sum: number, client: Client) => sum + (client.approvedInsightsCount ?? 0),
          0
        ),
        opportunities: opportunityRes.total,
        campaigns: Array.isArray(campaignRes) ? campaignRes.length : 0
      };

      recentClients = clientRes.data.slice(0, 5);
      recentOpportunities = opportunityRes.data.slice(0, 5);
      recentCampaigns = Array.isArray(campaignRes)
        ? [...campaignRes]
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .slice(0, 5)
        : [];
    } catch (err: any) {
      error = err?.message || 'Unable to load overview data.';
    } finally {
      loading = false;
    }
  }

  onMount(loadOverview);
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Overview</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Snapshot of client intelligence activity
      </p>
    </div>
    <button
      class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onclick={loadOverview}
    >
      Refresh
    </button>
  </div>

  {#if error}
    <div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <button
      onclick={() => onNavigate?.('clients')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Clients</p>
      <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {loading ? '—' : stats.clients}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Active relationships
      </p>
    </button>

    <button
      onclick={() => onNavigate?.('insights')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Updates</p>
      <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {loading ? '—' : stats.approvedInsights}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Automation triggers
      </p>
    </button>

    <button
      onclick={() => onNavigate?.('opportunities')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Insights</p>
      <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {loading ? '—' : stats.opportunities}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        All revenue stages
      </p>
    </button>

    <button
      onclick={() => onNavigate?.('campaigns')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Campaigns</p>
      <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {loading ? '—' : stats.campaigns}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Field intelligence
      </p>
    </button>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <button
      onclick={() => onNavigate?.('clients')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left flex flex-col h-fit"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Recent Clients</h3>
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Latest</span>
      </div>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          {/each}
        </div>
      {:else if recentClients.length === 0}
        <p class="text-xs text-gray-500 dark:text-gray-400">No clients yet.</p>
      {:else}
        <ul class="space-y-3">
          {#each recentClients as client}
            <li class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{client.name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{client.industry || '—'}</p>
              </div>
              <span class="rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-200 whitespace-nowrap">
                {client.approvedInsightsCount}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </button>

    <button
      onclick={() => onNavigate?.('opportunities')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Insights</h3>
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Top 5</span>
      </div>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          {/each}
        </div>
      {:else if recentOpportunities.length === 0}
        <p class="text-xs text-gray-500 dark:text-gray-400">No insights yet.</p>
      {:else}
        <ul class="space-y-3">
          {#each recentOpportunities as opportunity}
            <li class="flex flex-col gap-1 rounded-xl border border-gray-100 dark:border-gray-800 p-2.5">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{opportunity.title}</p>
                <span class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300 whitespace-nowrap">
                  {opportunity.stage}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {formatter.format(new Date(opportunity.createdAt))}
              </p>
              {#if opportunity.description}
                <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{opportunity.description}</p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </button>

    <button
      onclick={() => onNavigate?.('campaigns')}
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left h-fit"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Campaigns</h3>
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Active</span>
      </div>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          {/each}
        </div>
      {:else if recentCampaigns.length === 0}
        <p class="text-xs text-gray-500 dark:text-gray-400">No campaigns yet.</p>
      {:else}
        <ul class="space-y-3">
          {#each recentCampaigns as campaign}
            <li class="flex flex-col gap-1 rounded-xl border border-gray-100 dark:border-gray-800 p-2.5">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{campaign.topic}</p>
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {campaign.responseCount}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {formatter.format(new Date(campaign.createdAt))}
              </p>
              {#if campaign.description}
                <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                  {campaign.description}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </button>
  </div>
</section>

