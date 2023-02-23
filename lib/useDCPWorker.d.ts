/**
 *  @file       useDCPWorker.jsx
 *  @author     Kirill Kirnichansky <kirill@distributive.network>
 *
 *  @date       January 2023
 */
import { EventHandler } from 'react';
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
    workingSandboxes: Array<any>;
}
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
 * This provider allows access to the WorkerContext global state. The WorkerContext can only truly be used in this hook,
 * since this is the scope in which the context is created. To enable the hook, components that wish to use it must wrapped
 * by WorkerProvider tags.
 */
export declare const WorkerProvider: (props: any) => JSX.Element;
interface IUseDCPWorkerParams {
    identity?: any;
    useLocalStorage?: boolean;
    options: IWorkerOptions;
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
declare const useDCPWorker: ({ identity, useLocalStorage, options, }: IUseDCPWorkerParams) => {
    workerState: IDefaultWorkerState;
    workerStatistics: IDefaultWorkerStats;
    setWorkerOptions: (newWorkerOptions: IWorkerOptions) => void;
    startWorker: () => void;
    stopWorker: () => void;
    toggleWorker: () => void;
    workerOptionsState: IWorkerOptions;
    sandboxes: any[];
};
export default useDCPWorker;
