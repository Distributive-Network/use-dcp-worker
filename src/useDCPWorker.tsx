/**
 *  @file       useDCPWorker.jsx
 *  @author     Kirill Kirnichansky <kirill@distributive.network>
 *
 *  @date       January 2023
 */
import {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  createContext,
  EventHandler,
} from 'react';
import BigNumber from 'bignumber.js';

declare global {
  interface Window {
    dcp: DCP;
    dcpConfig: any;
  }
}

declare interface DCP {
  wallet: Wallet;
  worker: {
    Worker: typeof Worker;
  };
}

declare interface Wallet {
  Address: typeof Address;
  Keystore: typeof Keystore;
}

declare class Address {
  constructor(address: string | Address);
  address: string;
  toString(): string;

  eq: (value: any) => boolean;
}

declare class Keystore {
  constructor(privateKey: any, passpharase: string | false);
  address: Address;

  label: string;

  toString(): string;

  eq: (value: any) => boolean;
}

declare interface IWorkerOptions {
  [key: string]: any;
  trustComputeGroupOrigins?: boolean;
  allowOrigins?: {
    any: Array<string>;
    fetchWorkFunctions: Array<string>;
    fetchArguments: Array<string>;
    fetchData: Array<string>;
    sendResults: Array<string>;
  };
  minimumWage?: {
    CPU: number;
    GPU: number;
    in: number;
    out: number;
  };
  computeGroups?: Array<any>;
  jobAddresses?: Array<string>;
  maxWorkingSandboxes?: number | undefined;
  paymentAddress?: Address | string | null;
  evaluatorOptions?: {};
  shouldStopWorkingImmediately?: boolean;
}

declare class EventTarget<T> {
  on<E extends keyof T>(event: E, eventListener: T[E]): this;
  off<E extends keyof T>(event: E, eventListener: T[E]): this;
}

declare interface Receipt {
  payment: string;
}

declare type JobDetails = {
  description: string;
  link: string;
  name: string;
};

declare class Sandbox extends EventTarget<any> {
  id: string;

  isWorking: boolean;

  public: JobDetails;

  sliceStartTime: number;

  progress: number;
}

declare interface SupervisorEvents {
  sandboxStart: EventHandler<any>;
}

declare class Supervisor extends EventTarget<SupervisorEvents> {
  maxWorkingSandboxes: number;

  paymentAddress: Address;

  options: IWorkerOptions;

  allocatedSandboxes: Sandbox[];
}

declare interface WorkerEvents {
  start: EventHandler<any>;
  fetchStart: EventHandler<any>;
  error: EventHandler<any>;
  fetchEnd: EventHandler<any>;
  stop: EventHandler<any>;
  payment: EventHandler<any>;
}

declare class Worker extends EventTarget<WorkerEvents> {
  constructor(identity: Keystore, options: IWorkerOptions);
  start: () => Promise<void>;

  stop: (shouldstopImmediately: boolean) => Promise<void>;

  supervisorOptions: any;

  workingSandboxes:  Array<any>;
}

let workerOptions: IWorkerOptions;

/**
 *  Stores the worker's "state", whether it is loaded, fetching and/or submitting work, and
 *  any recent error
 *
 *  @type {Object}
 *  @property {boolean}         isLoaded         True once the worker has been established
 *  @property {number}          workingSandboxes Number of sandboxes currently working
 *  @property {boolean}         working          True if worker has started to work, False otherwise
 *  @property {boolean}         willWork         if worker start/stop has been requested but not completed
 *  @property {boolean}         fetching         True while a fetchTask request is in flight
 *  @property {boolean}         submitting       True while results are in flight to the scheduler
 *  @property {ServiceError?}   error            Set when an error has occured in the worker
 */

interface IDefaultWorkerState {
  isLoaded: boolean;
  workingSandboxes: number;
  working: boolean;
  willWork: boolean | null;
  fetching: boolean;
  submitting: boolean;
  error: Error | boolean;
}
const defaultWorkerState: IDefaultWorkerState = {
  isLoaded: false,
  workingSandboxes: 0,
  working: false,
  willWork: null,
  fetching: false,
  submitting: false,
  error: false,
};

const workerStateReducer = (
  state: IDefaultWorkerState,
  action: { type: string; data: any },
) => {
  const updatedState = { ...state };
  if (action.type === 'WORKER_LOADED_TRUE') {
    updatedState.isLoaded = true;
  } else if (action.type === 'SET_WORKING_SANDBOXES') {
    updatedState.workingSandboxes = action.data;
  } else if (action.type === 'FETCHING_TRUE') {
    updatedState.fetching = true;
  } else if (action.type === 'FETCHING_FALSE') {
    updatedState.fetching = false;
  } else if (action.type === 'SUBMIT_TRUE') {
    updatedState.submitting = true;
  } else if (action.type === 'SUBMIT_FALSE') {
    updatedState.fetching = false;
  } else if (action.type === 'WORKING_TRUE') {
    updatedState.working = true;
    if (updatedState.willWork) updatedState.willWork = null;
  } else if (action.type === 'WORKING_FALSE') {
    updatedState.working = false;
    if (!updatedState.willWork) updatedState.willWork = null;
  } else if (action.type === 'WILL_WORK_TRUE') {
    updatedState.willWork = true;
  } else if (action.type === 'WILL_WORK_FALSE') {
    updatedState.willWork = false;
  } else if (action.type === 'ERROR') {
    updatedState.error = action.data;
  }
  return updatedState;
};

interface IDefaultWorkerStats {
  slices: number;
  credits: BigNumber;
  computeTime: number;
  options: {
    paymentAddress: string | null;
    maxWorkingSandboxes: number;
  };
}
/**
 *  Stores the global tallies of slices completed, credits earned, and time computed
 *
 *  @type {Object}
 *  @property {number}    slices      Number of slices completed
 *  @property {BigNumber} credits     Total credits earned
 *  @property {number}    computeTime Total time computed (ms)
 */
const defaultWorkerStats: IDefaultWorkerStats = {
  slices: 0,
  credits: new BigNumber(0),
  computeTime: 0,
  options: { paymentAddress: null, maxWorkingSandboxes: 0 },
};

const workerStatsReducer = (
  state: IDefaultWorkerStats,
  action: { type: string; data: any },
) => {
  let updatedStats = { ...state };

  if (action.type === 'INCREMENT_COMPUTE_TIME') {
    updatedStats.computeTime += action.data;
  } else if (action.type === 'INCREMENT_SLICES') {
    updatedStats.slices++;
  } else if (action.type === 'INCREMENT_CREDITS') {
    updatedStats.credits = updatedStats.credits.plus(action.data);
  }

  return updatedStats;
};

/**
 * passing undefined maxWorkingSanboxes -> supervisor will calculate
 * maxWorkingSandboxes based off the user's hardware
 */
const defaultWorkerOptions: IWorkerOptions = {
  trustComputeGroupOrigins: true,
  allowOrigins: {
    any: [],
    fetchWorkFunctions: [],
    fetchArguments: [],
    fetchData: [],
    sendResults: [],
  },
  minimumWage: {
    CPU: 0,
    GPU: 0,
    in: 0,
    out: 0,
  },
  computeGroups: [],
  jobAddresses: [],
  maxWorkingSandboxes: undefined,
  paymentAddress: null,
  evaluatorOptions: {},
};

declare interface IDefaultWorkerContext {
  worker: Worker | null;
  setWorker: Function;
  workerOptionsState: IWorkerOptions;
  setWorkerOptionsState: Function;
  workerState: IDefaultWorkerState;
  workerStatistics: IDefaultWorkerStats;
  dispatchWorkerState: Function;
  dispatchWorkerStats: Function;
}

const defaultWorkerContext: IDefaultWorkerContext = {
  worker: null,
  setWorker: () => {},
  workerOptionsState: defaultWorkerOptions,
  setWorkerOptionsState: () => {},
  workerState: defaultWorkerState,
  workerStatistics: defaultWorkerStats,
  dispatchWorkerState: () => {},
  dispatchWorkerStats: () => {},
};

const WorkerContext = createContext(defaultWorkerContext);

/**
 * This provider allows access to the WorkerContext global state. The WorkerContext can only truly be used in this hook,
 * since this is the scope in which the context is created. To enable the hook, components that wish to use it must wrapped
 * by WorkerProvider tags.
 */
export const WorkerProvider = (props: any) => {
  const [workerState, dispatchWorkerState] = useReducer(
    workerStateReducer,
    defaultWorkerState,
  );
  const [workerStatistics, dispatchWorkerStats] = useReducer(
    workerStatsReducer,
    defaultWorkerStats,
  );
  const [workerOptionsState, setWorkerOptionsState] =
    useState(defaultWorkerOptions);
  const [worker, setWorker] = useState(null);
  return (
    <WorkerContext.Provider
      value={{
        worker,
        setWorker,
        workerOptionsState,
        setWorkerOptionsState,
        workerState,
        workerStatistics,
        dispatchWorkerState,
        dispatchWorkerStats,
      }}
    >
      {props.children}
    </WorkerContext.Provider>
  );
};

/**
 *  Get the key under which to save/load the workerOptions
 *
 *  Will try to find the user's real identity, first from sessionStorage but
 *    also from window (in case of Incognito Mode or other impediment to
 *    browser storage)
 *
 *  @return {string}    Index into workerOptions storage
 */
function getWorkerOptionsKey() {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.identity)
    return sessionStorage.identity;

  return 'default';
}

/**
 *  Loads the user's worker options from their browser's local storage.
 *
 *  Also removes instances of the old format for storing the worker options.
 *
 *  @returns {WorkerOptions?} The worker options, or null if they weren't found.
 */
function loadWorkerOptions() {
  let options = window.localStorage.getItem('worker-options');
  let storage = options === null ? {} : JSON.parse(options);

  let loadedOptions;

  if (Object.prototype.hasOwnProperty.call(storage, getWorkerOptionsKey())) {
    loadedOptions = storage[getWorkerOptionsKey()];
  } else if (
    Object.prototype.hasOwnProperty.call(storage, 'defaultMaxWorkers')
  ) {
    loadedOptions = storage;
  }

  if (!loadedOptions) return null;

  if (
    Object.prototype.hasOwnProperty.call(loadedOptions, 'paymentAddress')
  ) {
    if (loadedOptions.paymentAddress instanceof window.dcp.wallet.Keystore) {
      loadedOptions.paymentAddress = new window.dcp.wallet.Address(loadedOptions.paymentAddress);
    }
    else if (!(loadedOptions.paymentAddress instanceof window.dcp.wallet.Address)) {
      loadedOptions.paymentAddress = new window.dcp.wallet.Address(loadedOptions.paymentAddress);
    }
  }

  // If the saved options have `defaultMaxWorkers`, change that to `defaultMaxSliceCount`
  if (
    Object.prototype.hasOwnProperty.call(loadedOptions, 'defaultMaxWorkers')
  ) {
    loadedOptions.defaultMaxSliceCount = loadedOptions.defaultMaxWorkers;
    delete loadedOptions.defaultMaxWorkers;
  }

  return loadedOptions;
}

interface IUseDCPWorkerParams {
  identity?: any;
  useLocalStorage?: boolean;
  workerOptions: IWorkerOptions;
}
/**
 * This hook enables the use of a DCP web worker. A config object is accepted as a paremeter. This config object can have a
 * config.identity property which will be assigned as the worker's identity (must be of type dcp.wallet.Keystore). config.useLocalStorage
 * is another config property which determined wether browser localStorage is used to save workerOptions between sessions. The final property
 * for the config param is config.workerOptions which is used by the worker constructor to configure the worker.
 *
 * @param config.identity        Value to set the identity of the worker. Must be of type dcp.wallet.Address
 * @param config.useLocalStorage Boolean flag to enable the use of localStorage to save workerOptions.
 *                               This will override any workerOptions passed in the config.
 * @param config.workerOptions   WorkerOptions to configure the worker.
 * @returns `{workerState, workerStatistics, setWorkerOptions, startWorker, stopWorker, toggleWorker, workerOptionsState, sandboxes}`
 *          workerState and workerStatisitics provide worker status and data information. The worker can be controlled by startWorker,
 *          stopWorker and togglerWorker. workerOptionsState is a readonly object that describes how the worker is currently
 *          configured. To mutate workerOptions, use setWorkerOptions.
 */
const useDCPWorker = ({
  identity = null,
  useLocalStorage = true,
  workerOptions: userWorkerOptions,
}: IUseDCPWorkerParams) => {
  const {
    worker,
    setWorker,
    workerOptionsState,
    setWorkerOptionsState,
    workerState,
    workerStatistics,
    dispatchWorkerState,
    dispatchWorkerStats,
  } = useContext(WorkerContext);

  function startWorker() {
    if (workerState.isLoaded && worker !== null) {
      dispatchWorkerState({ type: 'WILL_WORK_TRUE' });
      worker.start().catch((error: any) => {
        console.error(
          `useDCPWorker(): starting the worker threw an unexpected error:`,
          error,
        );
        return error;
      });
    } else console.warn('useDCPWorker(): worker is not loaded.');
  }

  function stopWorker() {
    dispatchWorkerState({ type: 'WILL_WORK_FALSE' });
    if (workerState.isLoaded && worker !== null) {
      worker
        .stop(workerOptions.shouldStopWorkingImmediately ?? false)
        .catch((error: any) => {
          console.error(
            `useDCPWorker(): stopping the worker threw an unexpected error:`,
            error,
          );
          return error;
        });
    } else {
      console.error(
        "useDCPWorker(): failed to stop worker, worker isn't loaded or is null",
      );
    }
  }

  function toggleWorker() {
    if (workerState.working) stopWorker();
    else startWorker();
  }

  /**
   *  Apply a set of workerOptions (can come from loadWorkerOptions or
   *    saveWorkerOptions) to the worker, then notify any listeners (using an
   *    extension event name, `x-portal-options-updated`)
   *
   *  @param  {newWorkerOptions} newWorkerOptions WorkerOptions to apply
   *
   *  @return {WorkerOptions}               WorkerOptions as applied
   */
  const applyWorkerOptions = useCallback((newWorkerOptions: IWorkerOptions) => {
    if (!newWorkerOptions) return null;
    for (let prop in newWorkerOptions)
      workerOptions[prop] = newWorkerOptions[prop];
  }, []);

  /**
   *  Saves the current workerOptions configuration under their email address in
   *  their local storage to be loaded when they sign in next time.
   */
  const saveWorkerOptions = useCallback(() => {
    const storageItem = window.localStorage.getItem('worker-options');
    const storage = storageItem !== null ? JSON.parse(storageItem) : {};
    // Save the worker options indexed by the user's Identity
    storage[getWorkerOptionsKey()] = workerOptions;
    localStorage.setItem('worker-options', JSON.stringify(storage));
  }, []);

  /**
   * This desired method to use when changing workerOptions. First it calls applyWorkerOptions
   * which correctly mutates the workerOptions referenced in the worker. Depending if local storage
   * is enabled, changes are saved to local storage. The readonly wokerOptionsSate is updated accordingly as well.
   */
  const setWorkerOptions = useCallback(
    (newWorkerOptions: IWorkerOptions) => {
      applyWorkerOptions(newWorkerOptions);

      if (useLocalStorage) saveWorkerOptions();

      setWorkerOptionsState({ ...workerOptions });
    },
    [
      applyWorkerOptions,
      useLocalStorage,
      saveWorkerOptions,
      setWorkerOptionsState,
    ],
  );

  if (!workerOptions) {
    // if worker in state is loaded, pass options reference from supervisor
    if (workerState.isLoaded && worker !== null) {
      workerOptions = worker.supervisorOptions;
    } else {
      // useLocalStorage will overide options.workerOptions
      if (userWorkerOptions && useLocalStorage) workerOptions = loadWorkerOptions();

      // if workerOptions doesn't yet exist in localStorage (first time running) || don't use localStorage
      // use a default workerConfig overritten with user passed options.workerOptions
      if (workerOptions === null || !useLocalStorage) {
        workerOptions = window.dcpConfig.worker ?? defaultWorkerOptions;
        if (userWorkerOptions.paymentAddress instanceof window.dcp.wallet.Keystore)
          userWorkerOptions.paymentAddress = new window.dcp.wallet.Address(userWorkerOptions.paymentAddress.address);
        else if (userWorkerOptions.paymentAddress instanceof window.dcp.wallet.Address)
          userWorkerOptions.paymentAddress = new window.dcp.wallet.Address(userWorkerOptions.paymentAddress)
        workerOptions.computeGroups = [];
        applyWorkerOptions(userWorkerOptions);
      }
    }
  }

  // Worker Initialization
  useEffect(() => {
    async function initializeWorker() {
      if (!window.dcp) {
        console.error('useDCPWorker(): Missing dcp-client dependency. ');
        return;
      }

      if (
        !Object.prototype.hasOwnProperty.call(workerOptions, 'paymentAddress')
      ) {
        console.error(
          'useDCPWorker(): workerOptions must contain a paymentAddress.',
        );
        return;
      }

      let workerId = identity;
      if (!workerId)
        workerId = await new window.dcp.wallet.Keystore(null, false);

      let dcpWorker: any;
      try {
        delete workerOptions.shouldStopWorkingImmediately;
        dcpWorker = new window.dcp.worker.Worker(identity, workerOptions);
        dispatchWorkerState({ type: 'WORKER_LOADED_TRUE' });
        setWorkerOptionsState(workerOptions);
      } catch (error) {
        console.error(
          'useDCPWorker(): something went wrong in the wallet.Worker constructor.',
          error,
        );
        return error;
      }
      // Attach listeners
      dcpWorker.on('sandbox', (sandbox: any) => {
        let lastStarted = NaN;

        const onStart = () => {
          lastStarted = Date.now();
          dispatchWorkerState({
            type: 'SET_WORKING_SANDBOXES',
            data: dcpWorker.workingSandboxes.length,
          });
        };

        const onFinish = () => {
          const timeSpent = Date.now() - lastStarted;
          lastStarted = NaN;

          if (isFinite(timeSpent))
            dispatchWorkerStats({
              type: 'INCREMENT_COMPUTE_TIME',
              data: timeSpent,
            });

          dispatchWorkerState({
            type: 'SET_WORKING_SANDBOXES',
            data: dcpWorker.workingSandboxes.length,
          });
        };

        sandbox.on('start', onStart);
        sandbox.on('sliceFinish', onFinish);
        sandbox.on('terminate', () => {
          sandbox.off('start', onStart);
          sandbox.off('sliceFinish', onFinish);
        });
      });
      dcpWorker.on('submit', () => {
        dispatchWorkerStats({ type: 'INCREMENT_SLICES' });
      });
      dcpWorker.on('payment', (receipt: Receipt) => {
        dispatchWorkerStats({
          type: 'INCREMENT_CREDITS',
          data: receipt.payment,
        });
      });
      dcpWorker.on('fetchStart', () => {
        dispatchWorkerState({ type: 'FETCHING_TRUE ' });
      });
      dcpWorker.on('fetchEnd', () => {
        dispatchWorkerState({ type: 'FETCHING_FALSE ' });
      });
      dcpWorker.on('fetchError', (error: Error) => {
        dispatchWorkerState({ type: 'ERROR', data: error });
      });
      dcpWorker.on('submitStart', () => {
        dispatchWorkerState({ type: 'SUBMIT_TRUE' });
      });
      dcpWorker.on('submitEnd', () => {
        dispatchWorkerState({ type: 'SUBMIT_FALSE' });
      });
      dcpWorker.on('submitError', (error: Error) => {
        dispatchWorkerState({ type: 'ERROR', data: error });
      });
      dcpWorker.on('start', () => {
        dispatchWorkerState({ type: 'WORKING_TRUE' });
      });
      dcpWorker.on('stop', () => {
        dispatchWorkerState({ type: 'WORKING_FALSE' });
      });

      setWorker(dcpWorker);
    }
    if (worker === null) {
      initializeWorker();
    }

    return () => {
      // might need to unhook dcpWorker listeners
    };
  }, [
    identity,
    worker,
    setWorker,
    dispatchWorkerState,
    dispatchWorkerStats,
    setWorkerOptionsState,
  ]);

  return {
    workerState,
    workerStatistics,
    setWorkerOptions,
    startWorker,
    stopWorker,
    toggleWorker,
    workerOptionsState,
    sandboxes: worker ? worker.workingSandboxes : [],
  };
};

export default useDCPWorker;
