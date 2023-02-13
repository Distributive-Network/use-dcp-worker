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
const react_1 = require("react");
const bignumber_js_1 = require("bignumber.js");
var workerOptions;
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
    let updatedState = Object.assign({}, state);
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
let defaultWorkerOptions = {
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
let defaultWorkerContext = {
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
const WorkerProvider = (props) => {
    const [workerState, dispatchWorkerState] = (0, react_1.useReducer)(workerStateReducer, defaultWorkerState);
    const [workerStatistics, dispatchWorkerStats] = (0, react_1.useReducer)(workerStatsReducer, defaultWorkerStats);
    const [workerOptionsState, setWorkerOptionsState] = (0, react_1.useState)(defaultWorkerOptions);
    const [worker, setWorker] = (0, react_1.useState)(null);
    return (React.createElement(WorkerContext.Provider, { value: {
            worker,
            setWorker,
            workerOptionsState,
            setWorkerOptionsState,
            workerState,
            workerStatistics,
            dispatchWorkerState,
            dispatchWorkerStats,
        } }, props.children));
};
exports.WorkerProvider = WorkerProvider;
function getWorkerOptionsKey() {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.identity)
        return sessionStorage.identity;
    return 'default';
}
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
    if (Object.prototype.hasOwnProperty.call(loadedOptions, 'defaultMaxWorkers')) {
        loadedOptions.defaultMaxSliceCount = loadedOptions.defaultMaxWorkers;
        delete loadedOptions.defaultMaxWorkers;
    }
    return loadedOptions;
}
const useDCPWorker = ({ identity = null, useLocalStorage = false, options, }) => {
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
    const applyWorkerOptions = (0, react_1.useCallback)((newWorkerOptions) => {
        if (!newWorkerOptions)
            return null;
        for (let prop in newWorkerOptions)
            workerOptions[prop] = newWorkerOptions[prop];
    }, []);
    const saveWorkerOptions = (0, react_1.useCallback)(() => {
        let storageItem = window.localStorage.getItem('worker-options');
        const storage = storageItem !== null ? JSON.parse(storageItem) : {};
        storage[getWorkerOptionsKey()] = workerOptions;
        localStorage.setItem('worker-options', JSON.stringify(storage));
    }, []);
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
        if (workerState.isLoaded && worker !== null) {
            workerOptions = worker.supervisor.options;
        }
        else {
            if (options && useLocalStorage)
                workerOptions = loadWorkerOptions();
            if (workerOptions === null || !useLocalStorage) {
                workerOptions = (_a = window.dcpConfig.worker) !== null && _a !== void 0 ? _a : defaultWorkerOptions;
                if (options.paymentAddress instanceof window.dcp.wallet.Keystore)
                    options.paymentAddress = options.paymentAddress.address.address;
                else if (options.paymentAddress instanceof window.dcp.wallet.Address)
                    options.paymentAddress = options.paymentAddress.address;
                workerOptions.computeGroups = [];
                applyWorkerOptions(options);
            }
        }
    }
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
                dcpWorker.on('sandbox', (sandbox) => {
                    let lastStarted = NaN;
                    const onStart = () => {
                        lastStarted = Date.now();
                        dispatchWorkerState({
                            type: 'SET_WORKING_SANDBOXES',
                            data: dcpWorker.supervisor.allocatedSandboxes.length,
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
                            data: dcpWorker.supervisor.allocatedSandboxes.length,
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
        if (worker === null)
            initializeWorker();
        return () => {
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
        sandboxes: worker ? worker.supervisor.allocatedSandboxes : [],
    };
};
exports.default = useDCPWorker;
//# sourceMappingURL=index.js.map