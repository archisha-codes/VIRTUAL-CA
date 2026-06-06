import React from 'react';
import { useLocation } from 'react-router-dom';
import { IMSInwardPage } from './IMSInwardPage';
import { IMSOutwardPage } from './IMSOutwardPage';

export default function IMSPage() {
  const location = useLocation();
  const isInward = location.pathname.includes('inward');

  if (isInward) {
    return <IMSInwardPage />;
  }
  
  return <IMSOutwardPage />;
}
