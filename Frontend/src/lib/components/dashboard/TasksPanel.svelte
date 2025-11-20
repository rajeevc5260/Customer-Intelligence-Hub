<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { PaginatedResponse, Task } from '$lib/types';

  const statusOptions = ['open', 'in-progress', 'done'];
  const priorityOptions = ['low', 'medium', 'high'];

  let tasks = $state<Task[]>([]);
  let page = $state(1);
  let totalPages = $state(1);
  let search = $state('');

  let loading = $state(true);
  let submitting = $state(false);
  let updatingStatus = $state<string | null>(null);
  let message = $state('');
  let error = $state('');

  let form = $state({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    assignedTo: '',
    insightId: '',
    opportunityId: ''
  });

  const userRole = $derived(authStore.user?.role ?? 'member');
  const canManageTasks = $derived(['consultant', 'leader', 'admin', 'ops'].includes(userRole));

  async function loadTasks(pageNumber = 1) {
    loading = true;
    message = '';
    error = '';

    try {
      const response: PaginatedResponse<Task> = await api.tasks.list(pageNumber, 10, search);
      tasks = response.data;
      page = response.page;
      totalPages = response.totalPages;
    } catch (err: any) {
      error = err?.message || 'Unable to load tasks.';
    } finally {
      loading = false;
    }
  }

  async function handleSearch() {
    await loadTasks(1);
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!canManageTasks) {
      error = 'You do not have permission to create tasks.';
      return;
    }

    submitting = true;
    message = '';
    error = '';

    try {
      await api.tasks.create({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority || undefined,
        dueDate: form.dueDate || undefined,
        assignedTo: form.assignedTo || undefined,
        insightId: form.insightId || undefined,
        opportunityId: form.opportunityId || undefined
      });

      message = 'Task created successfully.';
      form = {
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assignedTo: '',
        insightId: '',
        opportunityId: ''
      };
      await loadTasks(page);
    } catch (err: any) {
      error = err?.message || 'Unable to create task.';
    } finally {
      submitting = false;
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    updatingStatus = taskId;
    message = '';
    error = '';

    try {
      await api.tasks.updateStatus(taskId, status);
      tasks = tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
    } catch (err: any) {
      error = err?.message || 'Unable to update status.';
    } finally {
      updatingStatus = null;
    }
  }

  onMount(() => {
    loadTasks();
  });

  function formatDate(value: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
  }
</script>

<section class="space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Tasks</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">Track follow-up work from insights and opportunities.</p>
    </div>
    <div class="flex items-center gap-2">
      <input
        class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        placeholder="Search tasks..."
        bind:value={search}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleSearch();
          }
        }}
      />
      <button
        class="rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-4 py-2 text-sm font-medium"
        onclick={handleSearch}
      >
        Search
      </button>
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

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Task
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Priority
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Due
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            {#if loading}
              {#each Array(5) as _}
                <tr>
                  <td colspan="4" class="px-4 py-3">
                    <div class="h-6 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                  </td>
                </tr>
              {/each}
            {:else if tasks.length === 0}
              <tr>
                <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No tasks found.
                </td>
              </tr>
            {:else}
              {#each tasks as task}
                <tr>
                  <td class="px-4 py-3">
                    <p class="font-semibold text-gray-900 dark:text-white">{task.title}</p>
                    {#if task.description}
                      <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {task.description}
                      </p>
                    {/if}
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Created {formatDate(task.createdAt)}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {task.priority}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {formatDate(task.dueDate)}
                  </td>
                  <td class="px-4 py-3">
                    <select
                      class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      bind:value={task.status}
                      disabled={updatingStatus === task.id}
                      oninput={(event) =>
                        handleStatusChange(task.id, (event.target as HTMLSelectElement).value)
                      }
                    >
                      {#each statusOptions as status}
                        <option value={status}>{status}</option>
                      {/each}
                    </select>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        <span>Page {page} of {totalPages}</span>
        <div class="flex items-center gap-3">
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40"
            disabled={page === 1 || loading}
            onclick={() => loadTasks(page - 1)}
          >
            Previous
          </button>
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40"
            disabled={page === totalPages || loading}
            onclick={() => loadTasks(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create Task</h3>
      {#if canManageTasks}
        <form class="space-y-4" onsubmit={handleCreate}>
          <div>
            <label for="task-title" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Title</label>
            <input
              id="task-title"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
              bind:value={form.title}
            />
          </div>
          <div>
            <label for="task-description" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
            <textarea
              id="task-description"
              rows="3"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={form.description}
            ></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="task-priority" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Priority</label>
              <select
                id="task-priority"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                bind:value={form.priority}
              >
                {#each priorityOptions as priority}
                  <option value={priority}>{priority}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="task-due-date" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Due date</label>
              <input
                id="task-due-date"
                type="date"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                bind:value={form.dueDate}
              />
            </div>
          </div>
          <div>
            <label for="task-assigned" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Assign to (user id)</label>
            <input
              id="task-assigned"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              bind:value={form.assignedTo}
            />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="task-insight" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Insight ID</label>
              <input
                id="task-insight"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                bind:value={form.insightId}
              />
            </div>
            <div>
              <label for="task-opportunity" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Opportunity ID</label>
              <input
                id="task-opportunity"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                bind:value={form.opportunityId}
              />
            </div>
          </div>
          <button
            type="submit"
            class="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Create Task'}
          </button>
        </form>
      {:else}
        <p class="text-sm text-gray-500 dark:text-gray-400">
          You can review current work, but only consultants, leaders, admins, or ops can create or assign tasks.
        </p>
      {/if}
    </div>
  </div>
</section>

