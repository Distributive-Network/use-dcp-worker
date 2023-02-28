"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerProvider = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 *  @file       useDCPWorker.jsx
 *  @author     Kirill Kirnichansky <kirill@distributive.network>
 *
 *  @date       January 2023
 */
const react_1 = require("react");
const bignumber_js_1 = require("bignumber.js");
let workerOptions;
const defaultWorkerState = {
    isLoaded: false,
    workingSandboxes: 0,
    working: false,
    willWork: null,
    fetching: false,
    submitting: false,
    error: false,
};
const workerStateReducer = (state, action) => {
    const updatedState = Object.assign({}, state);
    if (action.type === 'WORKER_LOADED_TRUE') {
        updatedState.isLoaded = true;
    }
    else if (action.type === 'SET_WORKING_SANDBOXES') {
        updatedState.workingSandboxes = action.data;
    }
    else if (action.type === 'FETCHING_TRUE') {
        updatedState.fetching = true;
    }
    else if (action.type === 'FETCHING_FALSE') {
        updatedState.fetching = false;
    }
    else if (action.type === 'SUBMIT_TRUE') {
        updatedState.submitting = true;
    }
    else if (action.type === 'SUBMIT_FALSE') {
        updatedState.fetching = false;
    }
    else if (action.type === 'WORKING_TRUE') {
        updatedState.working = true;
        if (updatedState.willWork)
            updatedState.willWork = null;
    }
    else if (action.type === 'WORKING_FALSE') {
        updatedState.working = false;
        if (!updatedState.willWork)
            updatedState.willWork = null;
    }
    else if (action.type === 'WILL_WORK_TRUE') {
        updatedState.willWork = true;
    }
    else if (action.type === 'WILL_WORK_FALSE') {
        updatedState.willWork = false;
    }
    else if (action.type === 'ERROR') {
        updatedState.error = action.data;
    }
    return updatedState;
};
/**
 *  Stores the global tallies of slices completed, credits earned, and time computed
 *
 *  @type {Object}
 *  @property {number}    slices      Number of slices completed
 *  @property {BigNumber} credits     Total credits earned
 *  @property {number}    computeTime Total time computed (ms)
 */
const defaultWorkerStats = {
    slices: 0,
    credits: new bignumber_js_1.default(0),
    computeTime: 0,
    options: { paymentAddress: null, maxWorkingSandboxes: 0 },
};
const workerStatsReducer = (state, action) => {
    let updatedStats = Object.assign({}, state);
    if (action.type === 'INCREMENT_COMPUTE_TIME') {
        updatedStats.computeTime += action.data;
    }
    else if (action.type === 'INCREMENT_SLICES') {
        updatedStats.slices++;
    }
    else if (action.type === 'INCREMENT_CREDITS') {
        updatedStats.credits = updatedStats.credits.plus(action.data);
    }
    return updatedStats;
};
/**
 * passing undefined maxWorkingSanboxes -> supervisor will calculate
 * maxWorkingSandboxes based off the user's hardware
 */
const defaultWorkerOptions = {
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
const defaultWorkerContext = {
    worker: null,
    setWorker: () => { },
    workerOptionsState: defaultWorkerOptions,
    setWorkerOptionsState: () => { },
    workerState: defaultWorkerState,
    workerStatistics: defaultWorkerStats,
    dispatchWorkerState: () => { },
    dispatchWorkerStats: () => { },
};
const WorkerContext = (0, react_1.createContext)(defaultWorkerContext);
/**
 * This provider allows access to the WorkerContext global state. The WorkerContext can only truly be used in this hook,
 * since this is the scope in which the context is created. To enable the hook, components that wish to use it must wrapped
 * by WorkerProvider tags.
 */
const WorkerProvider = (props) => {
    const [workerState, dispatchWorkerState] = (0, react_1.useReducer)(workerStateReducer, defaultWorkerState);
    const [workerStatistics, dispatchWorkerStats] = (0, react_1.useReducer)(workerStatsReducer, defaultWorkerStats);
    const [workerOptionsState, setWorkerOptionsState] = (0, react_1.useState)(defaultWorkerOptions);
    const [worker, setWorker] = (0, react_1.useState)(null);
    return ((0, jsx_runtime_1.jsx)(WorkerContext.Provider, Object.assign({ value: {
            worker,
            setWorker,
            workerOptionsState,
            setWorkerOptionsState,
            workerState,
            workerStatistics,
            dispatchWorkerState,
            dispatchWorkerStats,
        } }, { children: props.children })));
};
exports.WorkerProvider = WorkerProvider;
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
    }
    else if (Object.prototype.hasOwnProperty.call(storage, 'defaultMaxWorkers')) {
        loadedOptions = storage;
    }
    if (!loadedOptions)
        return null;
    if (Object.prototype.hasOwnProperty.call(loadedOptions, 'paymentAddress')) {
        if (loadedOptions.paymentAddress instanceof window.dcp.wallet.Keystore) {
            loadedOptions.paymentAddress = new window.dcp.wallet.Address(loadedOptions.paymentAddress);
        }
        else if (!(loadedOptions.paymentAddress instanceof window.dcp.wallet.Address)) {
            loadedOptions.paymentAddress = new window.dcp.wallet.Address(loadedOptions.paymentAddress);
        }
    }
    // If the saved options have `defaultMaxWorkers`, change that to `defaultMaxSliceCount`
    if (Object.prototype.hasOwnProperty.call(loadedOptions, 'defaultMaxWorkers')) {
        loadedOptions.defaultMaxSliceCount = loadedOptions.defaultMaxWorkers;
        delete loadedOptions.defaultMaxWorkers;
    }
    return loadedOptions;
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
const useDCPWorker = ({ identity = null, useLocalStorage = true, workerOptions: userWorkerOptions, }) => {
    var _a;
    const { worker, setWorker, workerOptionsState, setWorkerOptionsState, workerState, workerStatistics, dispatchWorkerState, dispatchWorkerStats, } = (0, react_1.useContext)(WorkerContext);
    function startWorker() {
        if (workerState.isLoaded && worker !== null) {
            dispatchWorkerState({ type: 'WILL_WORK_TRUE' });
            worker.start().catch((error) => {
                console.error(`useDCPWorker(): starting the worker threw an unexpected error:`, error);
                return error;
            });
        }
        else
            console.warn('useDCPWorker(): worker is not loaded.');
    }
    function stopWorker() {
        var _a;
        dispatchWorkerState({ type: 'WILL_WORK_FALSE' });
        if (workerState.isLoaded && worker !== null) {
            worker
                .stop((_a = workerOptions.shouldStopWorkingImmediately) !== null && _a !== void 0 ? _a : false)
                .catch((error) => {
                console.error(`useDCPWorker(): stopping the worker threw an unexpected error:`, error);
                return error;
            });
        }
        else {
            console.error("useDCPWorker(): failed to stop worker, worker isn't loaded or is null");
        }
    }
    function toggleWorker() {
        if (workerState.working)
            stopWorker();
        else
            startWorker();
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
    const applyWorkerOptions = (0, react_1.useCallback)((newWorkerOptions) => {
        if (!newWorkerOptions)
            return null;
        for (let prop in newWorkerOptions)
            workerOptions[prop] = newWorkerOptions[prop];
    }, []);
    /**
     *  Saves the current workerOptions configuration under their email address in
     *  their local storage to be loaded when they sign in next time.
     */
    const saveWorkerOptions = (0, react_1.useCallback)(() => {
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
    const setWorkerOptions = (0, react_1.useCallback)((newWorkerOptions) => {
        applyWorkerOptions(newWorkerOptions);
        if (useLocalStorage)
            saveWorkerOptions();
        setWorkerOptionsState(Object.assign({}, workerOptions));
    }, [
        applyWorkerOptions,
        useLocalStorage,
        saveWorkerOptions,
        setWorkerOptionsState,
    ]);
    if (!workerOptions) {
        // if worker in state is loaded, pass options reference from supervisor
        if (workerState.isLoaded && worker !== null) {
            workerOptions = worker.supervisorOptions;
        }
        else {
            // useLocalStorage will overide options.workerOptions
            if (userWorkerOptions && useLocalStorage)
                workerOptions = loadWorkerOptions();
            // if workerOptions doesn't yet exist in localStorage (first time running) || don't use localStorage
            // use a default workerConfig overritten with user passed options.workerOptions
            if (workerOptions === null || !useLocalStorage) {
                workerOptions = (_a = window.dcpConfig.worker) !== null && _a !== void 0 ? _a : defaultWorkerOptions;
                if (userWorkerOptions.paymentAddress instanceof window.dcp.wallet.Keystore)
                    userWorkerOptions.paymentAddress = new window.dcp.wallet.Address(userWorkerOptions.paymentAddress.address);
                else if (userWorkerOptions.paymentAddress instanceof window.dcp.wallet.Address)
                    userWorkerOptions.paymentAddress = new window.dcp.wallet.Address(userWorkerOptions.paymentAddress);
                workerOptions.computeGroups = [];
                applyWorkerOptions(userWorkerOptions);
            }
        }
    }
    // Worker Initialization
    (0, react_1.useEffect)(() => {
        function initializeWorker() {
            return __awaiter(this, void 0, void 0, function* () {
                if (!window.dcp) {
                    console.error('useDCPWorker(): Missing dcp-client dependency. ');
                    return;
                }
                if (!Object.prototype.hasOwnProperty.call(workerOptions, 'paymentAddress')) {
                    console.error('useDCPWorker(): workerOptions must contain a paymentAddress.');
                    return;
                }
                let workerId = identity;
                if (!workerId)
                    workerId = yield new window.dcp.wallet.Keystore(null, false);
                let dcpWorker;
                try {
                    delete workerOptions.shouldStopWorkingImmediately;
                    dcpWorker = new window.dcp.worker.Worker(identity, workerOptions);
                    dispatchWorkerState({ type: 'WORKER_LOADED_TRUE' });
                    setWorkerOptionsState(workerOptions);
                }
                catch (error) {
                    console.error('useDCPWorker(): something went wrong in the wallet.Worker constructor.', error);
                    return error;
                }
                // Attach listeners
                dcpWorker.on('sandbox', (sandbox) => {
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
                dcpWorker.on('payment', (receipt) => {
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
                dcpWorker.on('fetchError', (error) => {
                    dispatchWorkerState({ type: 'ERROR', data: error });
                });
                dcpWorker.on('submitStart', () => {
                    dispatchWorkerState({ type: 'SUBMIT_TRUE' });
                });
                dcpWorker.on('submitEnd', () => {
                    dispatchWorkerState({ type: 'SUBMIT_FALSE' });
                });
                dcpWorker.on('submitError', (error) => {
                    dispatchWorkerState({ type: 'ERROR', data: error });
                });
                dcpWorker.on('start', () => {
                    dispatchWorkerState({ type: 'WORKING_TRUE' });
                });
                dcpWorker.on('stop', () => {
                    dispatchWorkerState({ type: 'WORKING_FALSE' });
                });
                setWorker(dcpWorker);
            });
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
exports.default = useDCPWorker;
//# sourceMappingURL=useDCPWorker.js.map