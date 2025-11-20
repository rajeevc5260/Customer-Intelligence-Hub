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
      <p class="text-xs text-gray-500 dark:text-gray-400">Track follow-up work from insights and opportunities</p>
    </div>
    <div class="flex items-center gap-2">
      <input
        class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2"
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
        class="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
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
    <div class="lg:col-span-2 space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead class="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Task
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Priority
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Due
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {#if loading}
                {#each Array(5) as _}
                  <tr>
                    <td colspan="4" class="px-5 py-4">
                      <div class="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                    </td>
                  </tr>
                {/each}
              {:else if tasks.length === 0}
                <tr>
                  <td colspan="4" class="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No tasks found.
                  </td>
                </tr>
              {:else}
                {#each tasks as task}
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td class="px-5 py-4">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">{task.title}</p>
                      {#if task.description}
                        <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {task.description}
                        </p>
                      {/if}
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Created {formatDate(task.createdAt)}
                      </p>
                    </td>
                    <td class="px-5 py-4">
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize {task.priority === 'high' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}">
                        {task.priority}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-xs text-gray-700 dark:text-gray-300">
                      {formatDate(task.dueDate)}
                    </td>
                    <td class="px-5 py-4">
                      <select
                        class="rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white py-1 px-2"
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
      </div>

      <div class="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3 shadow-sm">
        <span class="text-xs text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === 1 || loading}
            onclick={() => loadTasks(page - 1)}
          >
            Previous
          </button>
          <button
            class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === totalPages || loading}
            onclick={() => loadTasks(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm h-fit">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Create Task</h3>
      {#if canManageTasks}
        <form class="space-y-3" onsubmit={handleCreate}>
          <div>
            <label for="task-title" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Title</label>
            <input
              id="task-title"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              required
              bind:value={form.title}
            />
          </div>
          <div>
            <label for="task-description" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
            <textarea
              id="task-description"
              rows="2"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              bind:value={form.description}
            ></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="task-priority" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Priority</label>
              <select
                id="task-priority"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                bind:value={form.priority}
              >
                {#each priorityOptions as priority}
                  <option value={priority}>{priority}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="task-due-date" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Due date</label>
              <input
                id="task-due-date"
                type="date"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                bind:value={form.dueDate}
              />
            </div>
          </div>
          <div>
            <label for="task-assigned" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Assign to (user id)</label>
            <input
              id="task-assigned"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              bind:value={form.assignedTo}
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="task-insight" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Insight ID</label>
              <input
                id="task-insight"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                bind:value={form.insightId}
              />
            </div>
            <div>
              <label for="task-opportunity" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Opportunity ID</label>
              <input
                id="task-opportunity"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                bind:value={form.opportunityId}
              />
            </div>
          </div>
          <button
            type="submit"
            class="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Create Task'}
          </button>
        </form>
      {:else}
        <p class="text-xs text-gray-500 dark:text-gray-400">
          You can review current work, but only consultants, leaders, admins, or ops can create or assign tasks.
        </p>
      {/if}
    </div>
  </div>
</section>

