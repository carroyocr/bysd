import React from 'react';
import { useParams } from 'react-router-dom';
import LiveDashboard from '../components/LiveDashboard';

export default function LiveDashboardPage() {
  const { raceCode } = useParams();
  
  return (
    <div className="pt-20">
      <LiveDashboard raceCode={raceCode} />
    </div>
  );
}
