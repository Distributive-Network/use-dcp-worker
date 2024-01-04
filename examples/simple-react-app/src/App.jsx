import { useEffect, useRef, useState } from 'react';
import { useDCPWorker } from 'use-dcp-worker';

const workerPaymentAddress = import.meta.env.VITE_WORKER_PAYMENT_ADDRESS;

function App() {
  const [paymentAddress, setPaymentAddress] = useState(workerPaymentAddress);
  const statusTextElement = useRef(null);

  // window.dcp is populated from dcp-client script in public/index.html
  const { wallet } = window.dcp;

  // triggers client modal and sets workerPaymentAddress
  async function getPaymentAddress() {
    try {
      let ks = await wallet.get(); // Wallet API
      setPaymentAddress(ks.address);
    } catch (e) {
      console.error(e);
      alert(e);
    }
  }

  // resolve payment address for worker options
  // if .env var is not set, trigger client modal
  if (!paymentAddress) getPaymentAddress();

  // use-dcp-worker
  const config = { workerOptions: { paymentAddress } };
  const { worker } = useDCPWorker(config);

  useEffect(() => {
    if (statusTextElement.current.textContent === 'Not Ready')
      statusTextElement.current.textContent = 'Ready';

    function handleStart() {
      statusTextElement.current.textContent = 'Started';
    }

    function handleStop() {
      statusTextElement.current.textContent = 'Stopped';
    }

    function handleError() {
      statusTextElement.current.textContent = 'Error';
    }

    worker?.on('start', handleStart);
    worker?.on('stop', handleStop);
    worker?.on('error', handleError);

    return () => {
      worker?.off('start', handleStart);
      worker?.off('stop', handleStop);
      worker?.off('error', handleError);
    };
  }, [worker]);

  function startWorker() {
    worker.start();
  }

  function stopWorker() {
    worker.stop(true);
  }

  return (
    <div>
      <h1>Simple use-dcp-worker application</h1>
      <h3>
        Status:{' '}
        <span ref={statusTextElement} id="status-text">
          Not Ready
        </span>
      </h3>
      <button style={{ marginRight: '20px' }} onClick={startWorker}>
        Start Worker
      </button>
      <button onClick={stopWorker}>Stop Worker</button>
    </div>
  );
}

export default App;
