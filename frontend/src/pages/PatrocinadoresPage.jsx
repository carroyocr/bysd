import React from 'react';
import { useParams } from 'react-router-dom';
import SponsorsSection from '../components/SponsorsSection';

export default function PatrocinadoresPage() {
  const { raceCode } = useParams();
  
  return (
    <div className="pt-16">
      <SponsorsSection raceCode={raceCode} />
    </div>
  );
}