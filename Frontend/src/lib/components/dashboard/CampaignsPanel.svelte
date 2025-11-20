<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Campaign, CampaignResponse, Client } from '$lib/types';

  let campaigns = $state<Campaign[]>([]);
  let responses = $state<CampaignResponse[]>([]);
  let clients = $state<Client[]>([]);

  let loadingCampaigns = $state(true);
  let loadingResponses = $state(false);
  let submittingCampaign = $state(false);
  let submittingResponse = $state(false);
  let message = $state('');
  let error = $state('');

  let selectedCampaignId = $state<string | null>(null);

  let createForm = $state({
    topic: '',
    description: '',
    questions: '',
    audience: ''
  });

  let responseForm = $state({
    clientId: '',
    rawResponse: ''
  });

  async function loadCampaigns() {
    loadingCampaigns = true;
    message = '';
    error = '';

    try {
      const data = await api.campaigns.list();
      campaigns = data;
      if (!selectedCampaignId && data.length) {
        selectedCampaignId = data[data.length - 1].id;
        await loadResponses(selectedCampaignId);
      }
    } catch (err: any) {
      error = err?.message || 'Unable to load campaigns.';
    } finally {
      loadingCampaigns = false;
    }
  }

  async function loadResponses(campaignId: string) {
    if (!campaignId) return;
    loadingResponses = true;
    message = '';
    error = '';

    try {
      const data = await api.campaigns.responses(campaignId);
      responses = data;
    } catch (err: any) {
      // Some roles cannot view responses; show soft message
      responses = [];
      error = err?.message || 'Unable to load responses (requires leader/admin role).';
    } finally {
      loadingResponses = false;
    }
  }

  async function loadClients() {
    try {
      const res = await api.clients.list(1, 100);
      clients = res.data;
      if (!responseForm.clientId && res.data.length) {
        responseForm.clientId = res.data[0].id;
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelectCampaign(id: string) {
    selectedCampaignId = id;
    loadResponses(id);
  }

  async function handleCreateCampaign(event: SubmitEvent) {
    event.preventDefault();
    submittingCampaign = true;
    message = '';
    error = '';

    try {
      const payload = {
        topic: createForm.topic,
        description: createForm.description || undefined,
        questions: createForm.questions
          ? createForm.questions
              .split('\n')
              .map((q) => q.trim())
              .filter(Boolean)
          : undefined,
        audienceUserIds: createForm.audience
          ? createForm.audience
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
          : undefined
      };

      await api.campaigns.create(payload);
      message = 'Campaign launched.';
      createForm = { topic: '', description: '', questions: '', audience: '' };
      await loadCampaigns();
    } catch (err: any) {
      error = err?.message || 'Unable to create campaign.';
    } finally {
      submittingCampaign = false;
    }
  }

  async function handleRespond(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedCampaignId) {
      error = 'Select a campaign first.';
      return;
    }

    submittingResponse = true;
    message = '';
    error = '';

    try {
      const response = await api.campaigns.respond(selectedCampaignId, {
        rawResponse: responseForm.rawResponse,
        clientId: responseForm.clientId
      });
      message = response.batchTriggered
        ? 'Response submitted. Batch automation triggered!'
        : 'Response submitted.';
      responseForm = { clientId: responseForm.clientId, rawResponse: '' };
      await loadCampaigns();
      await loadResponses(selectedCampaignId);
    } catch (err: any) {
      error = err?.message || 'Unable to submit response.';
    } finally {
      submittingResponse = false;
    }
  }

  function getQuestionCount(questions: string | null) {
    if (!questions) return 0;
    try {
      const parsed = JSON.parse(questions);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  function getThemes(themes: string | null) {
    if (!themes) return [];
    try {
      const parsed = JSON.parse(themes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  onMount(() => {
    loadCampaigns();
    loadClients();
  });
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Campaigns</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Launch pull campaigns and capture consultant responses
      </p>
    </div>
    <button
      class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onclick={loadCampaigns}
    >
      Refresh
    </button>
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
    <div class="xl:col-span-2 space-y-6">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Campaigns</h3>
        {#if loadingCampaigns}
          <div class="space-y-3">
            {#each Array(3) as _}
              <div class="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
            {/each}
          </div>
        {:else if campaigns.length === 0}
          <p class="text-sm text-gray-500 dark:text-gray-400">No campaigns yet.</p>
        {:else}
          <div class="space-y-4">
            {#each [...campaigns].reverse() as campaign}
              <button
                class="w-full text-left rounded-2xl border px-4 py-3 transition-colors {selectedCampaignId === campaign.id ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'}"
                onclick={() => handleSelectCampaign(campaign.id)}
              >
                <div class="flex items-center justify-between">
                  <p class="font-semibold text-gray-900 dark:text-white">{campaign.topic}</p>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {#if campaign.description}
                  <p class="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                    {campaign.description}
                  </p>
                {/if}
                <div class="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{campaign.responseCount} responses</span>
                  <span>Questions: {getQuestionCount(campaign.questions)}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Responses</h3>
          {#if selectedCampaignId}
            <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Campaign #{selectedCampaignId.slice(0, 6)}...
            </span>
          {/if}
        </div>

        {#if loadingResponses}
          <div class="space-y-3">
            {#each Array(3) as _}
              <div class="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
            {/each}
          </div>
        {:else if responses.length === 0}
          <p class="text-sm text-gray-500 dark:text-gray-400">
            No responses available or access restricted.
          </p>
        {:else}
          <div class="space-y-4 max-h-[28rem] overflow-y-auto pr-2">
            {#each responses as response}
              <div class="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-2">
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Responder: {response.userId.slice(0, 6)}...</span>
                  <span>{new Date(response.createdAt).toLocaleString()}</span>
                </div>
                {#if response.summary}
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{response.summary}</p>
                {/if}
                <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {response.rawResponse}
                </p>
                {#if getThemes(response.extractedThemes).length}
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Themes: {getThemes(response.extractedThemes).join(', ')}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Launch Campaign</h3>
        <form class="space-y-4" onsubmit={handleCreateCampaign}>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Topic</label>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
              bind:value={createForm.topic}
            />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
            <textarea
              rows="2"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.description}
            ></textarea>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Questions (one per line)</label>
            <textarea
              rows="3"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={createForm.questions}
            ></textarea>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Audience user IDs (comma separated)</label>
            <input
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
              bind:value={createForm.audience}
            />
          </div>
          <button
            type="submit"
            class="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            disabled={submittingCampaign}
          >
            {submittingCampaign ? 'Launching...' : 'Create Campaign'}
          </button>
        </form>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Submit Response</h3>
        <form class="space-y-4" onsubmit={handleRespond}>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Client</label>
            <select
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
              bind:value={responseForm.clientId}
            >
              <option value="" disabled>Select client</option>
              {#each clients as client}
                <option value={client.id}>{client.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Raw response</label>
            <textarea
              rows="4"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
              bind:value={responseForm.rawResponse}
            ></textarea>
          </div>
          <button
            type="submit"
            class="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            disabled={submittingResponse}
          >
            {submittingResponse ? 'Submitting...' : 'Send Response'}
          </button>
        </form>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Every 5th response per campaign triggers AI promotion into opportunities & tasks.
        </p>
      </div>
    </div>
  </div>
</section>

