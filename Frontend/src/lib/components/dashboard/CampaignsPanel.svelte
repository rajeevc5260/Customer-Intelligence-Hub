<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { authStore } from '$lib/stores/auth.svelte';
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
  let responsesInfo = $state('');

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

  const userRole = $derived(authStore.user?.role ?? 'member');
  const userId = $derived(authStore.user?.id ?? null);
  // Only manager and leader can launch campaigns
  const canManageCampaigns = $derived(['manager', 'leader'].includes(userRole));
  // Only consultants can submit responses
  const canRespond = $derived(userRole === 'consultant');
  // Leaders can see all responses, managers see only their campaigns' responses, consultants see only their own
  const canViewResponses = $derived(['leader', 'manager', 'consultant'].includes(userRole));

  async function loadCampaigns() {
    loadingCampaigns = true;
    message = '';
    error = '';

    try {
      const data = await api.campaigns.list();
      campaigns = data;
      if (!selectedCampaignId && data.length) {
        const lastCampaignId = data[data.length - 1].id;
        selectedCampaignId = lastCampaignId;
        await loadResponses(lastCampaignId);
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

    if (!canViewResponses) {
      responses = [];
      responsesInfo = 'Your role cannot view responses.';
      loadingResponses = false;
      return;
    }

    try {
      const data = await api.campaigns.responses(campaignId);
      
      // Filter responses based on role
      if (userRole === 'consultant') {
        // Consultants see only their own responses
        responses = data.filter((r: any) => r.userId === userId);
        responsesInfo = responses.length === 0 
          ? 'You have not submitted any responses to this campaign yet.'
          : '';
      } else if (userRole === 'manager') {
        // Managers see only responses from campaigns they created
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign && campaign.createdBy === userId) {
          responses = data;
          responsesInfo = '';
        } else {
          responses = [];
          responsesInfo = 'You can only view responses for campaigns you created.';
        }
      } else if (userRole === 'leader') {
        // Leaders see everything
        responses = data;
        responsesInfo = '';
      } else {
        responses = [];
        responsesInfo = 'Your role cannot view responses.';
      }
    } catch (err: any) {
      responses = [];
      responsesInfo = err?.message || 'Unable to load responses.';
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
    if (!canManageCampaigns) {
      error = 'Your role cannot launch campaigns.';
      return;
    }
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
    if (!canRespond) {
      error = 'Your role cannot submit campaign responses.';
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
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Launch pull campaigns and capture consultant responses
      </p>
    </div>
    <button
      class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Active Campaigns</h3>
          <span class="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            {campaigns.length}
          </span>
        </div>
        {#if loadingCampaigns}
          <div class="space-y-2">
            {#each Array(3) as _}
              <div class="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
            {/each}
          </div>
        {:else if campaigns.length === 0}
          <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No campaigns yet.</p>
        {:else}
          <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
            {#each [...campaigns].reverse() as campaign}
              <button
                class="w-full text-left rounded-lg border px-4 py-3 transition-all {selectedCampaignId === campaign.id ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20 shadow-sm' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-700'}"
                onclick={() => handleSelectCampaign(campaign.id)}
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white flex-1">{campaign.topic}</p>
                  <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {#if campaign.description}
                  <p class="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                    {campaign.description}
                  </p>
                {/if}
                <div class="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span class="inline-flex items-center gap-1">
                    <span class="font-semibold text-indigo-600 dark:text-indigo-400">{campaign.responseCount}</span>
                    responses
                  </span>
                  <span>•</span>
                  <span>{getQuestionCount(campaign.questions)} questions</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Responses</h3>
          {#if selectedCampaignId}
            <span class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              #{selectedCampaignId.slice(0, 8)}
            </span>
          {/if}
        </div>

        {#if loadingResponses}
          <div class="space-y-2">
            {#each Array(3) as _}
              <div class="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
            {/each}
          </div>
        {:else if !canViewResponses || responses.length === 0}
          <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
            {responsesInfo || 'No responses available to view.'}
          </p>
        {:else if responses.length === 0}
          <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
            {responsesInfo || 'No responses captured yet.'}
          </p>
        {:else}
          <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
            {#each responses as response}
              <div class="rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span class="font-medium">User: {response.userId.slice(0, 8)}</span>
                  <span>{new Date(response.createdAt).toLocaleDateString()}</span>
                </div>
                {#if response.summary}
                  <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{response.summary}</p>
                {/if}
                <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                  {response.rawResponse}
                </p>
                {#if getThemes(response.extractedThemes).length}
                  <div class="flex flex-wrap gap-1 mt-2">
                    {#each getThemes(response.extractedThemes) as theme}
                      <span class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                        {theme}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if canManageCampaigns}
      <div class="space-y-6">
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Launch Campaign</h3>
          <form class="space-y-3" onsubmit={handleCreateCampaign}>
            <div>
              <label for="campaign-topic" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Topic</label>
              <input
                id="campaign-topic"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                required
                bind:value={createForm.topic}
              />
            </div>
            <div>
              <label for="campaign-description" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
              <textarea
                id="campaign-description"
                rows="2"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                bind:value={createForm.description}
              ></textarea>
            </div>
            <div>
              <label for="campaign-questions" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Questions (one per line)</label>
              <textarea
                id="campaign-questions"
                rows="2"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                bind:value={createForm.questions}
              ></textarea>
            </div>
            <div>
              <label for="campaign-audience" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Audience user IDs (comma separated)</label>
              <input
                id="campaign-audience"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                bind:value={createForm.audience}
              />
            </div>
            <button
              type="submit"
              class="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              disabled={submittingCampaign}
            >
              {submittingCampaign ? 'Launching...' : 'Create Campaign'}
            </button>
          </form>
        </div>
      </div>
    {/if}

    {#if canRespond}
      <div class="space-y-6">
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Submit Response</h3>
          <form class="space-y-3" onsubmit={handleRespond}>
            <div>
              <label for="campaign-client" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Client</label>
              <select
                id="campaign-client"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
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
              <label for="campaign-raw-response" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Raw response</label>
              <textarea
                id="campaign-raw-response"
                rows="3"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                required
                bind:value={responseForm.rawResponse}
              ></textarea>
            </div>
            <button
              type="submit"
              class="w-full rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              disabled={submittingResponse}
            >
              {submittingResponse ? 'Submitting...' : 'Send Response'}
            </button>
          </form>
          <div class="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2">
            <p class="text-xs text-blue-700 dark:text-blue-300">
              💡 Every 5th response triggers AI promotion into opportunities & tasks
            </p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>

