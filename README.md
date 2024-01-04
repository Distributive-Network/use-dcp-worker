# use-dcp-worker

![npm version][npm-version-badge]
[![standard-readme compliant][standard-readme-badge]][standard-readme-repo]

A React hook to use a DCP Worker.

The Distributive Compute Protocol (DCP), is a fast, secure, and powerful parallel computing platform
built on web technology. DCP breaks large compute workloads into small slices, computes them in
parallel on different devices, and returns the results to the client.

A DCP Worker performs compute tasks on the network in exchange for DCCs (Distributive Compute
Credits). This package allows anyone to setup a DCP Worker within their own React projects.

Find out more at <https://docs.dcp.dev/>.

## Table of Contents

<!--toc:start-->

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

<!--toc:end-->

## Install

```sh
npm add use-dcp-worker
```

## Usage

Load `https://scheduler.distributed.computer/dcp-client/dcp-client.js` before the React starts
hydrating the web app. e.g.,

```html
<script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
```

Then wrap the part of the app that well use `useDCPWorker` with a `WorkerProvider` component.

```javascript
import ReactDOM from 'react-dom/client';
import { WorkerProvider } from 'use-dcp-worker';

ReactDOM.createRoot(document.getElementById('root')).render(
  <WorkerProvider>
    <App />
  </WorkerProvider>,
);
```

Finally, call the hook in the components and start hooking the worker's events into you app.

```javascript
import useDCPWorker from 'use-dcp-worker';

export function App() {
  const { worker, workerState, workerStatistics } = useDCPWorker({
    workerOptions: {
      paymentAddress: address,
    },
  });

  // ...
}
```

## API

### How it works

The Worker requires an options object for configuration. This hook passes in `dcpConfig.worker`
defined in the global scope, with options passed to the hook and those saved in local storage
overwritten on top, straight to the constructor. The hook was written to handle multiple insances of
the hook defined in a React application, ensuring a single instance of a Worker is used/instanciated
(including between component updates) - achieved using React state management. Once a Worker is
instantiated, it is in a global context state that all instances of the hook will reference. The
state and statistics the hook provides, `workerState` and `workerStatistics`, is also handled in a
global React state context. Custom handling of state and statistics can always be achieved using the
`worker` returned with an understanding of the Worker API and Worker events.

### Editing Worker Options

As part of the [Worker API](https://docs.dcp.dev/specs/worker-api.html), the `worker` has a
`workerOptions` property that describe the current active options configuring the worker, and
mutating this object will modify worker options.

**Note:** To achieve desired React component updates regarding changes to certain options that may
be featured in a UI, such as _paymentAddress_ - `worker.workerOptions` is a Proxy object with custom
handling to handle component updates and writes to local storage.

### Parameters

The hook accepts a single object with the following parameters:

- `identity?: Keystore`: A Keystore object (`dcp.wallet.Keystore`) which is passed to the Worker
  constructor and set as the Worker's identity when communicating over the network. If a Keystore is
  not provided, an arbitrary one will be generated.
- `useLocalStorage?: boolean = true`: A flag to toggle the use of the browser's local storage. The
  `workerOptions` object is the entity to be saved to local storage and is updated accordingly when
  calling `setWorkerOptions`.
- `workerOptions: object`: The contents of this object will override the default values coming from
  the worker configuration coming from `dcpConfig`(provided by `dcp-client`, worker node sourced
  from `dcp-worker`). The only required property of `workerOptions` is `paymentAddress`. The
  following properties describe the worker options object configuring the DCP Worker:

  - `paymentAddress: string | Address | Keystore`: A string, Address (`dcp.wallet.Address`) or
    Keystore (`dcp.wallet.Keystore`) identifying a DCP Bank Account to deposit earned DCCs.

    **Note:** Passing an invalid `paymentAddress` will be logged to the console but will not cause
    the hook to throw an error. The Worker will not be constructed (`worker === undefined`) and the
    hook will retry construction/initialization on each re-render.

  - `trustComputeGroupOrigins?: boolean = true`: Trust the scheduler to tell client about allowed
    origins for jobs in a compute group.
  - `allowOrigins?: object`: Allow list permitting network access beyond DCP messages to services.
    This list is used only in setting up the DCP Worker. After the worker is constructed/loaded, the
    `originManager` is responsible for managing origins (see Managing Origins). It's empty by
    default.
    - `any: []`: A list of origins that are allowed to communicate with, for all purposes.
    - `fetchWorkFunctions: []`: A list of origins that are allowed to fetch the work function from.
    - `fetchArguments: []`: A list of origins that are allowed to fetch work function arguments
      from.
    - `fetchData: []`: A list of origins that are allowed to fetch input set data from.
    - `sendResults: []`: A list of origins that are allowed to send results to.
  - `minimumWage?: object`: The minimum payout per slice the worker will accept from a job. Will
    default with the following structure:
    - `CPU: number = 0`
    - `GPU: number = 0`
    - `in: number = 0`
    - `out: number = 0`
  - `computeGroups?: []`: List of compute groups the worker is in and the authorization to join
    them. A compute group is to be described as
    `{ joinKey: 'exampleGroup', joinSecret: 'password' }`.
  - `leavePublicGroup?: boolean = false`: A flag that controls if the worker should omit fetching
    work from the public compute group. If not defined, this flag is evaluated to _false_.
  - `jobAddresses?: []`: If populated, worker will only fetch slices from jobs corresponding to the
    job addresses in this list.
  - `maxWorkingSandboxes?: number | undefined`: Maximum number of sandboxes allowed to do work. If
    `undefined`, then the Supervisor will determine a safe limit, based off of machine hardware.
  - `shouldStopWorkerImmediately?: boolean`: If true, when the worker is called to stop, it will
    terminate all working sandboxes without waiting for them to finish. If false, the worker will
    wait for all sandboxes to finish computing before terminating.

Note: Learn more about `Keystore` and `Address` in our [Wallet API documentation][wallet-docs].

### Returns

This hook returns an object with the following properties:

- `worker: Worker`: Refer to the [Worker API documentation][worker-docs].
- `workerState: object`: Stores status of worker states. Stored globally and preseved between
  component updates.
  - `isLoaded: boolean`: True once the worker is properly initialized.
  - `working: boolean`: True if the worker is doing work, false otherwise.
  - `willWork: boolean`: True when the worker is starting to do work, false when the worker is
    stopping.
  - `fetching: boolean`: True when the worker is fetching for slices to compute, false otherwise.
  - `submitting: boolean`: True when the worker is submitting results to the scheduler, false
    otherwise.
  - `error: Error | boolean`: Set when a worker error has occured, false otherwise.
  - `workingSandboxes: number`: Number of sandboxes currently doing work.
- `workerStatistics: object`: Stores a global count of worker statistics for a browser session.
  Stored globally and preseved between component updates.
  - `slices: number`: Number of slices completed.
  - `credits: BigNumber`: Total credits earned.
  - `computeTime: number`: Total time computed (ms).

Note: Learn more about `Sandbox` in our [Sandbox API][sandbox-docs] & [Compute API][compute-docs]
docs.

### Managing Origins

The `worker` returned has the `originManager` property, which is an instance of the
`OriginAccessManager` class responsible for managing the worker's allowed origins. `originManager`
is `undefined` until the worker is properly initialized.

Upon construction of the worker, the worker options `allowOrigins` property is read into the
construction of the `OriginAccessManager`. Properties of `allowOrigins` translate to a _purpose_ on
the OAM, with their values, being a list of origins, are added under that _purpose_ (and `null`
_key_). The `any` property translates to a `null` _purpose_, which matches any _purpose_. For
example, `isAllowed` will return `true` for origins stored under a `null` _purpose_, regardless the
_purpose_ and _key_ combination queried.

### `OriginAccessManager` Methods

- `add(origin, purpose, key):` Adds (allows) the _origin_ under the _purpose_ and _key_. A `null`
  _purpose_ and/or _key_ will match any _purpose_ and/or _key_, respectively.
- `remove(origin, purpose, key):` Removes (un-allows) the _origin_ under the _purpose_ and _key_. A
  `null` purpose and/or key will **not** match any _purpose_ and/or _key_.
- `remove_byKey(key):` Removes all origins for all purposes under the _key_. A `null` _key_ is not
  accepted, must be a string.
- `getAllowList(purpose, key):` returns a list of origins under the _purpose_ and _key_. A `null`
  _purpose_ is not accepted, must be a string. Previously added origins under `null` _purpose_
  and/or _key_ will match any _purpose_ and/or _key_, respectively.
- `isAllowed(origin, purpose, key):` returns `true` if _origin_ is allowed under the _purpose_ and
  _key_. A `null` _purpose_ is not accepted, must be a string. Previously added origins under `null`
  _purpose_ and/or _key_ will match any _purpose_ and/or _key_, respectively.

## Maintainers

[@bryan-hoang](https://github.com/bryan-hoang)

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the [standard-readme][standard-readme-repo]
specification.

## License

MIT © 2023 Distributive Corp.

[npm-version-badge]: https://img.shields.io/npm/v/use-dcp-worker
[standard-readme-badge]:
  https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square
[standard-readme-repo]: https://github.com/RichardLitt/standard-readme
[wallet-docs]: https://docs.dcp.dev/specs/wallet-api.html
[worker-docs]: https://docs.dcp.dev/specs/worker-api.html
[sandbox-docs]: https://docs.dcp.dev/specs/worker-api.html#sandbox-api
[compute-docs]: https://docs.dcp.dev/specs/compute-api.html#definitions
