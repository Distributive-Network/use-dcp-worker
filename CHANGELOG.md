# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [3.0.0] - 2024-01-04

### Changed

- **Breaking**: Switch `useDCPWorker` from a default export to a named export.
- Update `README.md` and `CHANGELOG.md` formats.

## [2.0.1] - 2023-10-20

### Fixed

- Re-render on the `end` event for sandboxes to prevent lingering UI elements that aren't aware of
  terminated sandboxes that are no longer receiving `payment` or `progress` events.
- Mark `bignumber.js` as a peer dependency to prevent issues with bundling different versions of the
  library in application code.

## [2.0.0] - 2023-08-15

- Now returns the worker
- Proper handling of race-condition in constructing the worker when/if the hook is executed multiple
  times at once
- `workerOptions` passed to worker constructor is a Proxy now
  - Needed reflect changes to `paymentAddress` and `maxWorkingSandbox` props to local storage and
    trigger component update/re-render
- Removed `workerState.isLoaded` since now we're returning the worker
  - `!isLoaded === !worker`
- Removed `workerOptionsState`, start/stop/toggleWorker, sandboxes, `originManager`
  - These are all accessible through the Worker API
- Removed `applyWorkerOptions` since editing `workerOptions` should be done by directly mutating
  `worker.workerOptions`
- Improved error handling
- Quality of life improvements

## [1.0.4] - 2023-08-03

- Compatibility update for new Worker events from dcp-client

## [1.0.2] - 2023-03-23

- Local storage will only save `paymentAddress` and `maxWorkingSandbox` props
- Worker options source always coming from dcpConfig
- Added delay between quick worker fetching states
- Quality of life + maintainability improvements

## [1.0.1] - 2023-03-23

- Added src/ directory to published files to support source map

## [1.0.0] - 2023-02-23

- Initial Release
