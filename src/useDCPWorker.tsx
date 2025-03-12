/**
 *  @file       useDCPWorker.jsx
 *  @author     Kirill Kirnichansky <kirill@distributive.network>
 *
 *  @date       January 2023
 */
import
{
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  createContext,
  EventHandler,
}
from 'react';
import BigNumber from 'bignumber.js';

declare global
{
  interface Window
  {
    dcp: {
      wallet: {
        Keystore: typeof Keystore
        Address: typeof Address
      }
      utils: any;
      worker: any;
    };
    dcpConfig: any;
  }
}

declare class Address
{
  constructor(address: string | Address | undefined | null);
  address: string;
  toString(): string;

  eq: (value: any) => boolean;
}

declare class Keystore
{
  constructor(privateKey: any, passpharase: string | false);
  address: Address;

  label: string;

  toString(): string;

  eq: (value: any) => boolean;
}

declare interface IWorkerOptions
{
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
  cores?: {
    cpu?: number;
    gpu?: number;
  };
  maxWorkingSandboxes?: number | undefined;
  paymentAddress?: Keystore | Address | string | null;
  evaluatorOptions?: {};
}

let workerOptions: IWorkerOptions;

/**
 *  Stores the worker's "state", whether it is fetching and/or submitting work, and any recent error
 *
 *  @type {Object}
 *  @property {number}          workingSandboxes Number of sandboxes currently working
 *  @property {boolean}         working          True if worker has started to work, False otherwise
 *  @property {boolean}         willWork         if worker start/stop has been requested but not completed
 *  @property {boolean}         fetching         True while a fetchTask request is in flight
 *  @property {boolean}         submitting       True while results are in flight to the scheduler
 *  @property {ServiceError?}   error            Set when an error has occured in the worker
 */

interface IDefaultWorkerState
{
  workingSandboxes: number;
  working: boolean;
  willWork: boolean | null;
  fetching: boolean;
  submitting: boolean;
  error: Error | undefined;
}
const defaultWorkerState: IDefaultWorkerState = {
  workingSandboxes: 0,
  working: false,
  willWork: null,
  fetching: false,
  submitting: false,
  error: undefined,
};

let hasStartedWorkerInit = false, optionsError = false;

enum WorkerStateActions
{
  WORKER_LOADED = 'WORKER_LOADED',
  SET_WORKER_SBX = 'SET_WORKER_SANDBOXES',
  FETCHING_TRUE = 'FETCHING_TRUE',
  FETCHING_FALSE = 'FETCHING_FALSE',
  SUBMIT_TRUE = 'SUBMIT_TRUE',
  SUBMIT_FALSE = 'SUBMIT_FALSE',
  WORKING_TRUE = 'WORKING_TRUE',
  WORKING_FALSE = 'WORKING_FALSE',
  WILL_WORK_TRUE = 'WILL_WORK_TRUE',
  WILL_WORK_FALSE = 'WILL_WORK_FALSE',
  ERROR = 'ERROR',
  TRIGGER_RERENDER = 'TRIGGER_RERENDER',
}

const workerStateReducer = (
  state: IDefaultWorkerState,
  action: { type: string; data: any },
) => {
  const updatedState = { ...state };
  switch (action.type)
  {
    case WorkerStateActions.SET_WORKER_SBX:
      updatedState.workingSandboxes = action.data;
      break;
    case WorkerStateActions.FETCHING_TRUE:
      updatedState.fetching = true;
      break;
    case WorkerStateActions.FETCHING_FALSE:
      updatedState.fetching = false;
      break;
    case WorkerStateActions.SUBMIT_TRUE:
      updatedState.submitting = true;
      break;
    case WorkerStateActions.SUBMIT_FALSE:
      updatedState.submitting = false;
      break;
    case WorkerStateActions.WORKING_TRUE:
      updatedState.working = true;
      if (updatedState.willWork) updatedState.willWork = null;
      break;
    case WorkerStateActions.WORKING_FALSE:
      updatedState.working = false;
      if (!updatedState.willWork) updatedState.willWork = null;
      break;
    case WorkerStateActions.WILL_WORK_TRUE:
      updatedState.willWork = true;
      break;
    case WorkerStateActions.WILL_WORK_FALSE:
      updatedState.willWork = false;
      break;
    case WorkerStateActions.ERROR:
      updatedState.error = action.data;
      break;
  }
  return updatedState;
};

interface IDefaultWorkerStats
{
  slices: number;
  credits: BigNumber;
  computeTime: number;
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
};

enum WorkerStatsActions
{
  ADD_COMPUTE_TIME = 'ADD_COMPUTE_TIME',
  ADD_SLICE = 'ADD_SLICE',
  ADD_CREDITS = 'ADD_CREDITS'
}

const workerStatsReducer = (
  state: IDefaultWorkerStats,
  action: { type: string; data: any },
) => {
  const updatedStats = { ...state };

  switch (action.type)
  {
    case WorkerStatsActions.ADD_COMPUTE_TIME:
      updatedStats.computeTime += action.data;
      break;
    case WorkerStatsActions.ADD_SLICE:
      updatedStats.slices++;
      break;
    case WorkerStatsActions.ADD_CREDITS:
      updatedStats.credits = updatedStats.credits.plus(action.data);
      break;
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

declare interface IDefaultWorkerContext
{
  worker: any;
  setWorker: Function;
  workerState: IDefaultWorkerState;
  workerStatistics: IDefaultWorkerStats;
  dispatchWorkerState: Function;
  dispatchWorkerStats: Function;
}

const defaultWorkerContext: IDefaultWorkerContext = {
  worker: undefined,
  setWorker: () => {},
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
export function WorkerProvider(props: any) 
{
  const [workerState, dispatchWorkerState] = useReducer(
    workerStateReducer,
    defaultWorkerState,
  );
  const [workerStatistics, dispatchWorkerStats] = useReducer(
    workerStatsReducer,
    defaultWorkerStats,
  );
  const [worker, setWorker] = useState();
  return (
    <WorkerContext.Provider
      value={{
        worker,
        setWorker,
        workerState,
        workerStatistics,
        dispatchWorkerState,
        dispatchWorkerStats,
      }}
    >
      {props.children}
    </WorkerContext.Provider>
  );
}

/**
 *  Get the key under which to save/load the workerOptions
 *
 *  Will try to find the user's real identity, first from sessionStorage but
 *    also from window (in case of Incognito Mode or other impediment to
 *    browser storage)
 *
 *  @return {string}    Index into workerOptions storage
 */
function getWorkerOptionsKey()
{
  if (typeof sessionStorage !== 'undefined' && sessionStorage.identity)
    return sessionStorage.identity;

  return 'default';
}

/**
 *  Loads the user's worker options from their browser's local storage.
 *
 *  Also removes instances of the old format for storing the worker options.
 *
 *  @returns The worker options, or null if they weren't found.
 */
function loadWorkerOptions(): WorkerOptions | null
{
  const options = window.localStorage.getItem('dcp-worker-options');
  const storage = options === null ? {} : JSON.parse(options);

  let loadedOptions: WorkerOptions | null = null;

  if (Object.hasOwn(storage, getWorkerOptionsKey()))
  {
    loadedOptions = storage[getWorkerOptionsKey()];
  }

  if (!loadedOptions)
    return null;

  return loadedOptions;
}

interface IUseDCPWorkerParams
{
  useLocalStorage?: boolean;
  workerOptions: IWorkerOptions;
}

/**
 * This hook enables the use of a DCP web worker. Accepts a config object as a parameter used to configure local storage use and
 * configuration for the worker. Returns the dcp worker, which is `undefined` until it is constructed, the worker options used to
 * configure the worker (and to update options after), `workerState` describing dcp worker states and `workerStatistics` storing worker
 * session data.
 * 
 * This hook will throw in the following cases:
 *  - missing `dcp-client` dependency
 *  - error in worker constructor
 * 
 * Errors may also be emited by the worker, in which then, they are set to `workerState.error` and will not cause the hook to throw.
 *
 * @param config.useLocalStorage Boolean flag to enable the use of localStorage to save workerOptions.
 *                               This will override `paymentAddress` and `maxWorkingSandboxes` properties defined in
 *                               `config.workerOptions`. Optional, set to `true` by default.
 * @param config.workerOptions   WorkerOptions to configure the worker.
 * @returns `{worker, workerOptions, workerState, workerStatistics}`
 */
export const useDCPWorker = (
  {
    useLocalStorage = true,
    workerOptions: userWorkerOptions,
  }: IUseDCPWorkerParams
) => {
  const {
    worker,
    setWorker,
    workerState,
    workerStatistics,
    dispatchWorkerState,
    dispatchWorkerStats,
  } = useContext(WorkerContext);

  /**
   *  This method ensures that the paymentAddress prop in workerOptions is of valid type.
   *  @returns `true` if valid, `false` otherwise
   */
  const ensurePaymentAddressType = useCallback(() => {
    if (!Object.hasOwn(workerOptions, 'paymentAddress'))
    {
      console.error('use-dcp-worker: workerOptions must contain a paymentAddress.');
      optionsError = true;
      return;
    }

    try
    {
      if (workerOptions.paymentAddress instanceof window.dcp.wallet.Keystore)
        workerOptions.paymentAddress = workerOptions.paymentAddress.address;
      else if (!(workerOptions.paymentAddress instanceof window.dcp.wallet.Address))
        workerOptions.paymentAddress = new window.dcp.wallet.Address(workerOptions.paymentAddress);
    }
    catch (error)
    {
      console.error(`use-dcp-worker: Invalid type (${typeof workerOptions.paymentAddress}) of paymentAddress supplied for worker options.`, error);
      optionsError = true;
    }
  }, []);

  /**
   *  Performs a leaf merge onto the workerOptions object.
   *
   *  @param  {newWorkerOptions} newWorkerOptions options to apply
   */
  const applyWorkerOptions = useCallback((newWorkerOptions: IWorkerOptions) => {
    if (!newWorkerOptions)
      return;

    for (const prop in newWorkerOptions)
    {
      if (typeof newWorkerOptions[prop] === 'object')
        workerOptions[prop] = window.dcp.utils.leafMerge(workerOptions[prop], newWorkerOptions[prop]);
      workerOptions[prop] = newWorkerOptions[prop]
    }
  }, []);

  /**
   *  Applies user specific options to workerOptions. First the options passed to the hook are applied,
   *  followed by the options stored in local storage if enabled. 
   */
  const applyUserOptions = useCallback(() => {
    // apply user passed options
    if (userWorkerOptions)
      applyWorkerOptions(userWorkerOptions);
    
    // apply local storage options
    let storageOptions;
    if (useLocalStorage)
      storageOptions = loadWorkerOptions();

    if (storageOptions)
      applyWorkerOptions(storageOptions);
  }, [userWorkerOptions]);

  /**
   *  If local storage is enabled:
   * 
   *  Saves the current cores configuration
   *  under dcp-worker-options in local storage to be loaded in next time.
   */
  const saveWorkerOptions = useCallback(() => {
    if (!useLocalStorage)
      return;
    const storageItem = window.localStorage.getItem('dcp-worker-options');
    const storage = storageItem !== null ? JSON.parse(storageItem) : {};
    // Save the worker options indexed by the user's Identity
    storage[getWorkerOptionsKey()] = {
      cores: workerOptions.cores,
    };
    localStorage.setItem('dcp-worker-options', JSON.stringify(storage));
  }, []);

  /**
   *  Constructs/retrieves the worker options object. In the first pass, workerOptions is set by reference to
   *  dcpConfig.worker, this is to ensure that the source of the option obj is always coming from dcpConfig.
   *  Then user specific options are applied onto workerOptions. User specific option consist of options passed
   *  to this hook (userWorkerOptions) and options stored in local storage, which are applied in that order.
   *  The paymentAddress prop is then validated and coerced to the desired type.
   * 
   *  When worker is already set, the workerOptions is retrieved from the supervisor.
   * 
   *  The workerOptions object is returned by this hook. Modifying worker options is as simple as mutating the
   *  workerOptions object returned. in the case local storage is enabled, properties.
   */
  const constructWorkerOptions = useCallback(() => {
    // if optionsError -> an error happened in previous execution of this method, therefore, we can retry
    if (!workerOptions || optionsError)
    {
      // if worker in loaded state, pass options reference from supervisor
      if (worker)
      {
        workerOptions = worker.supervisorOptions;
      }
      else
      {
        // we can trust dcpConfig 
        workerOptions = window.dcpConfig.worker ?? defaultWorkerOptions;

        optionsError = false;
        applyUserOptions();
        ensurePaymentAddressType();

        // ensure computeGroups is array, {} by default from dcpConfig
        if (!(workerOptions.computeGroups instanceof Array))
          workerOptions.computeGroups = [];

        // applicable when cores is saved to localStorage & maxWorkingSandboxes passed in userWorkerOptions to hook
        // deprecate when maxWorkingSandboxes is not supported at all
        if (Object.hasOwn(workerOptions, 'cores') && Object.hasOwn(workerOptions, 'maxWorkingSandboxes'))
          delete workerOptions.maxWorkingSandboxes;
        
        /**
         *  Set up proxy so that when paymentAddress or cores is changed
         *  it is saved to localStorage and triggers re-render to components using this hook.
         */
        const changeWatchList = ['paymentAddress', 'maxWorkingSandboxes', 'cores', 'cpu'];
        const workerOptionsHandler: ProxyHandler<any> = {
          get(target: any, property: string) {
            if (typeof target[property] === 'object')
              return new Proxy(target[property], workerOptionsHandler);
            return target[property];
          },
          set(target: any, property: any, value: any)
          {
            target[property] = value;
            if (changeWatchList.includes(property))
            {
              if (property === 'paymentAddress')
                ensurePaymentAddressType();
              saveWorkerOptions();
              /**
               *  paymentAddress and cores are desired worker options that may
               *  feature UI components, therefore, we want to trigger a re-render
              */
              dispatchWorkerState({ type: WorkerStateActions.TRIGGER_RERENDER });
            }
            return true;
          }
        }
        const workerOptionsProxy = new Proxy(workerOptions, workerOptionsHandler);
        workerOptions = workerOptionsProxy;
      }
    }
  }, [userWorkerOptions]);

  // Ensure window.dcp -> dcp-client library loaded
  if (!window.dcp)
  {
    console.error('use-dcp-worker: Missing dcp-client dependency.');
    throw new Error('Missing dcp-client dependency.');
  }

  // Worker Options Construction
  constructWorkerOptions();

  // Worker Initialization
  useEffect(() => {
    function initializeWorker()
    {
      // prevents race condition if hook is called multiple times || options error
      if (hasStartedWorkerInit || optionsError)
        return;
      hasStartedWorkerInit = true;

      createWorker();
      function createWorker()
      {
        // DCP Worker constructor
        const dcpWorker = new window.dcp.worker.Worker(false, workerOptions);

        // Attach listeners
        dcpWorker.on('sandbox', (sandbox: any) => {
          sandbox.on('slice', () => {
            dispatchWorkerState({
              type: WorkerStateActions.SET_WORKER_SBX,
              data: dcpWorker.workingSandboxes.length,
            });
          });
          sandbox.on('metrics', (_: any, measurements: any) => {
            dispatchWorkerStats({
              type: WorkerStatsActions.ADD_COMPUTE_TIME,
              data: measurements.elapsed, // seconds
            });
          });
          sandbox.on('end', () => {
            dispatchWorkerState({
              type: WorkerStateActions.SET_WORKER_SBX,
              data: dcpWorker.workingSandboxes.length,
            });
          });
        });
        dcpWorker.on('payment', (payment: number) => {
          dispatchWorkerStats({ type: WorkerStatsActions.ADD_SLICE });
          dispatchWorkerStats({
            type: WorkerStatsActions.ADD_CREDITS,
            data: payment,
          });
          dispatchWorkerState({
            type: WorkerStateActions.SET_WORKER_SBX,
            data: dcpWorker.workingSandboxes.length,
          });
        });
        dcpWorker.on('beforeFetch', () => {
          dispatchWorkerState({ type: WorkerStateActions.FETCHING_TRUE });
        });
        dcpWorker.on('fetch', (payload: any) => {
          if (payload instanceof Error)
            return dispatchWorkerState({ type: WorkerStateActions.ERROR, data: payload });

          // Successful fetch, so clear any errors from a previous fetch.
          dispatchWorkerState({ type: WorkerStateActions.ERROR, data: undefined });

          // extra delay for cleaner UI visual updates between quick fetching states
          setTimeout(() => {
            dispatchWorkerState({ type: WorkerStateActions.FETCHING_FALSE });
          }, 1000);
        });
        dcpWorker.on('beforeReturn', () => {
          dispatchWorkerState({ type: WorkerStateActions.SUBMIT_TRUE });
        });
        dcpWorker.on('result', (payload: any) => {
          if (payload instanceof Error)
            return dispatchWorkerState({ type: WorkerStateActions.ERROR, data: payload });

          dispatchWorkerState({ type: WorkerStateActions.SUBMIT_FALSE });
        });
        dcpWorker.on('start', () => {
          dispatchWorkerState({ type: WorkerStateActions.WILL_WORK_TRUE });
          dispatchWorkerState({ type: WorkerStateActions.WORKING_TRUE });
        });
        dcpWorker.on('stop', () => {
          dispatchWorkerState({ type: WorkerStateActions.WILL_WORK_FALSE });
          dispatchWorkerState({ type: WorkerStateActions.WORKING_FALSE });
          createWorker();
        });
        dcpWorker.on('error', console.error);

        setWorker(dcpWorker);
      }
    }
    initializeWorker();

    return () => {
      // might need to unhook dcpWorker listeners
    };
  });

  return {
    worker,
    workerState,
    workerStatistics,
  };
};
