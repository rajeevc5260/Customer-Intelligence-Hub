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
  let updatingStatus = $state<string | null>(null);
  let deletingCampaign = $state<string | null>(null);
  let showDeleteConfirm = $state(false);
  let campaignToDelete = $state<string | null>(null);
  let message = $state('');
  let error = $state('');
  let expandedQuestions = $state<Set<string>>(new Set());

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
  const canManageCampaigns = $derived(['manager', 'leader', 'admin'].includes(userRole));
  // Only consultants can submit responses
  const canRespond = $derived(userRole === 'consultant');
  // Leaders can see all responses, managers see only their campaigns' responses, consultants see only their own
  const canViewResponses = $derived(['leader', 'manager', 'consultant'].includes(userRole));
  // Leaders/admins can update/delete all campaigns, managers can only update/delete their own
  const canUpdateCampaign = $derived((campaign: Campaign) => {
    if (userRole === 'leader' || userRole === 'admin') return true;
    if (userRole === 'manager' && campaign.createdBy === userId) return true;
    return false;
  });

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

  function toggleQuestions(campaignId: string, event: Event) {
    event.stopPropagation();
    const newSet = new Set(expandedQuestions);
    if (newSet.has(campaignId)) {
      newSet.delete(campaignId);
    } else {
      newSet.add(campaignId);
    }
    expandedQuestions = newSet;
  }

  function getQuestionsList(questions: string | null): string[] {
    if (!questions) return [];
    try {
      const parsed = JSON.parse(questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function handleUpdateStatus(campaignId: string, newStatus: string, event: Event) {
    event.stopPropagation();
    if (!canUpdateCampaign(campaigns.find(c => c.id === campaignId)!)) {
      error = 'You do not have permission to update this campaign.';
      return;
    }

    updatingStatus = campaignId;
    message = '';
    error = '';

    try {
      await api.campaigns.updateStatus(campaignId, newStatus);
      message = 'Campaign status updated successfully.';
      await loadCampaigns();
    } catch (err: any) {
      error = err?.message || 'Unable to update campaign status.';
    } finally {
      updatingStatus = null;
    }
  }

  function openDeleteConfirm(campaignId: string, event: Event) {
    event.stopPropagation();
    campaignToDelete = campaignId;
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    campaignToDelete = null;
  }

  async function handleDeleteCampaign() {
    if (!campaignToDelete) return;

    if (!canUpdateCampaign(campaigns.find(c => c.id === campaignToDelete)!)) {
      error = 'You do not have permission to delete this campaign.';
      closeDeleteConfirm();
      return;
    }

    deletingCampaign = campaignToDelete;
    message = '';
    error = '';

    try {
      await api.campaigns.delete(campaignToDelete);
      message = 'Campaign deleted successfully.';
      if (selectedCampaignId === campaignToDelete) {
        selectedCampaignId = null;
        responses = [];
      }
      await loadCampaigns();
      closeDeleteConfirm();
    } catch (err: any) {
      error = err?.message || 'Unable to delete campaign.';
    } finally {
      deletingCampaign = null;
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
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Campaigns</h3>
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
              <div
                class="rounded-lg border px-4 py-3 transition-all {selectedCampaignId === campaign.id ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20 shadow-sm' : 'border-gray-200 dark:border-gray-800'}"
              >
                <div class="flex items-start justify-between gap-2">
                  <button
                    class="flex-1 text-left"
                    onclick={() => handleSelectCampaign(campaign.id)}
                  >
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">{campaign.topic}</p>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {
                        campaign.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }">
                        {campaign.status}
                      </span>
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
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
                  {#if canUpdateCampaign(campaign)}
                    <div class="flex items-center gap-1 shrink-0">
                      <select
                        class="text-xs rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-2 py-1 w-20"
                        value={campaign.status}
                        onchange={(e) => handleUpdateStatus(campaign.id, (e.target as HTMLSelectElement).value, e)}
                        disabled={updatingStatus === campaign.id}
                        onclick={(e) => e.stopPropagation()}
                      >
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button
                        class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                        onclick={(e) => openDeleteConfirm(campaign.id, e)}
                        disabled={deletingCampaign === campaign.id}
                        title="Delete campaign"
                        type="button"
                      >
                        {#if deletingCampaign === campaign.id}
                          <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                        {:else}
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        {/if}
                      </button>
                    </div>
                  {/if}
                </div>
                {#if getQuestionCount(campaign.questions) > 0}
                  <div class="mt-2 flex justify-end">
                    <button
                      class="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                      onclick={(e) => toggleQuestions(campaign.id, e)}
                      title={expandedQuestions.has(campaign.id) ? 'Hide questions' : 'Show questions'}
                    >
                      {expandedQuestions.has(campaign.id) ? 'Hide' : 'Show'} questions
                    </button>
                  </div>
                {/if}
                {#if expandedQuestions.has(campaign.id) && getQuestionCount(campaign.questions) > 0}
                  <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Questions:</p>
                    <ul class="space-y-1.5">
                      {#each getQuestionsList(campaign.questions) as question}
                        <li class="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                          <span class="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                          <span>{question}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
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

  {#if showDeleteConfirm}
    <div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div class="flex min-h-screen items-center justify-center p-4">
        <div 
          class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
          role="button"
          tabindex="0"
          onclick={closeDeleteConfirm}
          onkeydown={(e) => e.key === 'Escape' && closeDeleteConfirm()}
        ></div>
        
        <div 
          class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Campaign</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
            </div>
            <button
              onclick={closeDeleteConfirm}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close dialog"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {#if campaignToDelete}
            {@const campaign = campaigns.find(c => c.id === campaignToDelete)}
            {#if campaign}
              <div class="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{campaign.topic}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {campaign.responseCount} response{campaign.responseCount !== 1 ? 's' : ''} will be deleted
                </p>
              </div>
            {/if}
          {/if}

          <p class="text-sm text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to delete this campaign? This will permanently remove the campaign, all responses, and all associated data. This action cannot be undone.
          </p>

          <div class="flex items-center justify-end gap-3">
            <button
              onclick={closeDeleteConfirm}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onclick={handleDeleteCampaign}
              disabled={deletingCampaign !== null}
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deletingCampaign ? 'Deleting...' : 'Delete Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>

