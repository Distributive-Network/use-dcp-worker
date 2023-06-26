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
      worker,
      workerState,
      workerStatistics,
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
- `workerOptions: object`: The contents of this object will override the default values coming from the worker configuration coming from `dcpConfig`(provided by `dcp-client`, worker node sourced from `dcp-worker`). The only required property of the `workerOptions` object needed to provide is a `paymentAddress`. The following properties describe the worker options object configuring the DCP Worker.
  - `trustComputeGroupOrigins?: boolean = true`: Trust the scheduler to tell client about allowed origins for jobs in a compute group.
  - `allowOrigins?: object`: Allow list permitting network access beyond DCP messages to services. This list is used only in setting up the DCP Worker. After the worker is constructed/loaded, the `originManager` is responsible for managing origins (see Managing Origins). Empty by default of course.
    - `any: []`: A list of origins that are allowed to communicate with, for all purposes.
    - `fetchWorkFunctions: []`: A list of origins that are allowed to fetch the work function from.
    - `fetchArguments: []`: A list of origins that are allowed to fetch work function arguments from.
    - `fetchData: []`: A list of origins that are allowed to fetch input set data from.
    - `sendResults: []`: A list of origins that are allowed to send results to.
  - `minimumWage?: object`: The minimum payout per slice the worker will accept from a job. Will default with the following structure:
    - `CPU: number = 0`
    - `GPU: number = 0`
    - `in: number = 0`
    - `out: number = 0`
  - `computeGroups?: []`: List of compute groups the worker is in and the authorization to join them. A compute group is to be described as `{ joinKey: 'exampleGroup', joinSecret: 'password' }`.
  - `leavePublicGroup?: boolean = false`: A flag that controls if the worker should omit fetching work from the public compute group. If not defined, this flag is evaluated to _false_.
  - `jobAddresses?: []`: If populated, worker will only fetch slices from jobs corresponding to the job addresses in this list.
  - `maxWorkingSandboxes?: integer | undefined`: Maximum number of sandboxes allowed to do work. If `undefined`, then the Supervisor will determine a safe limit, based off of machine hardware.
  - `paymentAddress: Keystore | Address | String`: A Keystore, Address (`dcp.wallet.Address`) or string identifying a DCP Bank Account to deposit earned DCCs.
  - `shouldStopWorkerImmediately?: boolean`: If true, when the worker is called to stop, it will terminate all working sandboxes without waiting for them to finish. If false, the worker will wait for all sandboxes to finish computing before terminating.

Note: Learn more about `Keystore` and `Address` in our [Wallet API documentation](https://docs.dcp.dev/specs/wallet-api.html).

## Returns
This hook returns an object with the following properties:
- `worker: Worker`: Refer to the [Worker API documentation](https://docs.dcp.dev/specs/worker-api.html).
- `workerState: object`: Stores status of worker states. Stored globally and preseved between component updates.
  - `isLoaded: boolean`: True once the worker is properly initialized.
  - `working: boolean`: True if the worker is doing work, false otherwise.
  - `willWork: boolean`: True when the worker is starting to do work, false when the worker is stopping.
  - `fetching: boolean`: True when the worker is fetching for slices to compute, false otherwise.
  - `submitting: boolean`: True when the worker is submitting results to the scheduler, false otherwise.
  - `error: Error | boolean`: Set when a worker error has occured, false otherwise.
  - `workingSandboxes: integer`: Number of sandboxes currently doing work.
- `workerStatistics: object`: Stores a global count of worker statistics for a browser session. Stored globally and preseved between component updates.
  - `slices: number`: Number of slices completed.
  - `credits: BigNumber`: Total credits earned.
  - `computeTime: number`: Total time computed (ms).

Note: Learn more about `Sandbox` in our [Sandbox API](https://docs.dcp.dev/specs/worker-api.html#sandbox-api) & [Compute API](https://docs.dcp.dev/specs/compute-api.html#definitions) docs.
## How it works

The Worker requires an options object for configuration. This hook passes in `dcpConfig.worker` defined in the global scope, with options passed to the hook and those saved in local storage overwritten on top, straight to the constructor. The hook was written to handle multiple insances of the hook defined in a React application, ensuring a single instance of a Worker is used/instanciated (including between component updates) - achieved using React state management. Once a Worker is instantiated, it is in a global context state that all instances of the hook will reference. The state and statistics the hook provides, `workerState` and `workerStatistics`, is also handled in a global React state context. Custom handling of state and statistics can always be achieved using the `worker` returned with an understanding of the Worker API and Worker events.

## Editing Worker Options
As part of the [Worker API](https://docs.dcp.dev/specs/worker-api.html), the `worker` has a `workerOptions` property that describe the current active options configuring the worker, and mutating this object will modify worker options.

__Note:__ To achieve desired React component updates regarding changes to certain options that may be featured in a UI, such as _paymentAddress_ - `worker.workerOptions` is a Proxy object with custom handling to handle component updates and writes to local storage.

## Managing Origins

The `worker` returned has the `originManager` property, which is an instance of the `OriginAccessManager` class responsible for managing the worker's allowed origins. `originManager` is `undefined` until the worker is properly initialized.

Upon construction of the worker, the worker options `allowOrigins` property is read into the construction of the `OriginAccessManager`. Properties of `allowOrigins` translate to a _purpose_ on the OAM, with their values, being a list of origins, are added under that _purpose_ (and `null` _key_). The `any` property translates to a `null` _purpose_, which matches any _purpose_. For example, `isAllowed` will return `true` for origins stored under a `null` _purpose_, regardless the _purpose_ and _key_ combination queried.

### OriginAccessManager Methods
- `add(origin, purpose, key):` Adds (allows) the _origin_ under the _purpose_ and _key_. A `null` _purpose_ and/or _key_ will match any _purpose_ and/or _key_, respectively.
- `remove(origin, purpose, key):` Removes (un-allows) the _origin_ under the _purpose_ and _key_. A `null` purpose and/or key will __not__ match any _purpose_ and/or _key_.
- `remove_byKey(key):` Removes all origins for all purposes under the _key_. A `null` _key_ is not accepted, must be a string.
- `getAllowList(purpose, key):` returns a list of origins under the _purpose_ and _key_. A `null` _purpose_ is not accepted, must be a string. Previously added origins under `null` _purpose_ and/or _key_ will match any _purpose_ and/or _key_, respectively.
- `isAllowed(origin, purpose, key):` returns `true` if _origin_ is allowed under the _purpose_ and _key_. A `null` _purpose_ is not accepted, must be a string. Previously added origins under `null` _purpose_ and/or _key_ will match any _purpose_ and/or _key_, respectively.
# Change log
- __1.0.0__ - Feb 28, 2023
  - Inital Release
- __1.0.1__ - Mar 1, 2023
  - Added src/ directory to published files to support source map
- __1.0.2__ - Mar 23, 2023
  - local storage will only save paymentAddress and maxWorkingSandbox props
  - workerOptions source always coming from dcpConfig
  - added delay between quick worker fetching states
  - Quality of life + maintainability improvements
- __1.1.0__ - May
  - now returning the worker itself and the workerOptions used to configure it
  - proper handling of race-condition in constructing the worker when/if the hook is executed multiple times at once
  - workerOptions passed to worker constructor and returned is a Proxy now
    - needed reflect changes to paymentAddress and maxWorkingSandbox props to local storage and trigger component update/re-render
  - removed workerState.isLoaded since now we are returning the worker
    - !isLoaded === !worker
  - removed workerOptionsState, start/stop/toggleWorker, sandboxes, originManager
    - these are all API methods of the worker
  - removed applyWorkerOptions since editing workerOptions should be done by directly mutating workerOptions
  - improved error handling
  - quality of life improvements

# License
Please refer to the [LICENSE](LICENSE) file for more information.
