import Vue from 'vue';
import { Task } from 'shared/data/resources';
import { TABLE_NAMES, CHANGE_TYPES } from 'shared/data';

const DEFAULT_CHECK_INTERVAL = 5000;
const RUNNING_TASK_INTERVAL = 2000;

const blockingTasks = new Set(['sync-channel', 'export-channel']);

let taskUpdateTimer;

export default {
  namespaced: true,
  state: {
    asyncTasksMap: {},
  },
  getters: {
    activeTasks(state, getters) {
      return getters.asyncTasks.filter(t => t.status !== 'SUCCESS' || t.status !== 'FAILED');
    },
    asyncTasks(state) {
      return Object.values(state.asyncTasksMap);
    },
    getAsyncTask(state) {
      return function(taskId) {
        return state.asyncTasksMap[taskId];
      };
    },
    blockingTasks(state, getters) {
      return getters.asyncTasks.filter(task => blockingTasks.has(task.task_type));
    },
  },
  actions: {
    activateTaskUpdateTimer(store) {
      const interval = store.getters.activeTasks.length
        ? RUNNING_TASK_INTERVAL
        : DEFAULT_CHECK_INTERVAL;
      taskUpdateTimer = setTimeout(() => {
        store.dispatch('updateTaskList');
      }, interval);
    },
    deleteTask(store, task) {
      store.commit('REMOVE_ASYNC_TASK', task);
      clearTimeout(taskUpdateTimer);
      // Use the id, rather than task_id for the CRUD endpoint
      // we might want to harmonize this in the future?
      return Task.deleteModel(task.id).then(() => store.dispatch('activateTaskUpdateTimer'));
    },
    updateTaskList(store) {
      return Task.where({ channel: store.rootState.currentChannel.currentChannelId })
        .then(tasks => {
          store.commit('SET_ASYNC_TASKS', tasks);
          store.dispatch('activateTaskUpdateTimer');
        })
        .catch(() => {
          store.dispatch('activateTaskUpdateTimer');
        });
    },
  },
  mutations: {
    ADD_ASYNC_TASK(state, task) {
      Vue.set(state.asyncTasksMap, task.task_id, task);
    },
    SET_ASYNC_TASKS(state, asyncTasks) {
      for (let task of asyncTasks) {
        Vue.set(state.asyncTasksMap, task.task_id, task);
      }
    },
    REMOVE_ASYNC_TASK(state, asyncTask) {
      Vue.delete(state.asyncTasksMap, asyncTask.task_id);
    },
  },
  listeners: {
    [TABLE_NAMES.TASK]: {
      [CHANGE_TYPES.CREATED]: 'ADD_ASYNC_TASK',
      [CHANGE_TYPES.UPDATED]: 'ADD_ASYNC_TASK',
      [CHANGE_TYPES.DELETED]: 'REMOVE_ASYNC_TASK',
    },
  },
};
