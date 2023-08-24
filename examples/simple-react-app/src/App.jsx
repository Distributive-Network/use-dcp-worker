import { useState } from 'react';
import useDCPWorker from 'use-dcp-worker';

const workerPaymentAddress = import.meta.env.VITE_WORKER_PAYMENT_ACCOUNT;

function App() {
  const [paymentAddress, setPaymentAddress] = useState(workerPaymentAddress);
  // window.dcp is populated from dcp-client script in public/index.html 
  const { wallet } = window.dcp;

  // triggers client modal and sets workerPaymentAddress
  async function getPaymentAddress()
  {
    console.warn('Did not specifiy BANK_ACCOUNT_ADDRESS env var. Calling wallet.get.');
    try
    {
      let ks = await wallet.get(); // Wallet API
      setPaymentAddress(ks.address);
    }
    catch (e)
    {
      console.error(e);
      alert(e);
    }
  }

  // resolve payment address for worker options
  // if .env var is not set, trigger client modal
  if (!workerPaymentAddress)
    getPaymentAddress();

  // use-dcp-worker
  const config = { workerOptions: { paymentAddress }};
  const { worker } = useDCPWorker(config);

  // front-end worker status visualization logic
  const statusText = document.getElementById('status-text');
  if (worker)
  {
    if (statusText.textContent === 'Not Ready') 
      statusText.textContent = "Ready";

    worker.on('start', () => { statusText.textContent = "Started" });
    worker.on('stop', () => { statusText.textContent = "Stopped" });
    worker.on('error', () => { statusText.textContent = "Error" });
  }

  function startWorker()
  {
    if (worker) worker.start();
  }

  function stopWorker()
  {
    if (worker) worker.stop();
  }

  return (
    <div>
      <h1>Simple use-dcp-worker application</h1> 
      <h3>Status: <span id="status-text">Not Ready</span></h3>
      <button style={{marginRight: '20px'}} onClick={startWorker}>Start Worker</button>
      <button onClick={stopWorker}>Stop Worker</button>
    </div>
  );
}

export default App;
