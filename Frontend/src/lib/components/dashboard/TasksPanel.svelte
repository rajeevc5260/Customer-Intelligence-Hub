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
  let users = $state<Map<string, { fullName: string | null; email: string; role: string }>>(new Map());
  let expandedTaskId = $state<string | null>(null);

  let loading = $state(true);
  let submitting = $state(false);
  let updatingStatus = $state<string | null>(null);
  let deletingTask = $state<string | null>(null);
  let showDeleteConfirm = $state(false);
  let taskToDelete = $state<string | null>(null);
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
  const canDeleteTasks = $derived(['leader', 'admin', 'manager'].includes(userRole));

  async function loadTasks(pageNumber = 1) {
    loading = true;
    message = '';
    error = '';

    try {
      const response: PaginatedResponse<Task> = await api.tasks.list(pageNumber, 10, search);
      tasks = response.data;
      page = response.page;
      totalPages = response.totalPages;
      
      // Fetch user details for assigned tasks
      const userIds = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean))];
      await Promise.all(
        userIds.map(async (userId) => {
          if (userId && !users.has(userId)) {
            try {
              const user = await api.users.getById(userId);
              users.set(userId, { fullName: user.fullName, email: user.email, role: user.role });
            } catch {
              // Ignore errors for individual users
            }
          }
        })
      );
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

  function getUserInfo(userId: string | null) {
    if (!userId) return null;
    return users.get(userId);
  }

  function getInitials(fullName?: string | null, email?: string | null) {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
      return initials || fullName.charAt(0).toUpperCase();
    }
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  }

  function toggleExpanded(taskId: string) {
    expandedTaskId = expandedTaskId === taskId ? null : taskId;
  }

  function openDeleteConfirm(taskId: string) {
    taskToDelete = taskId;
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    taskToDelete = null;
  }

  async function handleDelete() {
    if (!taskToDelete) return;

    if (!canDeleteTasks) {
      error = 'You do not have permission to delete tasks.';
      closeDeleteConfirm();
      return;
    }

    deletingTask = taskToDelete;
    message = '';
    error = '';

    try {
      await api.tasks.delete(taskToDelete);
      message = 'Task deleted successfully.';
      if (expandedTaskId === taskToDelete) {
        expandedTaskId = null;
      }
      await loadTasks(page);
      closeDeleteConfirm();
    } catch (err: any) {
      error = err?.message || 'Unable to delete task.';
    } finally {
      deletingTask = null;
    }
  }
</script>

<section class="space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Tasks</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">Track follow-up work from updates and insights</p>
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
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Assigned
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
                    <td colspan="5" class="px-5 py-4">
                      <div class="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                    </td>
                  </tr>
                {/each}
              {:else if tasks.length === 0}
                <tr>
                  <td colspan="5" class="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No tasks found.
                  </td>
                </tr>
              {:else}
                {#each tasks as task}
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onclick={() => toggleExpanded(task.id)}>
                    <td class="px-5 py-4">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">{task.title}</p>
                      {#if task.description && expandedTaskId !== task.id}
                        <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      {/if}
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Created {formatDate(task.createdAt)}
                      </p>
                    </td>
                    <td class="px-5 py-4">
                      {#if task.assignedTo}
                        {@const userInfo = getUserInfo(task.assignedTo)}
                        {#if userInfo}
                          <div class="flex items-center gap-2">
                            <div class="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {getInitials(userInfo.fullName, userInfo.email)}
                            </div>
                            <div class="min-w-0">
                              <p class="text-xs font-medium text-gray-900 dark:text-white truncate">
                                {userInfo.fullName || userInfo.email}
                              </p>
                              <p class="text-xs text-gray-500 dark:text-gray-400 capitalize -mt-px">
                                {userInfo.role}
                              </p>
                            </div>
                          </div>
                        {:else}
                          <p class="text-xs text-gray-500 dark:text-gray-400">
                            {task.assignedTo.slice(0, 8)}...
                          </p>
                        {/if}
                      {:else}
                        <span class="text-xs text-gray-400 dark:text-gray-500">—</span>
                      {/if}
                    </td>
                    <td class="px-5 py-4">
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize {task.priority === 'high' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}">
                        {task.priority}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-xs text-gray-700 dark:text-gray-300 text-nowrap">
                      {formatDate(task.dueDate)}
                    </td>
                    <td class="px-5 py-4" onclick={(e) => e.stopPropagation()}>
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
                  {#if expandedTaskId === task.id}
                    <tr class="bg-gray-50 dark:bg-gray-800/50">
                      <td colspan="5" class="px-5 py-4">
                        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
                          <div class="flex items-start justify-between">
                            <h4 class="text-base font-semibold text-gray-900 dark:text-white">Task Details</h4>
                            <div class="flex items-center gap-2">
                              {#if canDeleteTasks}
                                <button
                                  onclick={() => openDeleteConfirm(task.id)}
                                  class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                                  title="Delete task"
                                  disabled={deletingTask === task.id}
                                >
                                  {#if deletingTask === task.id}
                                    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                  {:else}
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                  {/if}
                                </button>
                              {/if}
                              <button
                                onclick={() => toggleExpanded(task.id)}
                                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                aria-label="Close details"
                              >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          <div class="grid grid-cols-2 gap-4">
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</p>
                              <p class="text-sm text-gray-900 dark:text-white">{task.title}</p>
                            </div>
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
                              <span class="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 capitalize">
                                {task.status}
                              </span>
                            </div>
                          </div>

                          {#if task.description}
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                              <p class="text-sm text-gray-700 dark:text-gray-300">{task.description}</p>
                            </div>
                          {/if}

                          <div class="grid grid-cols-3 gap-4">
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Priority</p>
                              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize {task.priority === 'high' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}">
                                {task.priority}
                              </span>
                            </div>
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</p>
                              <p class="text-sm text-gray-700 dark:text-gray-300">{formatDate(task.dueDate)}</p>
                            </div>
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Created</p>
                              <p class="text-sm text-gray-700 dark:text-gray-300">{formatDate(task.createdAt)}</p>
                            </div>
                          </div>

                          {#if task.assignedTo}
                            {@const userInfo = getUserInfo(task.assignedTo)}
                            <div>
                              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Assigned To</p>
                              {#if userInfo}
                                <div class="flex items-center gap-3">
                                  <div class="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                                    {getInitials(userInfo.fullName, userInfo.email)}
                                  </div>
                                  <div>
                                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                                      {userInfo.fullName || userInfo.email}
                                    </p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                      {userInfo.role}
                                    </p>
                                  </div>
                                </div>
                              {:else}
                                <p class="text-sm text-gray-700 dark:text-gray-300">{task.assignedTo}</p>
                              {/if}
                            </div>
                          {/if}

                          {#if task.insightId || task.opportunityId}
                            <div class="grid grid-cols-2 gap-4">
                              {#if task.insightId}
                                <div>
                                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Update ID</p>
                                  <p class="text-xs font-mono text-gray-700 dark:text-gray-300">{task.insightId}</p>
                                </div>
                              {/if}
                              {#if task.opportunityId}
                                <div>
                                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Insight ID</p>
                                  <p class="text-xs font-mono text-gray-700 dark:text-gray-300">{task.opportunityId}</p>
                                </div>
                              {/if}
                            </div>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/if}
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
            <label for="task-assigned" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Assign to (user ID)</label>
            <input
              id="task-assigned"
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              bind:value={form.assignedTo}
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="task-insight" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Update ID</label>
              <input
                id="task-insight"
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                bind:value={form.insightId}
              />
            </div>
            <div>
              <label for="task-opportunity" class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Insight ID</label>
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
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Task</h3>
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

          <p class="text-sm text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to delete this task? This will permanently remove the task and all associated data.
          </p>

          <div class="flex items-center justify-end gap-3">
            <button
              onclick={closeDeleteConfirm}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onclick={handleDelete}
              disabled={deletingTask !== null}
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deletingTask ? 'Deleting...' : 'Delete Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>

