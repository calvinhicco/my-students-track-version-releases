import React, { useState } from 'react';
import Dashboard from './Dashboard';
import BroadcastPage from './BroadcastPage';

const AppRouter = () => {
  const [page, setPage] = useState<'dashboard' | 'broadcast'>('dashboard');

  return (
    <>
      {page === 'dashboard' && <Dashboard goToBroadcast={() => setPage('broadcast')} />}
      {page === 'broadcast' && <BroadcastPage goToDashboard={() => setPage('dashboard')} />}
    </>
  );
};

export default AppRouter;
