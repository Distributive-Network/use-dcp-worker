import { useEffect, useState } from 'react';
import { useDCPWorker } from 'use-dcp-worker';

const workerPaymentAddress = import.meta.env.VITE_WORKER_PAYMENT_ADDRESS;

const { compute, wallet } = window.dcp;

function App() {
  const [paymentAddress, setPaymentAddress] = useState(workerPaymentAddress);

  // triggers client modal and sets workerPaymentAddress
  async function getPaymentAddress() {
    try {
      let ks = await wallet.get();
      setPaymentAddress(ks.address);
    } catch (e) {
      console.error(e);
      alert(e);
    }
  }

  // resolve payment address for worker options
  // if .env var is not set, trigger client modal
  if (!paymentAddress) getPaymentAddress();

  // use use-dcp-worker hook
  const config = {
    workerOptions: {
      paymentAddress,
      leavePublicGroup: true, // to ensure worker does NOT work on public jobs
    },
    useLocalStorage: false,
  };
  const { worker, workerState, workerStatistics } = useDCPWorker(config);

  // get workerLog to attachListeners
  const workerLog = document.getElementById('worker-log');
  // scroll worker log content to bottom
  if (workerLog) workerLog.scrollTop = workerLog.scrollHeight;

  // start/stop worker
  function toggleWorker() {
    const workerBtn = document.getElementById('worker-btn');
    // worker is not available right away during construction
    if (worker) {
      if (workerState.working) {
        worker.stop(); // Worker API
        workerBtn.textContent = 'Start Worker';
      } else {
        worker.start(); // Worker API
        workerBtn.textContent = 'Stop Worker';
      }
    }
  }

  // launch a job for the worker - Compute API
  async function launchJob() {
    const log = document.getElementById('job-log');
    log.textContent = '';

    function workFn(x) {
      // eslint-disable-next-line
      progress();
      return x.toUpperCase();
    }

    const job = compute.for(Array.from('test'), workFn);

    job.on('readystatechange', (ev) => {
      log.innerHTML += `<br>${ev}`;
    });
    // this is paired with setting worker.workerOptions.leavePublicGroup to false
    // ensure worker only works on this job and only this job
    job.on('accepted', (ev) => {
      worker.workerOptions.jobIds.push(ev.id);
    });
    job.on('result', (ev) => {
      log.innerHTML += `<br>result: ${ev.result}`;
    });
    job.on('error', (ev) => {
      log.textContent = ev.toString();
    });

    await job.exec();
    log.innerHTML += '<br><br>Job finished successfully :)';
  }

  /**
   * attach custom listeners to worker returned from hook for workerLog
   * wrapped in useEffect to ensure listeners are attached only once (React specific)
   */
  useEffect(() => {
    if (!worker) {
      return;
    }

    function handleStart() {
      workerLog.innerHTML += '<br><span style="color:green">Worker started</span>';
    }
    function handleSandbox() {
      workerLog.innerHTML += '<br><span style="color:purple">Sandbox created</span>';
    }
    function handleFetch() {
      workerLog.innerHTML += '<br><span style="color:blue">Task fetched</span>';
    }
    function handleStop() {
      workerLog.innerHTML +=
        '<br><span style="color:darkorange">Worker was asked to stop...</span>';
    }
    function handleEnd() {
      workerLog.innerHTML += '<br><span style="color:red">Worker stopped</span>';
    }
    function handleError(error) {
      workerLog.textContent = error.toString();
    }

    worker.on('start', handleStart);
    worker.on('sandbox', handleSandbox);
    worker.on('fetch', handleFetch);
    worker.on('stop', handleStop);
    worker.on('end', handleEnd);
    worker.on('error', handleError);

    return () => {
      worker.off('start', handleStart);
      worker.off('sandbox', handleSandbox);
      worker.off('fetch', handleFetch);
      worker.off('stop', handleStop);
      worker.off('end', handleEnd);
      worker.off('error', handleError);
    };
  }, [worker, workerLog]);

  return (
    <div>
      <h1>Advanced use-dcp-worker application</h1>
      <p>
        <strong>Scheduler:</strong> {import.meta.env.VITE_SCHEDULER_LOCATION}
      </p>
      <p>
        <strong>Worker Payment Address:</strong> {worker?.workerOptions.paymentAddress?.address}
      </p>
      <p style={{ color: 'grey' }}>Scheduler and payment address are configurable in .env</p>
      <div id="flex-container">
        <div>
          <h4>workerState</h4>
          <ul>
            {Object.keys(workerState).map((prop) => {
              return (
                <li key={prop}>
                  <i>{prop}:</i>{' '}
                  {workerState[prop] === null ? 'null' : workerState[prop].toString()}
                </li>
              );
            })}
          </ul>
          <button id="worker-btn" onClick={toggleWorker}>
            Start Worker
          </button>
          <p id="worker-log"></p>
        </div>
        <div>
          <h4>workerStatistics</h4>
          <ul>
            {Object.keys(workerStatistics).map((prop) => {
              return (
                <li key={prop}>
                  <i>{prop}:</i> {workerStatistics[prop].toString()}
                </li>
              );
            })}
          </ul>
          <button onClick={launchJob}>Launch Job</button>
          <p id="job-log"></p>
        </div>
      </div>
    </div>
  );
}

export default App;
