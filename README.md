# use-dcp-worker
## What is DCP?
DCP, Distributive Compute Protocol, is a fast, secure, and powerful parallel computing platform built on web technology. DCP breaks large compute workloads into small slices, computes them in parallel on different devices, and returns the results to the client.

A DCP Worker performs compute tasks on the network in exchange for DCCs (Distributive Compute Credits). This package allows anyone to setup a DCP Worker within their own React projects.

Find out more at https://kingsds.network/.

How to install:
```
npm install use-dcp-worker
```

# Setup
There are 2 steps to setup the hook in your React projects.
1. Import the `dcp-client` library in `public/index.html`:
```html
<script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
```
2. The `WorkerProvider` component must wrap components you wish to use the worker in. We recommend wrapping the entire `App` component so the hook can be used anywhere:
```js
import { WorkerProvider } from 'use-dcp-worker';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WorkerProvider>
      <App />
    </WorkerProvider>  
  </React.StrictMode>
);
```

# Usage
Once setup, the hook can be used anywhere inside the `WorkerProvider` as such:
```js
import useDCPWorker from 'use-dcp-worker';

function Worker() {
  const { 
      workerState,
      workerStatistics,
      workerOptionsState,
      setWorkerOptions,
      startWorker,
      stopWorker,
      toggleWorker,
      sandboxes,
    } = useDCPWorker({
        workerOptions: {
          paymentAddress: address,
        }
      });
```
## Parameters
The hook accepts a single object with the following parameters:
- `identity?: Keystore`: A Keystore object (`dcp.wallet.Keystore`) which is passed to the Worker constructor and set as the Worker's identity when communicating over the network. If a Keystore is not provided, an arbitrary one will be generated.
- `useLocalStorage?: boolean = true`:  A flag to toggle the use of the browser's local storage. The `workerOptions` object is the entity to be saved to local storage and is updated accordingly when calling `setWorkerOptions`.
- `workerOptions: object`: This object is supplied to the Worker constructor as the `workerOptions` parameter (required). The only required property of the `workerOptions` object needed to provide is a `paymentAddress`. The rest of the properties will get default values.
  - `trustComputeGroupOrigins?: boolean = true`: Trust the scheduler to tell client about allowed origins for jobs in a compute group.
  - `allowOrigins?: object`: Allow list permitting network access beyond DCP messages to services.
    - `any: []`: A list of origins that are safe to communicate with.
    - `fetchWorkFunctions: []`: A list of work function URIs that are safe to communicate with.
    - `fetchArguments: []`: A list of argument datum URIs that are safe to communicate with.
    - `fetchData: []`: A list of input datum URIs that are safe to communicate with.
    - `sendResults: []`: A list of URIs that are safe to send job results to.
  - `minimumWage?: object`: The minimum payout per slice the worker will accept from a job. Will default with the following structure:
    - `CPU: number = 0`
    - `GPU: number = 0`
    - `in: number = 0`
    - `out: number = 0`
  - `computeGroups?: []`: List of compute groups the worker is in and the authorization to join them. A compute group is to be described as `{ joinKey: 'exampleGroup', joinSecret: 'password' }`.
  - `jobAddresses?: []`: If populated, worker will only fetch slices from jobs corresponding to the job addresses in this list.
  - `maxWorkingSandboxes?: integer | undefined`: Maximum number of sandboxes allowed to do work. If `undefined`, then the Supervisor will determine a safe limit, based off of machine hardware.
  - `paymentAddress: Keystore | Address | String`: A Keystore or Address (`dcp.wallet.Address`) identifying a DCP Bank Account to deposit earned DCCs. An address string can also be supplied.
  - `shouldStopWorkerImmediately?: boolean`: If true, when the worker is called to stop, it will terminate all working sandboxes without waiting for them to finish. If false, the worker will wait for all sandboxes to finish computing before terminating.

Note: Learn more about `Keystore` and `Address` in our [Wallet API documentation](https://docs.dcp.dev/specs/wallet-api.html).

## Returns
The `useDCPWorker` hook returns an object with the following properties:
- `workerState: object`: Stores status of worker states.
  - `isLoaded: boolean`: True once worker is properly initialized.
  - `working: boolean`: True if worker is doing work, false otherwise.
  - `willWork: boolean`: True when worker is starting to do work, false when worker is stopping.
  - `fetching: boolean`: True when the worker is fetching for slices to compute.
  - `submitting: boolean`: True when the worker is submitting results to the scheduler.
  - `error: Error | boolean`: Set when a worker has occured, false otherwise.
  - `workingSandboxes: number`: Number of sandboxes currently doing work.
- `workerStatistics: object`: Stores a global count of worker statistics for a browser session.
  - `slices: number`: Number of slices completed.
  - `credits: BigNumber`: Total credits earned.
  - `computeTime: number`: Total time computed (ms).
- `workerOptionsState: object`: Refer to `workerOptions` in Parameters. This is to be treated as a read-only object, mutating it will not update worker options.
- `sandboxes: object`: List of Sandbox objects of sandboxes currently working. Sandbox objects consist of the properties: `id`, `isWorking`, `public`, `sliceStartTime`, and `progress`.
- `setWorkerOptions: function`: This method updates the `workerOptions` object. The method accepts an object as a parameter and does a leaf merge on the original `workerOptions` object, however, only on the first layer of properties. For example, `setWorkerOptions({ paymentAddress: 'some address' })` will only update the `paymentAddress` property of `workerOptions` and preserve the rest of the object. `setWorkerOptions({ allowOrigins: { any: ['origin'] } })` will update the entirety of `allowOrigins` instead of just `allowOrigins.any`.
- `startWorker: function`: This method starts the worker.
- `stopWorker: function`: This method stops the worker.
- `toggleWorker: function`: This method starts/stops the worker.

# Changelog
## 1.0.0
- initial release.

# License
Please refer to the [LICENSE](LICENSE) file for more information.
