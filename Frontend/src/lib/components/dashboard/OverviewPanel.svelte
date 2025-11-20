<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Campaign, Client, Opportunity } from '$lib/types';

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
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A9 9 0 116.582 9H20"/>
      </svg>
      Refresh
    </button>
  </div>

  {#if error}
    <div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <p class="text-sm text-gray-500 dark:text-gray-400">Clients</p>
      <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {loading ? '—' : stats.clients}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Active relationships being tracked
      </p>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <p class="text-sm text-gray-500 dark:text-gray-400">Approved Insights</p>
      <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {loading ? '—' : stats.approvedInsights}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Driving automation triggers
      </p>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <p class="text-sm text-gray-500 dark:text-gray-400">Opportunities</p>
      <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {loading ? '—' : stats.opportunities}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Across all revenue stages
      </p>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <p class="text-sm text-gray-500 dark:text-gray-400">Campaigns</p>
      <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {loading ? '—' : stats.campaigns}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Active field intelligence pulls
      </p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Clients</h3>
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Latest</span>
      </div>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          {/each}
        </div>
      {:else if recentClients.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No clients yet.</p>
      {:else}
        <ul class="space-y-4">
          {#each recentClients as client}
            <li class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{client.name}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{client.industry || '—'}</p>
              </div>
              <span class="rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-200">
                {client.approvedInsightsCount} insights
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Opportunities</h3>
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Top 5</span>
      </div>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          {/each}
        </div>
      {:else if recentOpportunities.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No opportunities yet.</p>
      {:else}
        <ul class="space-y-4">
          {#each recentOpportunities as opportunity}
            <li class="flex flex-col gap-1 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div class="flex items-center justify-between">
                <p class="font-medium text-gray-900 dark:text-white">{opportunity.title}</p>
                <span class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  {opportunity.stage}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Created {formatter.format(new Date(opportunity.createdAt))}
              </p>
              {#if opportunity.description}
                <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{opportunity.description}</p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Campaigns</h3>
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Active pull</span>
      </div>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          {/each}
        </div>
      {:else if recentCampaigns.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No campaigns yet.</p>
      {:else}
        <ul class="space-y-4">
          {#each recentCampaigns as campaign}
            <li class="flex flex-col gap-1 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div class="flex items-center justify-between">
                <p class="font-medium text-gray-900 dark:text-white">{campaign.topic}</p>
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {campaign.responseCount} responses
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Launched {formatter.format(new Date(campaign.createdAt))}
              </p>
              {#if campaign.description}
                <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {campaign.description}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>

